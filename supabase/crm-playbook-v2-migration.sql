-- CRM Playbook v2 — el árbol de decisión real del Excel "CRM ERA"
--
-- Reemplaza la cadencia lineal de crm-playbook-migration.sql por un grafo:
--   · Cada NODO es un estado: tareas a ejecutar + plazo + alerta.
--   · Cada ARISTA es una respuesta del prospecto que lleva de un nodo a otro.
--
-- Por qué: en el Excel el vocabulario de respuestas cambia según dónde estés.
-- Después de "Acepta reunión" la pregunta no es "¿acepta reunión otra vez?",
-- sino "¿Ok / Reagendar / Sin respuesta?". La versión lineal obligaba a repetir
-- la misma respuesta para avanzar, que es semánticamente falso.
--
-- Correr en el SQL Editor de Supabase (después de crm-migration.sql).

-- ── 1. Estado del playbook en el prospecto ────────────────────────
ALTER TABLE prospects
  ADD COLUMN IF NOT EXISTS playbook_node text;

-- ── 2. Nodos ──────────────────────────────────────────────────────
DROP TABLE IF EXISTS crm_playbook_edges;
DROP TABLE IF EXISTS crm_playbook_nodes;

CREATE TABLE crm_playbook_nodes (
  node_key     text PRIMARY KEY,
  branch       text    NOT NULL,          -- rama de origen (una de las 5 respuestas iniciales)
  label        text    NOT NULL,
  position     int     NOT NULL,          -- orden dentro de la rama, para mostrar "paso N de M"
  tasks        jsonb   NOT NULL,          -- [{ "type": <CrmTaskType>, "detail": "..." }]
  days_offset  int     NOT NULL DEFAULT 0,
  alert_label  text,                      -- texto de la alerta del Excel
  close_months int,                       -- cierre temporal: reactivar en N meses
  sets_status  text,                      -- fuerza un status del prospecto al entrar
  is_terminal  boolean NOT NULL DEFAULT false
);

-- ── 3. Aristas (respuesta -> nodo destino) ────────────────────────
-- from_node = '_root' son las 5 respuestas iniciales del contacto.
CREATE TABLE crm_playbook_edges (
  from_node  text NOT NULL,
  response   text NOT NULL,
  to_node    text NOT NULL REFERENCES crm_playbook_nodes(node_key) ON DELETE CASCADE,
  sort_order int  NOT NULL DEFAULT 0,
  PRIMARY KEY (from_node, response)
);

ALTER TABLE crm_playbook_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_playbook_edges ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "auth_pb_nodes_select" ON crm_playbook_nodes;
DROP POLICY IF EXISTS "auth_pb_edges_select" ON crm_playbook_edges;
CREATE POLICY "auth_pb_nodes_select" ON crm_playbook_nodes FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_pb_edges_select" ON crm_playbook_edges FOR SELECT TO authenticated USING (true);

-- ── 4. Seed: el árbol del Excel ───────────────────────────────────

-- Rama ACEPTA REUNIÓN (filas 11-16 del Excel)
INSERT INTO crm_playbook_nodes (node_key, branch, label, position, tasks, days_offset, alert_label, is_terminal) VALUES
 ('ar_agendar',   'acepta_reunion', 'Acepta reunión — agendar',          1,
  '[{"type":"Follow-up","detail":"Responder al cliente"},{"type":"Meeting","detail":"Agendar reunión"}]'::jsonb,
  0, '5 días antes de la reunión', false),
 ('ar_confirmar', 'acepta_reunion', 'Confirmar con el cliente',          2,
  '[{"type":"Follow-up","detail":"Mantener fecha"},{"type":"Follow-up","detail":"Confirmar cliente"}]'::jsonb,
  0, '1 día antes de la reunión', false),
 ('ar_reagendar', 'acepta_reunion', 'Reagendar',                          3,
  '[{"type":"Follow-up","detail":"Proponer nueva fecha al cliente"},{"type":"Follow-up","detail":"Seguimiento reagendación"}]'::jsonb,
  1, '1 día', false),
 ('ar_sin_conf',  'acepta_reunion', 'Sin respuesta a la confirmación',    4,
  '[{"type":"Call","detail":"Llamar o reenviar la invitación"},{"type":"Follow-up","detail":"Seguimiento confirmación"}]'::jsonb,
  0, '12 horas', false),
 ('ar_realizar',  'acepta_reunion', 'Reunión confirmada',                 5,
  '[{"type":"Meeting","detail":"Reunión confirmada — realizar la reunión"}]'::jsonb,
  0, NULL, true);

