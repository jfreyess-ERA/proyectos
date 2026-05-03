-- ─────────────────────────────────────────────────────────────────
-- Norte — Schema + Seed
-- Pegar completo en Supabase → SQL Editor → Run
-- ─────────────────────────────────────────────────────────────────

-- ── Tablas ────────────────────────────────────────────────────────

create table if not exists users (
  id        text primary key,
  name      text not null,
  role      text,
  initials  text,
  hue       integer
);

create table if not exists projects (
  id       text primary key,
  name     text not null,
  key      text,
  color    text,
  favorite boolean default false
);

create table if not exists labels (
  id   text primary key,
  text text not null,
  bg   text,
  fg   text
);

create table if not exists tasks (
  id              text primary key,
  ref             text,
  project_id      text references projects(id) on delete cascade,
  title           text not null,
  description     text,
  status          text check (status in ('backlog','todo','doing','review','done')),
  priority        text check (priority in ('urgent','high','med','low')),
  assignees       text[]  default '{}',
  label_ids       text[]  default '{}',
  start_date      date,
  due_date        date,
  estimate        integer default 0,
  spent           integer default 0,
  subtasks_done   integer default 0,
  subtasks_total  integer default 0,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

-- ── RLS ───────────────────────────────────────────────────────────
alter table users    enable row level security;
alter table projects enable row level security;
alter table labels   enable row level security;
alter table tasks    enable row level security;

-- Acceso público de lectura (sin auth por ahora)
create policy "read_all" on users    for select using (true);
create policy "read_all" on projects for select using (true);
create policy "read_all" on labels   for select using (true);
create policy "read_all" on tasks    for select using (true);

-- Escritura pública (para demo — restringir con auth en producción)
create policy "write_all" on tasks for all using (true) with check (true);

-- ── Trigger updated_at ────────────────────────────────────────────
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

create trigger tasks_updated_at
  before update on tasks
  for each row execute function set_updated_at();

-- ─────────────────────────────────────────────────────────────────
-- SEED
-- ─────────────────────────────────────────────────────────────────

insert into users (id, name, role, initials, hue) values
  ('u1','Ana Mendoza',    'Product Lead', 'AM', 14),
  ('u2','Bruno Carrillo', 'Diseño',       'BC', 220),
  ('u3','Carla Restrepo', 'Frontend',     'CR', 160),
  ('u4','Diego Salgado',  'Backend',      'DS', 280),
  ('u5','Elena Vargas',   'QA',           'EV', 38),
  ('u6','Federico Núñez', 'Estrategia',   'FN', 340),
  ('u7','Gabriela Soto',  'Diseño',       'GS', 190),
  ('u8','Hugo Pérez',     'Frontend',     'HP', 100)
on conflict (id) do nothing;

insert into projects (id, name, key, color, favorite) values
  ('p1','Rediseño portal cliente',   'PORT','oklch(0.62 0.16 265)', true),
  ('p2','App móvil iOS v3',          'iOS', 'oklch(0.66 0.14 160)', true),
  ('p3','Onboarding B2B',            'ONB', 'oklch(0.68 0.13 38)',  false),
  ('p4','Sistema de diseño 2.0',     'DS',  'oklch(0.60 0.14 340)', true),
  ('p5','Migración infraestructura', 'INF', 'oklch(0.55 0.05 250)', false)
on conflict (id) do nothing;

insert into labels (id, text, bg, fg) values
  ('l1','Descubrimiento','oklch(0.94 0.04 265)','oklch(0.40 0.12 265)'),
  ('l2','Diseño',        'oklch(0.94 0.04 340)','oklch(0.40 0.12 340)'),
  ('l3','Frontend',      'oklch(0.94 0.04 160)','oklch(0.38 0.10 160)'),
  ('l4','Backend',       'oklch(0.94 0.04 280)','oklch(0.40 0.12 280)'),
  ('l5','QA',            'oklch(0.94 0.04 38)', 'oklch(0.40 0.10 38)'),
  ('l6','Bloqueante',    'oklch(0.94 0.04 25)', 'oklch(0.42 0.14 25)'),
  ('l7','Documentación', 'oklch(0.95 0.01 250)','oklch(0.40 0.02 250)'),
  ('l8','Investigación', 'oklch(0.94 0.04 220)','oklch(0.40 0.12 220)')
on conflict (id) do nothing;

-- Fechas relativas a hoy para que el demo siempre luzca actual
insert into tasks (
  id, ref, project_id, title, status, priority,
  assignees, label_ids,
  start_date, due_date, estimate, spent, subtasks_done, subtasks_total
) values
  ('t1', 'PORT-101','p1','Auditoría de heurísticas en flujo de pagos',        'done',   'high',   '{u1,u6}','{l1,l8}', current_date-12, current_date-5,  8,  9, 5,5),
  ('t2', 'PORT-104','p1','Wireframes pantalla principal del portal',           'done',   'high',   '{u2}',   '{l2}',    current_date-10, current_date-3,  12,14, 7,7),
  ('t3', 'PORT-110','p1','Hi-fi del dashboard del cliente',                    'doing',  'urgent', '{u2,u7}','{l2}',    current_date-4,  current_date+2,  16, 6, 2,6),
  ('t4', 'PORT-112','p1','Componente "Resumen de contrato"',                   'doing',  'high',   '{u3}',   '{l3}',    current_date-2,  current_date+4,  10, 3, 1,4),
  ('t5', 'PORT-115','p1','Validación de formulario con backend',               'review', 'med',    '{u3,u4}','{l3,l4}', current_date-6,  current_date-1,  6,  7, 3,3),
  ('t6', 'PORT-118','p1','Tests E2E del flujo de alta',                        'todo',   'med',    '{u5}',   '{l5}',    current_date+2,  current_date+8,  8,  0, 0,5),
  ('t7', 'PORT-121','p1','Migración de tabla de transacciones',                'todo',   'urgent', '{u4}',   '{l4,l6}', current_date+3,  current_date+7,  12, 0, 0,4),
  ('t8', 'PORT-125','p1','Documentación API pública v2',                       'backlog','low',    '{u4}',   '{l7,l4}', current_date+10, current_date+20, 5,  0, 0,3),
  ('t9', 'iOS-014', 'p2','Investigación: notificaciones push v2',              'done',   'med',    '{u6}',   '{l1,l8}', current_date-15, current_date-8,  6,  6, 3,3),
  ('t10','iOS-022', 'p2','Pantalla de perfil rediseñada',                      'doing',  'high',   '{u7}',   '{l2}',    current_date-3,  current_date+3,  10, 4, 2,5),
  ('t11','iOS-027', 'p2','Animación de transición entre tabs',                 'review', 'med',    '{u8,u7}','{l3,l2}', current_date-5,  current_date,    5,  5, 2,2),
  ('t12','iOS-031', 'p2','Refactor del modelo de sesión',                      'doing',  'urgent', '{u4}',   '{l4,l6}', current_date-1,  current_date+5,  14, 5, 1,4),
  ('t13','iOS-035', 'p2','QA regresión iOS 17',                                'todo',   'high',   '{u5}',   '{l5}',    current_date+4,  current_date+9,  7,  0, 0,6),
  ('t14','iOS-038', 'p2','Onboarding biométrico (Face ID)',                    'backlog','med',    '{}',     '{l1}',    current_date+12, current_date+22, 9,  0, 0,0),
  ('t15','ONB-005', 'p3','Mapa de empatía: cliente B2B',                       'done',   'med',    '{u1,u6}','{l1}',    current_date-20, current_date-13, 4,  4, 2,2),
  ('t16','ONB-009', 'p3','Flujo de invitación multi-cuenta',                   'doing',  'high',   '{u2,u3}','{l2,l3}', current_date-2,  current_date+6,  12, 5, 2,5),
  ('t17','ONB-012', 'p3','Estado vacío: cero proyectos',                       'todo',   'low',    '{u7}',   '{l2}',    current_date+5,  current_date+10, 3,  0, 0,2),
  ('t18','DS-040',  'p4','Tokens de color v2',                                 'done',   'high',   '{u2}',   '{l2,l7}', current_date-22, current_date-15, 8,  9, 4,4),
  ('t19','DS-046',  'p4','Componente Tabla con virtualización',                'doing',  'high',   '{u8}',   '{l3}',    current_date-6,  current_date+2,  14, 9, 3,5),
  ('t20','DS-049',  'p4','Documentar variantes de Botón',                      'review', 'med',    '{u2,u8}','{l7,l2}', current_date-4,  current_date,    4,  4, 3,3),
  ('t21','DS-052',  'p4','Componente DatePicker accesible',                    'todo',   'med',    '{u3}',   '{l3}',    current_date+3,  current_date+11, 12, 0, 0,5),
  ('t22','DS-058',  'p4','Auditoría de contraste WCAG 2.2',                    'backlog','low',    '{u5}',   '{l5,l7}', current_date+14, current_date+20, 6,  0, 0,0),
  ('t23','INF-007', 'p5','Migrar storage a S3 multirregión',                   'doing',  'urgent', '{u4}',   '{l4,l6}', current_date-3,  current_date+4,  16, 7, 1,4),
  ('t24','INF-010', 'p5','Pipeline CI con caché distribuida',                  'todo',   'high',   '{u4,u8}','{l4}',    current_date+5,  current_date+12, 10, 0, 0,3)
on conflict (id) do nothing;
