-- CRM Playbook Migration
-- Motor de cadencia de seguimiento (basado en la Hoja2 del feedback).
-- Correr en el SQL Editor de Supabase (después de crm-migration.sql).
--
-- Qué hace:
--   1. Agrega tipo de respuesta a las interacciones y estado de playbook a los prospectos.
--   2. Crea la tabla crm_playbook_steps con la cadencia (respuesta -> próxima tarea + plazo).
--   3. Un trigger: al registrar una interacción con tipo de respuesta, crea
--      automáticamente la próxima tarea con su fecha y actualiza el prospecto.

-- ── 1. Columnas nuevas ────────────────────────────────────────────
ALTER TABLE prospects
  ADD COLUMN IF NOT EXISTS response_type text,
  ADD COLUMN IF NOT EXISTS playbook_step int NOT NULL DEFAULT 0;

ALTER TABLE crm_interactions
  ADD COLUMN IF NOT EXISTS response_type   text,   -- acepta_reunion/mas_adelante/deriva/objecion/sin_respuesta
  ADD COLUMN IF NOT EXISTS response_detail text;   -- motivo de postergación / objeción / info de interés

-- ── 2. Tabla del playbook ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS crm_playbook_steps (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  response_type     text NOT NULL,
  step_order        int  NOT NULL,
  next_task_type    text,            -- valor de CrmTaskType (Follow-up/Meeting/Reconnect/...)
  next_task_detail  text NOT NULL,
  channel_suggested text,
  days_offset       int  DEFAULT 0,  -- plazo en días para la próxima tarea
  alert_label       text,
  close_months      int,             -- si aplica, cierre temporal en N meses
  is_terminal       boolean NOT NULL DEFAULT false,
  UNIQUE (response_type, step_order)
);

ALTER TABLE crm_playbook_steps ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "auth_playbook_select" ON crm_playbook_steps;
CREATE POLICY "auth_playbook_select" ON crm_playbook_steps FOR SELECT TO authenticated USING (true);

-- ── 3. Seed de la cadencia (Hoja2) ────────────────────────────────
INSERT INTO crm_playbook_steps
  (response_type, step_order, next_task_type, next_task_detail, channel_suggested, days_offset, alert_label, close_months, is_terminal) VALUES
  -- Acepta reunión
  ('acepta_reunion', 1, 'Follow-up', 'Responder al cliente y proponer fecha de reunión', 'Email', 0, NULL, NULL, false),
  ('acepta_reunion', 2, 'Meeting',   'Agendar reunión y confirmar equipo ERA',          NULL,    1, 'Confirmar equipo ERA', NULL, false),
  ('acepta_reunion', 3, 'Follow-up', 'Confirmar reunión con el cliente',                 NULL,    0, '5 días antes de la reunión', NULL, false),
  ('acepta_reunion', 4, 'Meeting',   'Recordatorio final y realizar la reunión',         NULL,    0, '1 día antes de la reunión', NULL, true),
  -- Más adelante
  ('mas_adelante', 1, 'Follow-up', 'Registrar motivo de postergación y fecha de recontacto', NULL, 0,  NULL, NULL, false),
  ('mas_adelante', 2, 'Reconnect', 'Retomar contacto según la fecha de recontacto',          NULL, 30, '3 días antes de la fecha de recontacto', NULL, false),
  ('mas_adelante', 3, 'Follow-up', 'Reintentar contacto (llamar o reenviar mensaje)',        NULL, 5,  NULL, NULL, false),
  ('mas_adelante', 4, 'Reconnect', 'Cerrar temporalmente y reactivar más adelante',          NULL, 0,  NULL, 6, true),
  -- Deriva a otra persona
  ('deriva', 1, 'Follow-up', 'Crear nuevo contacto (referido) y contactarlo — vuelve al contacto inicial', NULL, 0, NULL, NULL, true),
  -- Objeción
  ('objecion', 1, 'Follow-up',       'Registrar motivo de objeción y responder la objeción',          NULL, 0, NULL, NULL, false),
  ('objecion', 2, 'Send case study', 'Enviar info de interés (caso de éxito / invitación / trigger)',  NULL, 7, NULL, NULL, false),
  ('objecion', 3, 'Follow-up',       'Evaluar respuesta con la nueva información de interés',          NULL, 5, NULL, NULL, false),
  ('objecion', 4, 'Reconnect',       'Cerrar temporalmente y reactivar más adelante',                 NULL, 0, NULL, 12, true),
  -- Sin respuesta (cadencia de 9 toques, luego cierre)
  ('sin_respuesta', 1,  'Follow-up', 'Llamar o reenviar mensaje (seguimiento)',                    NULL, 5,  NULL, NULL, false),
  ('sin_respuesta', 2,  'Follow-up', 'Registrar nueva información de interés y hacer seguimiento',  NULL, 14, NULL, NULL, false),
  ('sin_respuesta', 3,  'Follow-up', 'Llamar o reenviar mensaje (seguimiento)',                    NULL, 5,  NULL, NULL, false),
  ('sin_respuesta', 4,  'Follow-up', 'Cambiar de canal y registrar nueva información de interés',   NULL, 5,  'Cambiar de canal', NULL, false),
  ('sin_respuesta', 5,  'Follow-up', 'Llamar o reenviar mensaje (seguimiento)',                    NULL, 30, NULL, NULL, false),
  ('sin_respuesta', 6,  'Follow-up', 'Cambiar de canal y registrar nueva información de interés',   NULL, 15, 'Cambiar de canal', NULL, false),
  ('sin_respuesta', 7,  'Follow-up', 'Llamar o reenviar mensaje (seguimiento)',                    NULL, 15, NULL, NULL, false),
  ('sin_respuesta', 8,  'Follow-up', 'Llamar o reenviar mensaje (seguimiento)',                    NULL, 15, NULL, NULL, false),
  ('sin_respuesta', 9,  'Follow-up', 'Llamar o reenviar mensaje (último intento)',                 NULL, 15, NULL, NULL, false),
  ('sin_respuesta', 10, 'Reconnect', 'Cerrar prospecto (sin respuesta tras 9 intentos)',           NULL, 0,  NULL, NULL, true)
