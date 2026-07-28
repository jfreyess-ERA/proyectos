-- CRM — reactivación de prospectos dormidos
--
-- Cuando la cadencia cierra temporalmente un prospecto (objeción persistente:
-- "Cerrar temporalmente · 12 meses") queda en Dormant con una fecha de recontacto.
-- Hasta ahora esa fecha se guardaba y nadie la miraba: el prospecto se perdía.
--
-- crm_reactivate_due() los despierta: crea la tarea de retomar contacto y los
-- devuelve al pipeline. Es idempotente — se puede llamar todas las veces que
-- haga falta sin duplicar tareas — así que la app la invoca al cargar el CRM.
--
-- Correr en el SQL Editor de Supabase.

CREATE OR REPLACE FUNCTION crm_reactivate_due()
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r record;
  n int := 0;
BEGIN
  FOR r IN
    SELECT
      id,
      -- Los prospectos viejos sólo tienen reconnect_month (YYYY-MM).
      COALESCE(reconnect_at, to_date(reconnect_month || '-01', 'YYYY-MM-DD')) AS due_on
    FROM prospects
    WHERE status = 'Dormant'
      AND COALESCE(reconnect_at, to_date(reconnect_month || '-01', 'YYYY-MM-DD')) <= CURRENT_DATE
  LOOP
    -- No duplicar si ya hay una reactivación abierta de una corrida anterior.
    IF NOT EXISTS (
      SELECT 1 FROM crm_tasks
      WHERE prospect_id = r.id
        AND task_type = 'Reconnect'
        AND status IN ('Pending', 'In Progress', 'Waiting')
        AND notes LIKE 'Reactivar —%'
    ) THEN
      INSERT INTO crm_tasks (prospect_id, task_type, priority, status, due_date, due_at, notes)
      VALUES (
        r.id, 'Reconnect', 'High', 'Pending', CURRENT_DATE, now(),
        'Reactivar — llegó la fecha de recontacto (' || to_char(r.due_on, 'DD-MM-YYYY') || ')'
      );
    END IF;

    -- Vuelve al pipeline con la cadencia limpia: la próxima respuesta arranca de cero.
    UPDATE prospects SET
      status          = 'Nurture',
      playbook_node   = NULL,
      playbook_step   = 0,
      response_type   = NULL,
      reconnect_at    = NULL,
      reconnect_month = NULL,
      updated_at      = now()
    WHERE id = r.id;

    n := n + 1;
  END LOOP;

  RETURN n;
END;
$$;

GRANT EXECUTE ON FUNCTION crm_reactivate_due() TO authenticated;
