-- CRM — agendar la reactivación de dormidos
--
-- crm_reactivate_due() ya se invoca desde la app cada vez que se carga el CRM.
-- Esto la agrega además como job diario, para que corra aunque nadie entre a la
-- app (por ejemplo, si querés que las tareas de reactivación estén creadas antes
-- de que alguien abra su bandeja a la mañana).
--
-- La función es idempotente, así que que corran las dos vías no duplica nada.
--
-- Correr en el SQL Editor de Supabase (después de crm-reactivation-migration.sql).

CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Re-agendar limpio: cron.schedule con el mismo nombre no siempre reemplaza.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'crm-reactivate-due') THEN
    PERFORM cron.unschedule('crm-reactivate-due');
  END IF;
END $$;

-- 11:00 UTC ≈ 07:00 en Chile — la reactivación queda hecha antes de la jornada.
-- El job corre como postgres y la función es SECURITY DEFINER, así que va calificada
-- con el esquema porque el search_path del job no incluye public.
SELECT cron.schedule(
  'crm-reactivate-due',
  '0 11 * * *',
  $job$SELECT public.crm_reactivate_due()$job$
);
