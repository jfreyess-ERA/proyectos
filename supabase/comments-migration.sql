-- Comments table for tasks
CREATE TABLE IF NOT EXISTS task_comments (
  id          uuid primary key default gen_random_uuid(),
  task_id     uuid not null references tasks(id) on delete cascade,
  user_id     text not null,
  content     text not null,
  created_at  timestamptz default now()
);

ALTER TABLE task_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow all" ON task_comments FOR ALL USING (true) WITH CHECK (true);