-- Rama MÁS ADELANTE (filas 17-18)
INSERT INTO crm_playbook_nodes (node_key, branch, label, position, tasks, days_offset, alert_label, is_terminal) VALUES
 ('ma_postergar',   'mas_adelante', 'Más adelante — postergado', 1,
  '[{"type":"Follow-up","detail":"Registrar motivo de postergación"},{"type":"Follow-up","detail":"Registrar fecha de recontacto"},{"type":"Reconnect","detail":"Retomar contacto"}]'::jsonb,
  30, 'Según la fecha de recontacto', false),
 ('ma_repostergar', 'mas_adelante', 'Nueva postergación',        2,
  '[{"type":"Follow-up","detail":"Registrar nueva fecha de recontacto"},{"type":"Reconnect","detail":"Retomar contacto (correo para retomar la conversación)"}]'::jsonb,
  30, 'Según la fecha de recontacto', false);

-- Rama DERIVA (fila 19)
INSERT INTO crm_playbook_nodes (node_key, branch, label, position, tasks, days_offset, alert_label, is_terminal) VALUES
 ('dv_referido', 'deriva', 'Deriva a otra persona', 1,
  '[{"type":"Follow-up","detail":"Crear el nuevo contacto (referido)"},{"type":"Call","detail":"Contactar al referido"}]'::jsonb,
  0, 'Inmediata — vuelve al inicio del ciclo con el referido', true);

-- Rama OBJECIÓN (filas 20-26)
INSERT INTO crm_playbook_nodes (node_key, branch, label, position, tasks, days_offset, alert_label, close_months, sets_status, is_terminal) VALUES
 ('ob_responder', 'objecion', 'Objeción — responder',            1,
  '[{"type":"Follow-up","detail":"Registrar motivo de la objeción"},{"type":"Follow-up","detail":"Responder la objeción"}]'::jsonb,
  0, 'Inmediata', NULL, NULL, false),
 ('ob_reevaluar', 'objecion', 'Objeción persistente',             2,
  '[{"type":"Send case study","detail":"Evaluar respuesta con nueva información de interés"},{"type":"Follow-up","detail":"Responder la objeción"}]'::jsonb,
  0, NULL, NULL, NULL, false),
 ('ob_sin_resp',  'objecion', 'Sin respuesta tras la objeción',   3,
  '[{"type":"Call","detail":"Llamar o reenviar mensaje"},{"type":"Follow-up","detail":"Seguimiento"}]'::jsonb,
  5, '5 días', NULL, NULL, false),
 ('ob_resuelta',  'objecion', 'Objeción resuelta',                4,
  '[{"type":"Follow-up","detail":"Objeción resuelta — continuar el proceso comercial"}]'::jsonb,
  0, NULL, NULL, NULL, true),
 ('ob_cierre',    'objecion', 'Cierre temporal por objeción',     5,
  '[{"type":"Reconnect","detail":"Cerrar temporalmente y reactivar más adelante"}]'::jsonb,
  0, '12 meses', 12, 'Dormant', true);

