-- CRM Module Migration
-- Run this in your Supabase SQL editor

-- ── Prospectos ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS prospects (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company         text NOT NULL,
  contact_name    text,
  role            text,
  linkedin        text,
  email           text,
  phone           text,
  industry        text,
  subsector       text,
  country         text NOT NULL DEFAULT 'Chile',
  priority        text NOT NULL DEFAULT 'Medium',  -- High/Medium/Low/Strategic/Watchlist
  status          text NOT NULL DEFAULT 'Active',  -- Active/Warm/Paused/Nurture/Closed Won/Closed Lost/Dormant
  stage           text NOT NULL DEFAULT 'New',     -- New/Contacted/Meeting Requested/Meeting Held/Proposal/Negotiation/Won
  owner_id        uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  source          text,
  pain_points     text,
  era_value_angle text,
  trigger_notes   text,
  trigger_source  text,
  last_trigger_date date,
  reconnect_month text,
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE prospects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_prospects_select" ON prospects FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_prospects_insert" ON prospects FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth_prospects_update" ON prospects FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_prospects_delete" ON prospects FOR DELETE TO authenticated USING (true);

-- ── Interacciones CRM ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS crm_interactions (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_id        uuid NOT NULL REFERENCES prospects(id) ON DELETE CASCADE,
  date               date NOT NULL DEFAULT CURRENT_DATE,
  channel            text,            -- Email/LinkedIn/Phone/WhatsApp/Meeting/Event/Referral
  direction          text,            -- Inbound/Outbound
  type               text,            -- Intro email/Follow-up/Call/Meeting/etc.
  summary            text,
  outcome            text,            -- No response/Positive/Interested/Meeting booked/Not now/Lost
  next_step          text,
  follow_up_due      date,
  trigger_mentioned  boolean DEFAULT false,
  template_used      text,
  owner_id           uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at         timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE crm_interactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_interactions_select" ON crm_interactions FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_interactions_insert" ON crm_interactions FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth_interactions_update" ON crm_interactions FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_interactions_delete" ON crm_interactions FOR DELETE TO authenticated USING (true);

-- ── Tareas CRM ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS crm_tasks (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_id      uuid NOT NULL REFERENCES prospects(id) ON DELETE CASCADE,
  interaction_id   uuid REFERENCES crm_interactions(id) ON DELETE SET NULL,
  task_type        text,            -- Follow-up/Research/Send case study/Call/Meeting/Reconnect/Proposal
  priority         text DEFAULT 'Medium',
  status           text NOT NULL DEFAULT 'Pending',  -- Pending/In Progress/Waiting/Done/Deferred/Cancelled
  due_date         date,
  reminder_window  integer DEFAULT 1,
  notes            text,
  completed_date   date,
  owner_id         uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at       timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE crm_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_crm_tasks_select" ON crm_tasks FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_crm_tasks_insert" ON crm_tasks FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth_crm_tasks_update" ON crm_tasks FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_crm_tasks_delete" ON crm_tasks FOR DELETE TO authenticated USING (true);

-- ── Triggers ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS crm_triggers (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_id      uuid NOT NULL REFERENCES prospects(id) ON DELETE CASCADE,
  date_detected    date NOT NULL DEFAULT CURRENT_DATE,
  trigger_type     text,            -- News/Hiring/Expansion/Regulation/Leadership change/Earnings/Results
  description      text,
  source_url       text,
  priority         text DEFAULT 'Medium',
  action_suggested text,
  status           text NOT NULL DEFAULT 'Open',  -- Open/Monitoring/Closed
  created_at       timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE crm_triggers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_triggers_select" ON crm_triggers FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_triggers_insert" ON crm_triggers FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth_triggers_update" ON crm_triggers FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_triggers_delete" ON crm_triggers FOR DELETE TO authenticated USING (true);

-- ── Plantillas de email ───────────────────────────────────────────

CREATE TABLE IF NOT EXISTS email_templates (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL,
  use_case   text,
  subject    text,
  body       text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_templates_select" ON email_templates FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_templates_insert" ON email_templates FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth_templates_update" ON email_templates FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_templates_delete" ON email_templates FOR DELETE TO authenticated USING (true);

-- ── Índices ───────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_crm_interactions_prospect ON crm_interactions(prospect_id);
CREATE INDEX IF NOT EXISTS idx_crm_tasks_prospect ON crm_tasks(prospect_id);
CREATE INDEX IF NOT EXISTS idx_crm_tasks_status ON crm_tasks(status);
CREATE INDEX IF NOT EXISTS idx_crm_tasks_due_date ON crm_tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_crm_triggers_prospect ON crm_triggers(prospect_id);
CREATE INDEX IF NOT EXISTS idx_crm_triggers_status ON crm_triggers(status);
CREATE INDEX IF NOT EXISTS idx_prospects_status ON prospects(status);
CREATE INDEX IF NOT EXISTS idx_prospects_stage ON prospects(stage);

-- ── Seed: 4 plantillas base ───────────────────────────────────────

INSERT INTO email_templates (name, use_case, subject, body) VALUES
(
  'Intro Frío',
  'Primer contacto con prospecto sin relación previa',
  'Una pregunta rápida, [Nombre]',
  'Hola [Nombre],

Vi que [empresa] está [señal de negocio relevante] y pensé que podría ser un buen momento para conectar.

En ERA Group ayudamos a empresas como la suya a [propuesta de valor principal] — sin proyectos largos ni grandes inversiones iniciales.

¿Tiene 20 minutos esta semana para explorar si hay algo útil para su equipo?

Saludos,
[Tu nombre]'
),
(
  'Follow-up Post-Reunión',
  'Seguimiento tras una primera reunión o llamada',
  'Resumen y próximos pasos — [Empresa]',
  'Hola [Nombre],

Gracias por el tiempo hoy. Fue muy útil entender mejor los desafíos de [empresa] en [área].

Según lo conversado, los próximos pasos serían:
1. [Acción 1]
2. [Acción 2]

Le preparo una propuesta para [fecha]. Cualquier duda, quedo disponible.

Saludos,
[Tu nombre]'
),
(
  'Reactivación',
  'Retomar contacto con un prospecto inactivo',
  '[Nombre], ¿sigue vigente esto para [Empresa]?',
  'Hola [Nombre],

Han pasado algunos meses desde nuestra última conversación. He estado pensando en [empresa] porque [razón relevante / trigger].

¿Sigue siendo una prioridad para su equipo el tema de [dolor identificado]?

Si el timing cambió, no hay problema — solo quería asegurarme de no desaparecer sin saber si podemos ser de ayuda.

Saludos,
[Tu nombre]'
),
(
  'Envío de Caso de Éxito',
  'Compartir un caso relevante para generar interés',
  'Caso similar al de [Empresa] — resultados concretos',
  'Hola [Nombre],

Acabo de terminar un proyecto con [empresa similar / mismo sector] donde logramos [resultado específico] en [tiempo].

Creo que hay un paralelo claro con los desafíos que mencionó en [empresa]. Le adjunto el resumen ejecutivo.

¿Vale la pena revisar esto juntos en una llamada corta?

Saludos,
[Tu nombre]'
)
ON CONFLICT DO NOTHING;
