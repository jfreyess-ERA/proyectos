-- Fase 1: fecha límite + responsable en subtareas, y rollup de atrasadas en la tarea.
alter table task_subtasks
  add column if not exists due_date date,
  add column if not exists assignee uuid;

alter table tasks
  add column if not exists subtasks_overdue integer default 0;
