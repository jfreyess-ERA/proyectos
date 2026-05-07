-- ── Sprints ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sprints (
  id          uuid primary key default gen_random_uuid(),
  project_id  text not null references projects(id) on delete cascade,
  name        text not null,
  goal        text,
  start_date  date,
  end_date    date,
  status      text not null default 'planned',
  created_at  timestamptz default now()
);

ALTER TABLE tasks ADD COLUMN IF NOT EXISTS sprint_id uuid references sprints(id) on delete set null;

ALTER TABLE sprints ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read sprints"   ON sprints FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "auth insert sprints" ON sprints FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "auth update sprints" ON sprints FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "auth delete sprints" ON sprints FOR DELETE USING (auth.role() = 'authenticated');

-- ── Project shares (vista cliente) ───────────────────────────────────
CREATE TABLE IF NOT EXISTS project_shares (
  id          uuid primary key default gen_random_uuid(),
  project_id  text not null references projects(id) on delete cascade,
  token       text unique not null default encode(gen_random_bytes(24), 'base64url'),
  active      boolean not null default true,
  created_at  timestamptz default now()
);

ALTER TABLE project_shares ENABLE ROW LEVEL SECURITY;
-- Authenticated users can manage shares
CREATE POLICY "auth manage shares" ON project_shares FOR ALL USING (auth.role() = 'authenticated');
-- Public can read active shares (needed for /share/[token] page via API)
CREATE POLICY "public read active shares" ON project_shares FOR SELECT USING (active = true);
