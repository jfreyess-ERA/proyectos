-- Viabilidad: clasificación ERA por línea de gasto
-- Permite asignar la categoría ERA a cada gasto individualmente (una por una),
-- en vez de heredarla siempre de la categoría del cliente.
-- Correr en el SQL Editor de Supabase.

ALTER TABLE viability_expenses
  ADD COLUMN IF NOT EXISTS era_id text;

-- Nota: era_id guarda el id de viability_era_categories cuando la línea
-- tiene una clasificación propia. Si está NULL, la línea hereda el ERA
-- de su categoría de cliente (comportamiento anterior).
