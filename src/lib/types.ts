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
}

export interface Project {
  id: string;
  name: string;
  key: string;
  color: string;
  favorite: boolean;
  client?: string;
}

export interface Subtasks {
  done: number;
  total: number;
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