-- Rama SIN RESPUESTA (fila 27) — 9 toques y cierre
INSERT INTO crm_playbook_nodes (node_key, branch, label, position, tasks, days_offset, alert_label, sets_status, is_terminal) VALUES
 ('sr_1',  'sin_respuesta', 'Toque 1',                      1,
  '[{"type":"Call","detail":"Llamar o reenviar mensaje"},{"type":"Follow-up","detail":"Seguimiento"}]'::jsonb, 5,  '5 días',  NULL, false),
 ('sr_2',  'sin_respuesta', 'Toque 2 — nueva información',  2,
  '[{"type":"Send case study","detail":"Registrar nueva información de interés"},{"type":"Follow-up","detail":"Seguimiento"}]'::jsonb, 14, '14 días', NULL, false),
 ('sr_3',  'sin_respuesta', 'Toque 3',                      3,
  '[{"type":"Call","detail":"Llamar o reenviar mensaje"},{"type":"Follow-up","detail":"Seguimiento"}]'::jsonb, 5,  '5 días',  NULL, false),
 ('sr_4',  'sin_respuesta', 'Toque 4 — cambiar de canal',   4,
  '[{"type":"Follow-up","detail":"Cambiar de canal"},{"type":"Send case study","detail":"Registrar nueva información de interés"},{"type":"Follow-up","detail":"Seguimiento"}]'::jsonb, 5,  'Cambiar de canal · 5 días', NULL, false),
 ('sr_5',  'sin_respuesta', 'Toque 5',                      5,
  '[{"type":"Call","detail":"Llamar o reenviar mensaje"},{"type":"Follow-up","detail":"Seguimiento"}]'::jsonb, 30, '30 días', NULL, false),
 ('sr_6',  'sin_respuesta', 'Toque 6 — cambiar de canal',   6,
  '[{"type":"Follow-up","detail":"Cambiar de canal"},{"type":"Send case study","detail":"Registrar nueva información de interés"},{"type":"Follow-up","detail":"Seguimiento"}]'::jsonb, 15, 'Cambiar de canal · 15 días', NULL, false),
 ('sr_7',  'sin_respuesta', 'Toque 7',                      7,
  '[{"type":"Call","detail":"Llamar o reenviar mensaje"},{"type":"Follow-up","detail":"Seguimiento"}]'::jsonb, 15, '15 días', NULL, false),
 ('sr_8',  'sin_respuesta', 'Toque 8',                      8,
  '[{"type":"Call","detail":"Llamar o reenviar mensaje"},{"type":"Follow-up","detail":"Seguimiento"}]'::jsonb, 15, '15 días', NULL, false),
 ('sr_9',  'sin_respuesta', 'Toque 9 — último intento',     9,
  '[{"type":"Call","detail":"Llamar o reenviar mensaje (último intento)"},{"type":"Follow-up","detail":"Seguimiento"}]'::jsonb, 15, '15 días', NULL, false),
 ('sr_10', 'sin_respuesta', 'Cerrar prospecto',            10,
  '[{"type":"Reconnect","detail":"Cerrar prospecto — sin respuesta tras 9 intentos"}]'::jsonb, 0, NULL, 'Closed Lost', true);

-- ── 5. Aristas ────────────────────────────────────────────────────

-- Respuestas iniciales (bloque "Contacto inicial" del Excel)
INSERT INTO crm_playbook_edges (from_node, response, to_node, sort_order) VALUES
 ('_root', 'acepta_reunion', 'ar_agendar',   1),
 ('_root', 'mas_adelante',   'ma_postergar', 2),
 ('_root', 'deriva',         'dv_referido',  3),
 ('_root', 'objecion',       'ob_responder', 4),
 ('_root', 'sin_respuesta',  'sr_1',         5);

-- Acepta reunión: Ok / Reagendar / Sin respuesta
INSERT INTO crm_playbook_edges (from_node, response, to_node, sort_order) VALUES
 ('ar_agendar',   'ok',            'ar_confirmar', 1),
 ('ar_agendar',   'reagendar',     'ar_reagendar', 2),
 ('ar_confirmar', 'ok',            'ar_realizar',  1),
 ('ar_confirmar', 'reagendar',     'ar_reagendar', 2),
 ('ar_confirmar', 'sin_respuesta', 'ar_sin_conf',  3),
 -- "Volver a Acción 1" del Excel (J14)
 ('ar_reagendar', 'ok',            'ar_agendar',   1),
 ('ar_reagendar', 'reagendar',     'ar_reagendar', 2),
 ('ar_reagendar', 'sin_respuesta', 'ar_sin_conf',  3),
 ('ar_sin_conf',  'ok',            'ar_confirmar', 1),
 ('ar_sin_conf',  'reagendar',     'ar_reagendar', 2),
 ('ar_sin_conf',  'sin_respuesta', 'ar_sin_conf',  3);

