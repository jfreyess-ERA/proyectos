-- Phase milestone dates on projects, loaded from the tracking sheet
-- (SEGUIMIENTO PROYECTOS ERA.xlsx). Enables real per-phase duration stats
-- (see PhaseDurationView / "Tiempos por fase").

alter table projects
  add column if not exists kickoff_date        date,
  add column if not exists situacion_date      date,
  add column if not exists opciones_date       date,
  add column if not exists implementacion_date date,
  add column if not exists seguimiento_date    date;
