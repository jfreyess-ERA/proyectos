import { supabase } from './supabase';
import type { Task, Project, User, Label, Comment, Activity, Notification, Attachment, SubtaskItem, DatedSubtask, Sprint, Prospect, CrmInteraction, CrmTask, CrmTrigger, EmailTemplate, PlaybookNode, PlaybookEdge } from './types';

// ── Row types from Supabase ────────────────────────────────────────

interface TaskRow {
  id: string;
  ref: string;
  project_id: string;
  title: string;
  description?: string;
  status: string;
  priority: string;
  assignees: string[];
  label_ids: string[];
  start_date: string;
  due_date: string;
  estimate: number;
  spent: number;
  subtasks_done: number;
  subtasks_total: number;
  subtasks_overdue?: number;
  sprint_id?: string;
  project_stage?: string;
}

// ── Mappers ────────────────────────────────────────────────────────

export function taskRowToTask(row: TaskRow): Task {
  return rowToTask(row);
}

function rowToTask(row: TaskRow): Task {
  return {
    id:            row.id,
    ref:           row.ref,
    project:       row.project_id,
    title:         row.title,
    description:   row.description,
    status:        row.status as Task['status'],
    priority:      row.priority as Task['priority'],
    assignees:     row.assignees ?? [],
    labels:        row.label_ids ?? [],
    start:         row.start_date,
    due:           row.due_date,
    estimate:      row.estimate,
    spent:         row.spent,
    subtasks:      { done: row.subtasks_done, total: row.subtasks_total, overdue: row.subtasks_overdue ?? 0 },
    sprint_id:     row.sprint_id,
    project_stage: row.project_stage as Task['project_stage'],
  };
}

// ── Queries ────────────────────────────────────────────────────────

export async function fetchTasks(): Promise<Task[]> {
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .order('ref');
  if (error) throw error;
  return (data as TaskRow[]).map(rowToTask);
}

export async function fetchProjects(): Promise<Project[]> {
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .order('name');
  if (error) throw error;
  return data as Project[];
}

export async function fetchUsers(): Promise<User[]> {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .order('name');
  if (error) throw error;
  return data as User[];
}

export async function fetchLabels(): Promise<Label[]> {
  const { data, error } = await supabase
    .from('labels')
    .select('*');
  if (error) throw error;
  return data as Label[];
}

// ── Mutations ──────────────────────────────────────────────────────

export async function updateTaskStatus(taskId: string, status: Task['status']) {
  const { error } = await supabase
    .from('tasks')
    .update({ status })
    .eq('id', taskId);
  if (error) throw error;
}

export async function deleteTask(id: string): Promise<void> {
  const { error } = await supabase.from('tasks').delete().eq('id', id);
  if (error) throw error;
}

export interface NewTaskInput {
  title: string;
  project_id: string;
  status: Task['status'];
  priority: Task['priority'];
  assignees: string[];
  due_date?: string;
  description?: string;
}

export async function updateTask(
  id: string,
  fields: Partial<{
    title: string;
    status: Task['status'];
    priority: Task['priority'];
    assignees: string[];
    label_ids: string[];
    start_date: string | null;
    due_date: string | null;
    description: string;
    estimate: number;
    spent: number;
    subtasks_done: number;
    subtasks_total: number;
    project_stage: Task['project_stage'] | null;
  }>
): Promise<Task> {
  const { data, error } = await supabase
    .from('tasks')
    .update(fields)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return rowToTask(data as TaskRow);
}

export async function insertProject(input: { name: string; key: string; color: string; client?: string }): Promise<Project> {
  const { data, error } = await supabase
    .from('projects')
    .insert({ id: crypto.randomUUID(), ...input, favorite: false })
    .select()
    .single();
  if (error) throw error;
  return data as Project;
}

export async function updateProject(
  id: string,
  fields: Partial<{ name: string; color: string; favorite: boolean; client: string | null }>
): Promise<void> {
  const { error } = await supabase.from('projects').update(fields).eq('id', id);
  if (error) throw error;
}

export async function deleteProject(id: string): Promise<void> {
  const { error } = await supabase.from('projects').delete().eq('id', id);
  if (error) throw error;
}

export async function fetchComments(taskId: string): Promise<Comment[]> {
  const { data, error } = await supabase
    .from('task_comments')
    .select('*')
    .eq('task_id', taskId)
    .order('created_at');
  if (error) throw error;
  return data as Comment[];
}

export async function insertComment(taskId: string, userId: string, content: string): Promise<Comment> {
  const { data, error } = await supabase
    .from('task_comments')
    .insert({ task_id: taskId, user_id: userId, content })
    .select()
    .single();
  if (error) throw error;
  return data as Comment;
}

// ── Activity ───────────────────────────────────────────────────────

