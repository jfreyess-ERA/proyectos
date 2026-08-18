-- Token secreto por persona para el feed .ics de solo lectura (suscripción de
-- calendario). La URL en sí es la credencial: nadie más que el dueño del link
-- puede leer su feed. No se expone por la API pública (RLS no aplica acá; la
-- ruta que lo sirve usa el service role, igual que /api/admin/users).

ALTER TABLE users ADD COLUMN IF NOT EXISTS calendar_token uuid NOT NULL DEFAULT gen_random_uuid();
