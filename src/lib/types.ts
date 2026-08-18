export type Status = 'backlog' | 'todo' | 'doing' | 'review' | 'done';
export type ProjectStage = 'situacion' | 'opciones' | 'implementacion' | 'seguimiento';
export type Priority = 'urgent' | 'high' | 'med' | 'low';

export interface User {
  id: string;
  name: string;
  role: string;
  initials: string;
  hue: number;
  email?: string;
  is_admin?: boolean;
  /** Horas disponibles por semana, para comparar contra la carga asignada. */
  weekly_capacity_hours?: number;
}

/**
 * Cliente con estado propio. Cerrar un cliente no borra nada: sus proyectos
 * dejan de ofrecerse al crear tareas, pero el histórico queda intacto.
 * La relación con projects es por nombre (projects.client = clients.name).
 */
export interface Client {
  name: string;
  active: boolean;
  closed_at?: string | null;
  created_at?: string;
}

export interface Project {
  id: string;
  name: string;
  key: string;
  color: string;
  favorite: boolean;
  client?: string;
  // Phase milestone dates (ISO yyyy-mm-dd) — loaded from the tracking sheet.
  kickoff_date?: string | null;
  situacion_date?: string | null;
  opciones_date?: string | null;
  implementacion_date?: string | null;
  seguimiento_date?: string | null;
}

export interface Subtasks {
  done: number;
  total: number;
  overdue?: number;
}

export interface Task {
  id: string;
  ref: string;
  project: string;
  title: string;
  status: Status;
  priority: Priority;
  assignees: string[];
  labels: string[];
  start: string;
  due: string;
  estimate: number;
  spent: number;
  subtasks: Subtasks;
  description?: string;
  sprint_id?: string;
  project_stage?: ProjectStage;
}

export interface Sprint {
  id: string;
  project_id: string;
  name: string;
  goal?: string;
  start_date?: string;
  end_date?: string;
  status: 'planned' | 'active' | 'completed';
  created_at: string;
}

export interface Activity {
  id: string;
  task_id: string;
  user_id: string;
  action: string;
  created_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  type: string;
  task_id: string;
  message: string;
  read: boolean;
  created_at: string;
}

/**
 * Alerta CRM mostrada en la campanita: no es una fila persistida en `notifications`
 * (no hay owner_id confiable por prospecto todavía — ver crm-alerts.ts), sino que
 * se deriva en vivo del mismo estado que ya usa la Bandeja. Por eso no tiene
 * "leído/no leído": siempre refleja el estado actual.
 */
export interface CrmAlert {
  id: string;
  kind: 'crm_overdue' | 'crm_reactivate';
  title: string;
  company: string;
  prospectId: string;
}

export interface Attachment {
  id: string;
  task_id: string;
  user_id: string;
  name: string;
  url: string;
  storage_path: string;
  size?: number;
  created_at: string;
}

export interface SubtaskItem {
  id: string;
  task_id: string;
  title: string;
  done: boolean;
  position: number;
  created_at: string;
  due_date?: string | null;
  assignee?: string | null;
}

/** Subtarea liviana (sin position/created_at) — base de calendarios y estadísticas. */
export interface SubtaskLite {
  id: string;
  task_id: string;
  title: string;
  done: boolean;
  due_date: string | null;
  assignee: string | null;
}

/** A subtask that has a due_date — used to surface subtasks in calendars, "atrasadas" and Mis tareas. */
export interface DatedSubtask {
  id: string;
  task_id: string;
  title: string;
  done: boolean;
  due_date: string;
  assignee: string | null;
}

export interface Comment {
  id: string;
  task_id: string;
  user_id: string;
  content: string;
  created_at: string;
}

// ── CRM ────────────────────────────────────────────────────────────

export type ProspectPriority = 'High' | 'Medium' | 'Low' | 'Strategic' | 'Watchlist';
export type ProspectStatus   = 'Active' | 'Warm' | 'Paused' | 'Nurture' | 'Closed Won' | 'Closed Lost' | 'Dormant';
export type ProspectStage    = 'New' | 'Contacted' | 'Meeting Requested' | 'Meeting Held' | 'Proposal' | 'Negotiation' | 'Won';

// Tipo de respuesta del prospecto — alimenta el motor de cadencia (playbook).
// Las 5 primeras son las respuestas iniciales del contacto; el resto sólo aparecen
// dentro de una rama (después de "acepta reunión" la pregunta es Ok/Reagendar, etc.).
export type ResponseType =
  | 'acepta_reunion' | 'mas_adelante' | 'deriva' | 'objecion' | 'sin_respuesta'
  | 'ok' | 'reagendar' | 'nueva_postergacion';

/** Las 5 respuestas con las que arranca cualquier cadencia (bloque "Contacto inicial"). */
export const INITIAL_RESPONSES: ResponseType[] = [
  'acepta_reunion', 'mas_adelante', 'deriva', 'objecion', 'sin_respuesta',
];

export const RESPONSE_LABELS: Record<ResponseType, string> = {
  acepta_reunion:     'Acepta reunión',
  mas_adelante:       'Más adelante',
  deriva:             'Deriva a otra persona',
  objecion:           'Objeción',
  sin_respuesta:      'Sin respuesta',
  ok:                 'Ok / confirma',
  reagendar:          'Reagendar',
  nueva_postergacion: 'Nueva postergación',
};