ON CONFLICT (response_type, step_order) DO NOTHING;

-- ── 4. Motor: trigger que aplica el playbook ──────────────────────
CREATE OR REPLACE FUNCTION crm_apply_playbook()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  prev_resp text;
  prev_step int;
  new_step  int;
  pb        crm_playbook_steps%ROWTYPE;
BEGIN
  -- Sin tipo de respuesta: no hace nada (interacción normal)
  IF NEW.response_type IS NULL OR NEW.response_type = '' THEN
    RETURN NEW;
  END IF;

  SELECT response_type, playbook_step INTO prev_resp, prev_step
    FROM prospects WHERE id = NEW.prospect_id;

  -- Misma respuesta que la anterior => avanza la cadencia; si cambia => arranca en 1
  IF NEW.response_type = prev_resp THEN
    new_step := COALESCE(prev_step, 0) + 1;
  ELSE
    new_step := 1;
  END IF;

  SELECT * INTO pb FROM crm_playbook_steps
    WHERE response_type = NEW.response_type AND step_order = new_step;

  -- Si pasamos el final de la cadencia, tomar el paso terminal
  IF NOT FOUND THEN
    SELECT * INTO pb FROM crm_playbook_steps
      WHERE response_type = NEW.response_type AND is_terminal
      ORDER BY step_order DESC LIMIT 1;
  END IF;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  -- Crear la tarea sugerida
  INSERT INTO crm_tasks (prospect_id, interaction_id, task_type, priority, status, due_date, notes)
  VALUES (
    NEW.prospect_id,
    NEW.id,
    pb.next_task_type,
    'Medium',
    'Pending',
    CURRENT_DATE + COALESCE(pb.days_offset, 0),
    pb.next_task_detail
      || CASE WHEN pb.alert_label IS NOT NULL THEN '  ⚠ ' || pb.alert_label ELSE '' END
      || CASE WHEN NEW.response_detail IS NOT NULL AND NEW.response_detail <> '' THEN '  · ' || NEW.response_detail ELSE '' END
  );

  -- Actualizar el prospecto (posición en la cadencia + estado si corresponde)
  UPDATE prospects SET
    response_type = NEW.response_type,
    playbook_step = pb.step_order,
    status = CASE
      WHEN pb.close_months IS NOT NULL THEN 'Dormant'
      WHEN NEW.response_type = 'sin_respuesta' AND pb.is_terminal THEN 'Closed Lost'
      ELSE status
    END,
    reconnect_month = CASE
      WHEN pb.close_months IS NOT NULL
      THEN to_char(CURRENT_DATE + (pb.close_months || ' months')::interval, 'YYYY-MM')
      ELSE reconnect_month
    END,
    updated_at = now()
  WHERE id = NEW.prospect_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_crm_apply_playbook ON crm_interactions;
CREATE TRIGGER trg_crm_apply_playbook
  AFTER INSERT ON crm_interactions
  FOR EACH ROW EXECUTE FUNCTION crm_apply_playbook();
