export type Status = 'backlog' | 'todo' | 'doing' | 'review' | 'done';
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

export interface Comment {
  id: string;
  task_id: string;
  user_id: string;
  content: string;
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
