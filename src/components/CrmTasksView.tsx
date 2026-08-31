'use client';
import { useState } from 'react';
import { ListChecks } from 'lucide-react';
import { updateCrmTask, deleteCrmTask } from '@/lib/db';
import { EmptyState } from './EmptyState';
import type { CrmTask, Prospect } from '@/lib/types';

interface Props {
  crmTasks: CrmTask[];
  prospects: Prospect[];
  onOpenProspect: (p: Prospect) => void;
  onTasksChanged: () => void;
}

const STATUS_TABS = ['Todos', 'Pending', 'In Progress', 'Waiting', 'Done', 'Deferred', 'Cancelled'];

function fmtDate(d?: string): string {
  if (!d) return '—';
  const date = new Date(d + 'T12:00:00');
  const today2 = new Date(); today2.setHours(0, 0, 0, 0);
  const diff = Math.round((date.getTime() - today2.getTime()) / 86400000);
  if (diff === 0) return 'Hoy';
  if (diff === 1) return 'Mañana';
  if (diff < 0) return `Vencida ${-diff}d`;
  return date.toLocaleDateString('es-CL', { day: 'numeric', month: 'short' });
}

export function CrmTasksView({ crmTasks, prospects, onOpenProspect, onTasksChanged }: Props) {
  const [statusFilter, setStatusFilter] = useState('Pending');
  const today = new Date().toISOString().slice(0, 10);

  const prospectMap = Object.fromEntries(prospects.map(p => [p.id, p]));

  const filtered = crmTasks.filter(t => {
    if (statusFilter === 'Todos') return true;
    return t.status === statusFilter;
  }).sort((a, b) => {
    if (!a.due_date && !b.due_date) return 0;
    if (!a.due_date) return 1;
    if (!b.due_date) return -1;
    return a.due_date.localeCompare(b.due_date);
  });

  const overdueCount = crmTasks.filter(t =>
    (t.status === 'Pending' || t.status === 'In Progress') && t.due_date && t.due_date < today
  ).length;

  const todayCount = crmTasks.filter(t =>
    (t.status === 'Pending' || t.status === 'In Progress') && t.due_date === today
  ).length;

  async function toggleDone(task: CrmTask) {
    const newStatus = task.status === 'Done' ? 'Pending' : 'Done';
    await updateCrmTask(task.id, { status: newStatus, completed_date: newStatus === 'Done' ? today : undefined });
    onTasksChanged();
  }

  async function handleDelete(id: string) {
    await deleteCrmTask(id);
    onTasksChanged();
  }

  return (
    <div className="p-6 max-w-[900px]">
      <div className="mb-4">
        <h1 className="text-[22px] font-bold tracking-tight" style={{ color: 'var(--ink)' }}>Tareas CRM</h1>
        <div className="flex items-center gap-4 mt-1">
          <p className="text-[13px]" style={{ color: 'var(--ink-3)' }}>
            {crmTasks.filter(t => t.status === 'Pending' || t.status === 'In Progress').length} pendientes
          </p>
          {overdueCount > 0 && (
            <span className="text-[12px] font-medium px-2 py-[2px] rounded-full" style={{ background: 'var(--sem-red-bg)', color: 'var(--sem-red-dark)' }}>
              {overdueCount} vencidas
            </span>
          )}
          {todayCount > 0 && (
            <span className="text-[12px] font-medium px-2 py-[2px] rounded-full" style={{ background: 'var(--sem-blue-bg)', color: 'var(--sem-blue-dark)' }}>
              {todayCount} para hoy
            </span>
          )}
        </div>
      </div>

      {/* Status filter */}
      <div className="flex gap-[3px] mb-5 flex-wrap">
        {STATUS_TABS.map(tab => (
          <button
            key={tab}
            onClick={() => setStatusFilter(tab)}
            className="h-7 px-3 rounded-[6px] text-[12px] border-0 transition-colors"
            style={{
              background: statusFilter === tab ? 'var(--accent)' : 'var(--bg-3)',
              color: statusFilter === tab ? 'var(--on-accent)' : 'var(--ink-2)',
              fontWeight: statusFilter === tab ? 600 : 400,
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Tasks list */}
      <div className="flex flex-col gap-2">
        {filtered.length === 0 && (
          crmTasks.length === 0 ? (
            <EmptyState
              icon={<ListChecks size={26} />}
              title="Todavía no hay tareas de seguimiento"
              hint="Las tareas se generan solas al registrar respuestas en un prospecto (la cadencia), o podés crearlas a mano."
            />
          ) : (
            <EmptyState
              icon={<ListChecks size={26} />}
              title={`Ninguna tarea en “${statusFilter === 'Todos' ? 'todas' : statusFilter}”`}
              hint="Probá con otro estado en las pestañas de arriba."
              compact
            />
          )
        )}
        {filtered.map(task => {
          const prospect = prospectMap[task.prospect_id];
          const isDone = task.status === 'Done';
          const isOverdue = !isDone && task.due_date && task.due_date < today;
          const isToday = task.due_date === today;

          return (
            <div
              key={task.id}
              className="rounded-[10px] p-4 flex items-start gap-3"
              style={{
                background: 'var(--surface)',
                border: `1px solid ${isOverdue ? 'var(--sem-red-border)' : 'var(--line)'}`,
                boxShadow: 'var(--shadow-1)',
              }}
            >
              {/* Checkbox */}
              <button
                onClick={() => toggleDone(task)}
                className="w-[18px] h-[18px] rounded-[4px] border flex items-center justify-center flex-shrink-0 mt-[2px] transition-colors"
                style={{
                  borderColor: isDone ? 'var(--sem-green)' : isOverdue ? 'var(--sem-red)' : 'var(--line)',
                  background: isDone ? 'var(--sem-green)' : 'transparent',
                  color: 'white',
                }}
              >
                {isDone && <span style={{ fontSize: 10 }}>✓</span>}
              </button>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className="text-[13px] font-medium"
                    style={{ color: isDone ? 'var(--ink-4)' : 'var(--ink)', textDecoration: isDone ? 'line-through' : 'none' }}
                  >
                    {task.task_type ?? 'Tarea CRM'}
                  </span>

                  {prospect && (
                    <button
                      onClick={() => onOpenProspect(prospect)}
                      className="text-[12px] px-2 py-[1px] rounded-[4px] border-0 transition-colors"
                      style={{ background: 'var(--bg-3)', color: 'var(--ink-2)' }}
                    >
                      {prospect.company}
                    </button>
                  )}

                  {task.due_date && (
                    <span
                      className="text-[11px]"
                      style={{
                        color: isOverdue ? 'var(--sem-red)' : isToday ? 'var(--sem-blue)' : 'var(--ink-4)',
                        fontWeight: isOverdue || isToday ? 600 : 400,
                      }}
                    >
                      📅 {fmtDate(task.due_date)}
                    </span>
                  )}

                  {task.priority && task.priority !== 'Medium' && (
                    <span
                      className="text-[10px] px-[5px] py-[1px] rounded-full"
                      style={{
                        background: task.priority === 'High' ? 'var(--sem-red-bg)' : 'var(--sem-blue-bg)',
                        color: task.priority === 'High' ? 'var(--sem-red-dark)' : 'var(--sem-blue-dark)',
                      }}
                    >
                      {task.priority}
                    </span>
                  )}
                </div>

                {task.notes && (
                  <div className="mt-1 text-[12px]" style={{ color: 'var(--ink-3)' }}>{task.notes}</div>
                )}
              </div>

              {/* Delete */}
              <button
                onClick={() => handleDelete(task.id)}
                className="flex-shrink-0 border-0 bg-transparent opacity-0 group-hover:opacity-100 transition-opacity"
                style={{ color: 'var(--ink-4)' }}
                onMouseEnter={e => e.currentTarget.style.color = 'var(--sem-red)'}
                onMouseLeave={e => e.currentTarget.style.color = 'var(--ink-4)'}
              >
                ×
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
