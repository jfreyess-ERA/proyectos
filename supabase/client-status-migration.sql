-- Reemplaza el booleano abierto/cerrado por un estado con motivo: un cliente
-- puede terminar su relación de tres formas distintas (contrato cumplido,
-- cancelado, o simplemente en pausa) y eso importa para saber qué pasó.
--
-- "Detenido" es el único de los tres que NO oculta al cliente del selector de
-- nueva tarea — puede volver a activarse en cualquier momento y a veces hay
-- que cargar algo puntual mientras está en pausa. "Terminado" y "Cancelado"
-- sí lo ocultan, igual que el "cerrado" de antes.

ALTER TABLE clients ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';
ALTER TABLE clients DROP CONSTRAINT IF EXISTS clients_status_check;
ALTER TABLE clients ADD CONSTRAINT clients_status_check
  CHECK (status IN ('active', 'completed', 'cancelled', 'paused'));

-- Backfill: los que ya estaban cerrados con el modelo viejo (active=false)
-- pasan a "completed" por defecto — es la reclasificación más común, y queda
-- editable uno por uno desde la vista de Clientes si corresponde otra cosa.
UPDATE clients SET status = 'completed' WHERE active = false AND status = 'active';

ALTER TABLE clients DROP COLUMN IF EXISTS active;