export async function logActivity(taskId: string, userId: string, action: string): Promise<void> {
  await supabase.from('task_activity').insert({ task_id: taskId, user_id: userId, action });
}

export async function fetchActivity(taskId: string): Promise<Activity[]> {
  const { data } = await supabase
    .from('task_activity')
    .select('*')
    .eq('task_id', taskId)
    .order('created_at', { ascending: false })
    .limit(20);
  return (data ?? []) as Activity[];
}

// ── Notifications ──────────────────────────────────────────────────

export async function fetchNotifications(userId: string): Promise<Notification[]> {
  const { data } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(30);
  return (data ?? []) as Notification[];
}

export async function markNotificationsRead(ids: string[]): Promise<void> {
  if (!ids.length) return;
  await supabase.from('notifications').update({ read: true }).in('id', ids);
}

export async function createNotification(
  userId: string, type: string, taskId: string, message: string
): Promise<void> {
  await supabase.from('notifications').insert({ user_id: userId, type, task_id: taskId, message });
}

// ── Attachments ────────────────────────────────────────────────────

export async function fetchAttachments(taskId: string): Promise<Attachment[]> {
  const { data } = await supabase
    .from('task_attachments')
    .select('*')
    .eq('task_id', taskId)
    .order('created_at');
  return (data ?? []) as Attachment[];
}

