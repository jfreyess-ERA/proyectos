import { supabase } from './supabase';
import type { Task, Project, User, Label, Comment, Activity, Notification, Attachment } from './types';

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
}

// ── Mappers ────────────────────────────────────────────────────────

function rowToTask(row: TaskRow): Task {
  return {
    id:          row.id,
    ref:         row.ref,
    project:     row.project_id,
    title:       row.title,
    description: row.description,
    status:      row.status as Task['status'],
    priority:    row.priority as Task['priority'],
    assignees:   row.assignees ?? [],
    labels:      row.label_ids ?? [],
    start:       row.start_date,
    due:         row.due_date,
    estimate:    row.estimate,
    spent:       row.spent,
    subtasks:    { done: row.subtasks_done, total: row.subtasks_total },
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
    start_date: string | null;
    due_date: string | null;
    description: string;
    estimate: number;
    spent: number;
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

export async function insertProject(input: { name: string; key: string; color: string }): Promise<Project> {
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
  fields: Partial<{ name: string; color: string; favorite: boolean }>
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