/** Una tarea que el nodo del playbook genera al entrar. */
export interface PlaybookTask {
  type: CrmTaskType;
  detail: string;
}

/**
 * Contra qué se mide el plazo del nodo:
 *  - 'now'       relativo a cuando se entra al nodo (la cadencia de toques)
 *  - 'meeting'   relativo a la reunión agendada (offsets negativos = antes)
 *  - 'reconnect' la fecha de recontacto que se haya pactado
 */
export type PlaybookAnchor = 'now' | 'meeting' | 'reconnect';

/** Nodo del árbol de cadencia: un estado con sus tareas, plazo y alerta. */
export interface PlaybookNode {
  node_key: string;
  branch: ResponseType;
  label: string;
  position: number;
  tasks: PlaybookTask[];
  anchor: PlaybookAnchor;
  offset_hours: number;
  alert_label?: string | null;
  close_months?: number | null;
  sets_status?: ProspectStatus | null;
  is_terminal: boolean;
}

/** Arista: la respuesta del prospecto que lleva de un nodo al siguiente. */
export interface PlaybookEdge {
  from_node: string;   // '_root' = las respuestas iniciales
  response: ResponseType;
  to_node: string;
  sort_order: number;
}

export interface Prospect {
  id: string;
  company: string;
  contact_name?: string;
  role?: string;
  linkedin?: string;
  email?: string;
  phone?: string;
  industry?: string;
  subsector?: string;
  country: string;
  priority: ProspectPriority;
  status: ProspectStatus;
  stage: ProspectStage;
  owner_id?: string;
  source?: string;
  pain_points?: string;
  era_value_angle?: string;
  trigger_notes?: string;
  trigger_source?: string;
  last_trigger_date?: string;
  reconnect_month?: string;
  notes?: string;
  project_id?: string;
  response_type?: ResponseType;   // última respuesta registrada (playbook)
  playbook_node?: string | null;  // nodo actual del árbol de cadencia
  playbook_step?: number;         // posición dentro de la rama (para "paso N de M")
  meeting_at?: string | null;     // reunión agendada — ancla de los plazos "antes de la reunión"
  reconnect_at?: string | null;   // fecha de recontacto pactada
  created_at: string;
  updated_at?: string;
}

export type InteractionChannel = 'Email' | 'LinkedIn' | 'Phone' | 'WhatsApp' | 'Meeting' | 'Event' | 'Referral';
export type InteractionOutcome = 'No response' | 'Positive' | 'Interested' | 'Meeting booked' | 'Not now' | 'Lost';

export interface CrmInteraction {
  id: string;
  prospect_id: string;
  date: string;
  channel?: InteractionChannel;
  direction?: 'Inbound' | 'Outbound';
  type?: string;
  summary?: string;
  outcome?: InteractionOutcome;
  next_step?: string;
  follow_up_due?: string;
  trigger_mentioned?: boolean;
  template_used?: string;
  owner_id?: string;
  response_type?: ResponseType;   // dispara el motor de cadencia (playbook)
  response_detail?: string;       // motivo de postergación / objeción / info de interés
  meeting_at?: string | null;     // fecha y hora de la reunión, al agendarla
  reconnect_at?: string | null;   // fecha de recontacto elegida al postergar
  created_at: string;
}

export type CrmTaskType   = 'Follow-up' | 'Research' | 'Send case study' | 'Call' | 'Meeting' | 'Reconnect' | 'Proposal';
export type CrmTaskStatus = 'Pending' | 'In Progress' | 'Waiting' | 'Done' | 'Deferred' | 'Cancelled';

export interface CrmTask {
  id: string;
  prospect_id: string;
  interaction_id?: string;
  task_type?: CrmTaskType;
  priority?: 'High' | 'Medium' | 'Low';
  status: CrmTaskStatus;
  due_date?: string;
  due_at?: string | null;   // vencimiento con hora (alertas del tipo "12 horas antes")
  reminder_window?: number;
  notes?: string;
  completed_date?: string;
  owner_id?: string;
  created_at: string;
}

export type TriggerType   = 'News' | 'Hiring' | 'Expansion' | 'Regulation' | 'Leadership change' | 'Earnings' | 'Results';
export type TriggerStatus = 'Open' | 'Monitoring' | 'Closed';

export interface CrmTrigger {
  id: string;
  prospect_id: string;
  date_detected: string;
  trigger_type?: TriggerType;
  description?: string;
  source_url?: string;
  priority?: 'High' | 'Medium' | 'Low';
  action_suggested?: string;
  status: TriggerStatus;
  created_at: string;
}

export interface EmailTemplate {
  id: string;
  name: string;
  use_case?: string;
  subject?: string;
  body?: string;
  created_at: string;
}

export interface Label {
  id: string;
  text: string;
  bg: string;
  fg: string;
}

export interface StatusDef {
  id: Status;
  label: string;
  tone: string;
}

export interface PriorityDef {
  id: Priority;
  label: string;
  tone: string;
}
