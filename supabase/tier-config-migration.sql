create table if not exists viability_tier_config (
  id text primary key default 'default',
  high_volume_amount numeric not null default 100000000,
  high_savings_pct numeric not null default 10,
  quick_win_feas_min integer not null default 4,
  low_vol_feas_min integer not null default 3,
  updated_at timestamptz default now()
);
insert into viability_tier_config (id) values ('default') on conflict do nothing;
alter table viability_tier_config enable row level security;
create policy "auth read tier config" on viability_tier_config for select to authenticated using (true);
create policy "auth write tier config" on viability_tier_config for all to authenticated using (true) with check (true);