-- Más adelante: Ok pasa a "acepta reunión" (F17 del Excel) / Nueva postergación
INSERT INTO crm_playbook_edges (from_node, response, to_node, sort_order) VALUES
 ('ma_postergar',   'ok',                 'ar_agendar',     1),
 ('ma_postergar',   'nueva_postergacion', 'ma_repostergar', 2),
 ('ma_repostergar', 'ok',                 'ar_agendar',     1),
 ('ma_repostergar', 'nueva_postergacion', 'ma_repostergar', 2);

-- Objeción: Ok / Objeción / Sin respuesta
INSERT INTO crm_playbook_edges (from_node, response, to_node, sort_order) VALUES
 ('ob_responder', 'ok',            'ob_resuelta',  1),
 ('ob_responder', 'objecion',      'ob_reevaluar', 2),
 ('ob_responder', 'sin_respuesta', 'ob_sin_resp',  3),
 ('ob_reevaluar', 'ok',            'ob_resuelta',  1),
 ('ob_reevaluar', 'objecion',      'ob_cierre',    2),
 ('ob_reevaluar', 'sin_respuesta', 'ob_sin_resp',  3),
 ('ob_sin_resp',  'ok',            'ob_resuelta',  1),
 ('ob_sin_resp',  'objecion',      'ob_reevaluar', 2),
 ('ob_sin_resp',  'sin_respuesta', 'ob_cierre',    3);

-- Sin respuesta: cadena de 9 toques
INSERT INTO crm_playbook_edges (from_node, response, to_node, sort_order) VALUES
 ('sr_1', 'sin_respuesta', 'sr_2',  1),
 ('sr_2', 'sin_respuesta', 'sr_3',  1),
 ('sr_3', 'sin_respuesta', 'sr_4',  1),
 ('sr_4', 'sin_respuesta', 'sr_5',  1),
 ('sr_5', 'sin_respuesta', 'sr_6',  1),
 ('sr_6', 'sin_respuesta', 'sr_7',  1),
 ('sr_7', 'sin_respuesta', 'sr_8',  1),
 ('sr_8', 'sin_respuesta', 'sr_9',  1),
 ('sr_9', 'sin_respuesta', 'sr_10', 1);

-- ── 6. Motor: navega el grafo y crea las tareas del nodo ──────────
CREATE OR REPLACE FUNCTION crm_apply_playbook()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cur_node text;
  nxt_key  text;
  n        crm_playbook_nodes%ROWTYPE;
  t        jsonb;
BEGIN
  IF NEW.response_type IS NULL OR NEW.response_type = '' THEN
    RETURN NEW;
  END IF;

  SELECT playbook_node INTO cur_node FROM prospects WHERE id = NEW.prospect_id;

  -- Arista desde el nodo actual
  SELECT to_node INTO nxt_key FROM crm_playbook_edges
    WHERE from_node = COALESCE(cur_node, '_root') AND response = NEW.response_type;

  -- La respuesta no pertenece al vocabulario del nodo (el cliente hizo algo
  -- inesperado): arrancamos esa rama desde cero en vez de ignorarlo.
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

  -- Una tarea por cada entrada del nodo (el Excel tiene 2-3 por paso)
  FOR t IN SELECT * FROM jsonb_array_elements(n.tasks) LOOP
    INSERT INTO crm_tasks (prospect_id, interaction_id, task_type, priority, status, due_date, notes)
    VALUES (
      NEW.prospect_id,
      NEW.id,
      t->>'type',
      'Medium',
      'Pending',
      CURRENT_DATE + COALESCE(n.days_offset, 0),
      (t->>'detail')
        || CASE WHEN n.alert_label IS NOT NULL THEN '  ⚠ ' || n.alert_label ELSE '' END
        || CASE WHEN NEW.response_detail IS NOT NULL AND NEW.response_detail <> '' THEN '  · ' || NEW.response_detail ELSE '' END
    );
  END LOOP;

  UPDATE prospects SET
    response_type   = NEW.response_type,
    playbook_node   = n.node_key,
    playbook_step   = n.position,
    status          = COALESCE(n.sets_status, status),
    reconnect_month = CASE
      WHEN n.close_months IS NOT NULL
      THEN to_char(CURRENT_DATE + (n.close_months || ' months')::interval, 'YYYY-MM')
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

-- ── 7. Limpieza de la v1 ──────────────────────────────────────────
DROP TABLE IF EXISTS crm_playbook_steps;
