-- Activity log
CREATE TABLE IF NOT EXISTS task_activity (
  id         uuid primary key default gen_random_uuid(),
  task_id    text not null references tasks(id) on delete cascade,
  user_id    text not null,
  action     text not null,
  created_at timestamptz default now()
);
ALTER TABLE task_activity ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow all" ON task_activity FOR ALL USING (true) WITH CHECK (true);

-- Notifications
CREATE TABLE IF NOT EXISTS notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    text not null,
  type       text not null,
  task_id    text references tasks(id) on delete cascade,
  message    text not null,
  read       boolean default false,
  created_at timestamptz default now()
);
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow all" ON notifications FOR ALL USING (true) WITH CHECK (true);

-- Attachments
CREATE TABLE IF NOT EXISTS task_attachments (
  id           uuid primary key default gen_random_uuid(),
  task_id      text not null references tasks(id) on delete cascade,
  user_id      text not null,
  name         text not null,
  url          text not null,
  storage_path text not null,
  size         integer,
  created_at   timestamptz default now()
);
ALTER TABLE task_attachments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow all" ON task_attachments FOR ALL USING (true) WITH CHECK (true);
