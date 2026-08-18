-- Capacidad semanal por persona, para comparar carga vs. disponibilidad en
-- el Panel del equipo. 40h por defecto (jornada completa); se ajusta por
-- persona en Configuración → Usuarios (medias jornadas, part-time, etc).

ALTER TABLE users ADD COLUMN IF NOT EXISTS weekly_capacity_hours integer NOT NULL DEFAULT 40;
