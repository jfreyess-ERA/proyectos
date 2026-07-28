-- CRM Playbook v3 — fechas reales en vez de etiquetas
--
-- En el Excel conviven tres formas distintas de fijar cuándo toca la próxima acción:
--   1. Relativa a hoy      — "5 días", "14 días", "30 días" (la cadencia de toques).
--   2. Anclada a la reunión — "5 días antes reunión", "1 día antes reunión", "12 horas".
--   3. Elegida por el usuario — recontacto a "30 / 90 / 180 días / Fecha indicada".
--
-- Hasta v2 sólo existía la primera: days_offset se sumaba a CURRENT_DATE y las otras
-- dos quedaban como texto pegado en las notas de la tarea. Acá se vuelven fechas
-- calculadas de verdad.
--
-- Correr en el SQL Editor de Supabase (después de crm-playbook-v2-migration.sql).

-- ── 1. Dónde viven las fechas ancla ───────────────────────────────
ALTER TABLE prospects
  ADD COLUMN IF NOT EXISTS meeting_at   timestamptz,  -- reunión agendada
  ADD COLUMN IF NOT EXISTS reconnect_at date;         -- fecha de recontacto pactada

-- La interacción las trae cuando el usuario las registra; el trigger las propaga al prospecto.
ALTER TABLE crm_interactions
  ADD COLUMN IF NOT EXISTS meeting_at   timestamptz,
  ADD COLUMN IF NOT EXISTS reconnect_at date;

-- due_date sigue siendo la fecha (todas las vistas del CRM la usan);
-- due_at agrega la hora, necesaria para alertas como "12 horas antes".
ALTER TABLE crm_tasks
  ADD COLUMN IF NOT EXISTS due_at timestamptz;

-- ── 2. El nodo declara contra qué se mide su plazo ────────────────
ALTER TABLE crm_playbook_nodes
  ADD COLUMN IF NOT EXISTS anchor       text NOT NULL DEFAULT 'now',
  ADD COLUMN IF NOT EXISTS offset_hours int  NOT NULL DEFAULT 0;

-- Migrar los plazos existentes (todos eran relativos a hoy) y soltar la columna vieja.
UPDATE crm_playbook_nodes SET offset_hours = days_offset * 24 WHERE offset_hours = 0;
ALTER TABLE crm_playbook_nodes DROP COLUMN IF EXISTS days_offset;

ALTER TABLE crm_playbook_nodes DROP CONSTRAINT IF EXISTS crm_pb_anchor_chk;
ALTER TABLE crm_playbook_nodes ADD CONSTRAINT crm_pb_anchor_chk
  CHECK (anchor IN ('now', 'meeting', 'reconnect'));

-- ── 3. Anclas por nodo ────────────────────────────────────────────
-- Rama "acepta reunión": los plazos del Excel son relativos a la reunión, no a hoy.
UPDATE crm_playbook_nodes SET anchor = 'meeting', offset_hours = -120, alert_label = '5 días antes de la reunión'   WHERE node_key = 'ar_confirmar';
UPDATE crm_playbook_nodes SET anchor = 'meeting', offset_hours = -12,  alert_label = '12 horas antes de la reunión' WHERE node_key = 'ar_sin_conf';
UPDATE crm_playbook_nodes SET anchor = 'meeting', offset_hours = -24,  alert_label = '1 día antes de la reunión'    WHERE node_key = 'ar_realizar';
UPDATE crm_playbook_nodes SET anchor = 'now',     offset_hours = 24,   alert_label = '1 día'                        WHERE node_key = 'ar_reagendar';
UPDATE crm_playbook_nodes SET anchor = 'now',     offset_hours = 0,    alert_label = 'Agendar y confirmar la fecha' WHERE node_key = 'ar_agendar';

-- Rama "más adelante": vence en la fecha de recontacto que se haya pactado.
UPDATE crm_playbook_nodes SET anchor = 'reconnect', offset_hours = 0, alert_label = 'En la fecha de recontacto'
  WHERE node_key IN ('ma_postergar', 'ma_repostergar');

-- ── 4. Motor: calcula la fecha según el ancla del nodo ────────────
CREATE OR REPLACE FUNCTION crm_apply_playbook()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cur_node  text;
  nxt_key   text;
  n         crm_playbook_nodes%ROWTYPE;
  t         jsonb;
  p_meeting timestamptz;
  p_reconn  date;
  due_ts    timestamptz;
BEGIN
  IF NEW.response_type IS NULL OR NEW.response_type = '' THEN
    RETURN NEW;
  END IF;

  SELECT playbook_node, meeting_at, reconnect_at
    INTO cur_node, p_meeting, p_reconn
    FROM prospects WHERE id = NEW.prospect_id;

  -- La interacción puede traer una reunión o un recontacto nuevos; pisan lo anterior.
  p_meeting := COALESCE(NEW.meeting_at, p_meeting);
  p_reconn  := COALESCE(NEW.reconnect_at, p_reconn);

  SELECT to_node INTO nxt_key FROM crm_playbook_edges
    WHERE from_node = COALESCE(cur_node, '_root') AND response = NEW.response_type;
  IF nxt_key IS NULL THEN
    SELECT to_node INTO nxt_key FROM crm_playbook_edges
      WHERE from_node = '_root' AND response = NEW.response_type;
  END IF;
  IF nxt_key IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT * INTO n FROM crm_playbook_nodes WHERE node_key = nxt_key;
  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  -- Sin la fecha ancla no tiene sentido aplicar el offset: "5 días antes de la
  -- reunión" sin reunión daría una tarea vencida en el pasado. Caemos a "ahora"
  -- (hacelo cuanto antes) y, para recontacto, al default de 30 días del Excel.
  due_ts := CASE n.anchor
    WHEN 'meeting' THEN
      CASE WHEN p_meeting IS NOT NULL
           THEN p_meeting + make_interval(hours => n.offset_hours)
           ELSE now() END
    WHEN 'reconnect' THEN
      CASE WHEN p_reconn IS NOT NULL
           THEN p_reconn::timestamptz + make_interval(hours => n.offset_hours)
           ELSE now() + interval '30 days' END
    ELSE now() + make_interval(hours => n.offset_hours)
  END;

  FOR t IN SELECT * FROM jsonb_array_elements(n.tasks) LOOP
    INSERT INTO crm_tasks (prospect_id, interaction_id, task_type, priority, status, due_date, due_at, notes)
    VALUES (
      NEW.prospect_id,
      NEW.id,
      t->>'type',
      'Medium',
      'Pending',
      due_ts::date,
      due_ts,
      (t->>'detail')
        || CASE WHEN n.alert_label IS NOT NULL THEN '  ⚠ ' || n.alert_label ELSE '' END
        || CASE WHEN NEW.response_detail IS NOT NULL AND NEW.response_detail <> '' THEN '  · ' || NEW.response_detail ELSE '' END
    );
  END LOOP;

  UPDATE prospects SET
    response_type = NEW.response_type,
    playbook_node = n.node_key,
    playbook_step = n.position,
    meeting_at    = p_meeting,
    reconnect_at  = CASE
      WHEN n.close_months IS NOT NULL
      THEN (CURRENT_DATE + (n.close_months || ' months')::interval)::date
      ELSE p_reconn
    END,
    status = COALESCE(n.sets_status, status),
    reconnect_month = CASE
      WHEN n.close_months IS NOT NULL
      THEN to_char(CURRENT_DATE + (n.close_months || ' months')::interval, 'YYYY-MM')
      WHEN p_reconn IS NOT NULL
      THEN to_char(p_reconn, 'YYYY-MM')
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
