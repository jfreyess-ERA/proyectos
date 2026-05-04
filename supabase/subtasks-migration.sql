-- Subtareas reales por tarea
CREATE TABLE IF NOT EXISTS task_subtasks (
  id       uuid primary key default gen_random_uuid(),
  task_id  text not null references tasks(id) on delete cascade,
  title    text not null,
  done     boolean default false,
  position integer default 0,
  created_at timestamptz default now()
);

ALTER TABLE task_subtasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth all subtasks"
  ON task_subtasks FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');
