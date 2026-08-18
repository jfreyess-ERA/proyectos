-- Clientes abiertos / cerrados.
--
-- Hasta ahora "cliente" era sólo texto libre en projects.client. Esta tabla le da
-- estado propio para poder cerrar un cliente cuando termina la relación: sus
-- proyectos dejan de ofrecerse al crear tareas, pero nada se borra y el histórico
-- (tareas, estadísticas, tiempos por fase) queda intacto.
--
-- La relación es por nombre (projects.client = clients.name), sin FK, para no
-- romper proyectos con un cliente escrito a mano que todavía no esté en la tabla.

CREATE TABLE IF NOT EXISTS clients (
  name       text primary key,
  active     boolean not null default true,
  closed_at  timestamptz,
  created_at timestamptz default now()
);

ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow all" ON clients;
CREATE POLICY "allow all" ON clients FOR ALL USING (true) WITH CHECK (true);

-- Seed: todos los clientes que ya existen en projects arrancan abiertos.
INSERT INTO clients (name)
SELECT DISTINCT btrim(client)
FROM projects
WHERE client IS NOT NULL AND btrim(client) <> ''
ON CONFLICT (name) DO NOTHING;
