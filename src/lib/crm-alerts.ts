import type { CrmTask, Prospect } from './types';

/** Estados en los que una tarea CRM sigue pidiendo acción. */
const OPEN_STATUSES = new Set(['Pending', 'In Progress', 'Waiting']);

/** Vencimiento efectivo de una tarea CRM: due_at trae la hora, due_date es el respaldo. */
export function taskDue(task: CrmTask): Date | null {
  if (task.due_at) return new Date(task.due_at);
  if (task.due_date) return new Date(task.due_date + 'T23:59:59');
  return null;
}

/** Tareas CRM abiertas cuyo vencimiento ya pasó. */
export function overdueCrmTasks(tasks: CrmTask[], now: Date = new Date()): CrmTask[] {
  return tasks
    .filter(t => OPEN_STATUSES.has(t.status))
    .filter(t => { const d = taskDue(t); return d !== null && d < now; })
    .sort((a, b) => (taskDue(a)!.getTime() - taskDue(b)!.getTime()));
}

/** Tareas CRM abiertas que vencen hoy. */
export function crmTasksDueToday(tasks: CrmTask[], now: Date = new Date()): CrmTask[] {
  const start = new Date(now); start.setHours(0, 0, 0, 0);
  const end = new Date(start); end.setDate(end.getDate() + 1);
  return tasks
    .filter(t => OPEN_STATUSES.has(t.status))
    .filter(t => { const d = taskDue(t); return d !== null && d >= start && d < end; });
}

/**
 * Prospectos dormidos que ya deberían haber vuelto al ruedo. En condiciones
 * normales queda vacío porque crm_reactivate_due() los despierta al cargar el
 * CRM; sirve de red por si la reactivación no llegó a correr.
 */
export function dueForReactivation(prospects: Prospect[], now: Date = new Date()): Prospect[] {
  const today = new Date(now); today.setHours(0, 0, 0, 0);
  return prospects.filter(p => {
    if (p.status !== 'Dormant') return false;
    const iso = p.reconnect_at ?? (p.reconnect_month ? `${p.reconnect_month}-01` : null);
    return iso !== null && new Date(iso + 'T00:00:00') <= today;
  });
}