export async function uploadAttachment(taskId: string, userId: string, file: File): Promise<Attachment> {
  const ext = file.name.split('.').pop();
  const path = `tasks/${taskId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

  const { error: uploadError } = await supabase.storage.from('attachments').upload(path, file);
  if (uploadError) throw uploadError;

  const { data: { publicUrl } } = supabase.storage.from('attachments').getPublicUrl(path);

  const { data, error } = await supabase
    .from('task_attachments')
    .insert({ task_id: taskId, user_id: userId, name: file.name, url: publicUrl, storage_path: path, size: file.size })
    .select()
    .single();
  if (error) throw error;
  return data as Attachment;
}

export async function deleteAttachment(id: string, storagePath: string): Promise<void> {
  await supabase.storage.from('attachments').remove([storagePath]);
  await supabase.from('task_attachments').delete().eq('id', id);
}

export async function insertTask(input: NewTaskInput): Promise<Task> {
  // derive ref from project key + random suffix
  const { data: proj } = await supabase
    .from('projects')
    .select('key')
    .eq('id', input.project_id)
    .single();

  const ref = `${proj?.key ?? 'T'}-${Math.floor(Math.random() * 900) + 100}`;

  const { data, error } = await supabase
    .from('tasks')
    .insert({
      id:          crypto.randomUUID(),
      ref,
      project_id:  input.project_id,
      title:       input.title,
      status:      input.status,
      priority:    input.priority,
      assignees:   input.assignees,
      label_ids:   [],
      due_date:    input.due_date ?? null,
      description: input.description ?? null,
      estimate:    0,
      spent:       0,
      subtasks_done:  0,
      subtasks_total: 0,
    })
    .select()
    .single();

  if (error) throw error;
  return rowToTask(data as TaskRow);
}

// ── Subtasks ───────────────────────────────────────────────────────

export async function fetchSubtasks(taskId: string): Promise<SubtaskItem[]> {
  const { data } = await supabase
    .from('task_subtasks')
    .select('*')
    .eq('task_id', taskId)
    .order('position');
  return (data ?? []) as SubtaskItem[];
}

/** All subtasks that have a due_date, across every task — feeds calendars, "atrasadas" and Mis tareas. */
export async function fetchDatedSubtasks(): Promise<DatedSubtask[]> {
  const { data } = await supabase
    .from('task_subtasks')
    .select('id, task_id, title, done, due_date, assignee')
    .not('due_date', 'is', null);
  return (data ?? []) as DatedSubtask[];
}

async function syncSubtaskCounts(taskId: string): Promise<void> {
  const { data } = await supabase
    .from('task_subtasks')
    .select('done, due_date')
    .eq('task_id', taskId);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const todayISO = today.toISOString().slice(0, 10);
  const total = data?.length ?? 0;
  const done  = data?.filter(s => s.done).length ?? 0;
  const overdue = data?.filter(s => !s.done && s.due_date && s.due_date < todayISO).length ?? 0;
  await supabase.from('tasks').update({ subtasks_done: done, subtasks_total: total, subtasks_overdue: overdue }).eq('id', taskId);
}

export async function updateSubtask(
  subtaskId: string,
  taskId: string,
  fields: Partial<{ title: string; due_date: string | null; assignee: string | null }>,
): Promise<void> {
  await supabase.from('task_subtasks').update(fields).eq('id', subtaskId);
  await syncSubtaskCounts(taskId);
}

export async function insertSubtask(taskId: string, title: string): Promise<SubtaskItem> {
  const { data: existing } = await supabase
    .from('task_subtasks')
    .select('position')
    .eq('task_id', taskId)
    .order('position', { ascending: false })
    .limit(1);
  const position = existing?.length ? (existing[0] as { position: number }).position + 1 : 0;

  const { data, error } = await supabase
    .from('task_subtasks')
    .insert({ task_id: taskId, title, done: false, position })
    .select()
    .single();
  if (error) throw error;
  await syncSubtaskCounts(taskId);
  return data as SubtaskItem;
}

export async function toggleSubtask(subtaskId: string, done: boolean, taskId: string): Promise<void> {
  await supabase.from('task_subtasks').update({ done }).eq('id', subtaskId);
  await syncSubtaskCounts(taskId);
}

export async function deleteSubtask(subtaskId: string, taskId: string): Promise<void> {
  await supabase.from('task_subtasks').delete().eq('id', subtaskId);
  await syncSubtaskCounts(taskId);
}

// ── Sprints ────────────────────────────────────────────────────────

export async function fetchSprints(projectId: string): Promise<Sprint[]> {
  const { data } = await supabase
    .from('sprints')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at');
  return (data ?? []) as Sprint[];
}

export async function fetchAllSprints(): Promise<Sprint[]> {
  const { data } = await supabase.from('sprints').select('*').order('created_at');
  return (data ?? []) as Sprint[];
}

export async function insertSprint(input: {
  project_id: string; name: string; goal?: string;
  start_date?: string; end_date?: string; status?: Sprint['status'];
}): Promise<Sprint> {
  const { data, error } = await supabase
    .from('sprints')
    .insert({ ...input, status: input.status ?? 'planned' })
    .select().single();
  if (error) throw error;
  return data as Sprint;
}

export async function updateSprint(id: string, fields: Partial<Omit<Sprint, 'id' | 'created_at'>>): Promise<void> {
  const { error } = await supabase.from('sprints').update(fields).eq('id', id);
  if (error) throw error;
}

export async function deleteSprint(id: string): Promise<void> {
  const { error } = await supabase.from('sprints').delete().eq('id', id);
  if (error) throw error;
}

export async function assignTaskToSprint(taskId: string, sprintId: string | null): Promise<void> {
  const { error } = await supabase.from('tasks').update({ sprint_id: sprintId }).eq('id', taskId);
  if (error) throw error;
}

// ── Project shares (client view) ──────────────────────────────────

export async function getOrCreateShare(projectId: string): Promise<string> {
  const { data: existing } = await supabase
    .from('project_shares')
    .select('token')
    .eq('project_id', projectId)
    .eq('active', true)
    .maybeSingle();
  if (existing?.token) return existing.token;

  const { data, error } = await supabase
    .from('project_shares')
    .insert({ project_id: projectId })
    .select('token').single();
  if (error) throw error;
  return data.token;
}

export async function revokeShare(projectId: string): Promise<void> {
  await supabase.from('project_shares').update({ active: false }).eq('project_id', projectId);
}

// ── Bulk task updates ─────────────────────────────────────────────

export async function bulkUpdateTasks(ids: string[], fields: Partial<{
  status: Task['status']; priority: Task['priority']; assignees: string[];
}>): Promise<void> {
  const dbFields: Record<string, unknown> = {};
  if ('status' in fields)   dbFields.status   = fields.status;
  if ('priority' in fields) dbFields.priority = fields.priority;
  if ('assignees' in fields) dbFields.assignees = fields.assignees;
  const { error } = await supabase.from('tasks').update(dbFields).in('id', ids);
  if (error) throw error;
}

// ── CRM: Prospects ────────────────────────────────────────────────

export async function fetchProspects(): Promise<Prospect[]> {
  const { data, error } = await supabase
    .from('prospects')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as Prospect[];
}

export async function insertProspect(input: Omit<Prospect, 'id' | 'created_at' | 'updated_at'>): Promise<Prospect> {
  const { data, error } = await supabase
    .from('prospects')
    .insert({ ...input })
    .select()
    .single();
  if (error) throw error;
  return data as Prospect;
}

export async function updateProspect(id: string, fields: Partial<Omit<Prospect, 'id' | 'created_at'>>): Promise<Prospect> {
  const { data, error } = await supabase
    .from('prospects')
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data as Prospect;
}

export async function deleteProspect(id: string): Promise<void> {
  const { error } = await supabase.from('prospects').delete().eq('id', id);
  if (error) throw error;
}

// ── CRM: Interactions ─────────────────────────────────────────────

export async function fetchInteractions(prospectId?: string): Promise<CrmInteraction[]> {
  let q = supabase.from('crm_interactions').select('*').order('date', { ascending: false });
  if (prospectId) q = q.eq('prospect_id', prospectId);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as CrmInteraction[];
}

export async function insertInteraction(input: Omit<CrmInteraction, 'id' | 'created_at'>): Promise<CrmInteraction> {
  const { data, error } = await supabase
    .from('crm_interactions')
    .insert({ ...input })
    .select()
    .single();
  if (error) throw error;
  return data as CrmInteraction;
}

export async function updateInteraction(id: string, fields: Partial<Omit<CrmInteraction, 'id' | 'created_at'>>): Promise<void> {
  const { error } = await supabase.from('crm_interactions').update(fields).eq('id', id);
  if (error) throw error;
}

export async function deleteInteraction(id: string): Promise<void> {
  const { error } = await supabase.from('crm_interactions').delete().eq('id', id);
  if (error) throw error;
}

// ── CRM: Tasks ────────────────────────────────────────────────────

export async function fetchCrmTasks(prospectId?: string): Promise<CrmTask[]> {
  let q = supabase.from('crm_tasks').select('*').order('due_date', { ascending: true });
  if (prospectId) q = q.eq('prospect_id', prospectId);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as CrmTask[];
}

export async function insertCrmTask(input: Omit<CrmTask, 'id' | 'created_at'>): Promise<CrmTask> {
  const { data, error } = await supabase
    .from('crm_tasks')
    .insert({ ...input })
    .select()
    .single();
  if (error) throw error;
  return data as CrmTask;
}

export async function updateCrmTask(id: string, fields: Partial<Omit<CrmTask, 'id' | 'created_at'>>): Promise<void> {
  const { error } = await supabase.from('crm_tasks').update(fields).eq('id', id);
  if (error) throw error;
}

export async function deleteCrmTask(id: string): Promise<void> {
  const { error } = await supabase.from('crm_tasks').delete().eq('id', id);
  if (error) throw error;
}

// ── CRM: Triggers ─────────────────────────────────────────────────

export async function fetchCrmTriggers(prospectId?: string): Promise<CrmTrigger[]> {
  let q = supabase.from('crm_triggers').select('*').order('date_detected', { ascending: false });
  if (prospectId) q = q.eq('prospect_id', prospectId);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as CrmTrigger[];
}

export async function insertCrmTrigger(input: Omit<CrmTrigger, 'id' | 'created_at'>): Promise<CrmTrigger> {
  const { data, error } = await supabase
    .from('crm_triggers')
    .insert({ ...input })
    .select()
    .single();
  if (error) throw error;
  return data as CrmTrigger;
}

export async function updateCrmTrigger(id: string, fields: Partial<Omit<CrmTrigger, 'id' | 'created_at'>>): Promise<void> {
  const { error } = await supabase.from('crm_triggers').update(fields).eq('id', id);
  if (error) throw error;
}

/** Relee un prospecto — el trigger del playbook le cambia el nodo/estado del lado del servidor. */
export async function fetchProspect(id: string): Promise<Prospect | null> {
  const { data, error } = await supabase.from('prospects').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return (data as Prospect) ?? null;
}

// ── CRM: Playbook (árbol de cadencia de seguimiento) ──────────────

/** Nodos y aristas del playbook. Es configuración: se lee una vez y se cachea en memoria. */
export async function fetchPlaybook(): Promise<{ nodes: PlaybookNode[]; edges: PlaybookEdge[] }> {
  const [{ data: nodes, error: ne }, { data: edges, error: ee }] = await Promise.all([
    supabase.from('crm_playbook_nodes').select('*').order('branch').order('position'),
    supabase.from('crm_playbook_edges').select('*').order('from_node').order('sort_order'),
  ]);
  if (ne) throw ne;
  if (ee) throw ee;
  return { nodes: (nodes ?? []) as PlaybookNode[], edges: (edges ?? []) as PlaybookEdge[] };
}

// ── CRM: Email Templates ──────────────────────────────────────────

export async function fetchEmailTemplates(): Promise<EmailTemplate[]> {
  const { data, error } = await supabase
    .from('email_templates')
    .select('*')
    .order('name');
  if (error) throw error;
  return (data ?? []) as EmailTemplate[];
}

export async function insertEmailTemplate(input: Omit<EmailTemplate, 'id' | 'created_at'>): Promise<EmailTemplate> {
  const { data, error } = await supabase
    .from('email_templates')
    .insert({ ...input })
    .select()
    .single();
  if (error) throw error;
  return data as EmailTemplate;
}

export async function updateEmailTemplate(id: string, fields: Partial<Omit<EmailTemplate, 'id' | 'created_at'>>): Promise<void> {
  const { error } = await supabase.from('email_templates').update(fields).eq('id', id);
  if (error) throw error;
}

export async function deleteEmailTemplate(id: string): Promise<void> {
  const { error } = await supabase.from('email_templates').delete().eq('id', id);
  if (error) throw error;
}
