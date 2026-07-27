'use client';
import { AlertTriangle, Clock, Eye, UserX } from 'lucide-react';
import { fmtDate, dueClass } from '@/lib/data';
import { AvatarStack } from './Avatar';
import type { Task, Project } from '@/lib/types';

interface Props {
  tasks: Task[];
  projects: Project[];
  onOpenTask: (task: Task) => void;
}

interface Section {
  id: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  items: Task[];
  accent: string;
  bg: string;
}

export function InboxView({ tasks, projects, onOpenTask }: Props) {
  const today = new Date(); today.setHours(0, 0, 0, 0);

  const overdue = tasks.filter(t =>
    t.status !== 'done' && t.due && new Date(t.due + 'T00:00:00') < today
  );
  const inReview = tasks.filter(t => t.status === 'review');
  const unassigned = tasks.filter(t => t.assignees.length === 0 && t.status !== 'done');
  const dueToday = tasks.filter(t => {
    if (!t.due || t.status === 'done') return false;
    return new Date(t.due + 'T00:00:00').getTime() === today.getTime();
  });

  const sections: Section[] = [
    {
      id: 'overdue',
      icon: <AlertTriangle size={14} />,
      title: 'Atrasadas',
      description: 'Tareas con fecha límite vencida',
      items: overdue,
      accent: 'var(--danger)',
      bg: 'var(--danger-bg)',
    },
    {
      id: 'today',
      icon: <Clock size={14} />,
      title: 'Vencen hoy',
      description: 'Fecha límite es hoy',
      items: dueToday,
      accent: 'var(--warn)',
      bg: 'oklch(0.97 0.03 60)',
    },
    {
      id: 'review',
      icon: <Eye size={14} />,
      title: 'Esperando revisión',
      description: 'Tareas en estado "En revisión"',
      items: inReview,
      accent: 'oklch(0.68 0.13 38)',
      bg: 'oklch(0.97 0.02 38)',
    },
    {
      id: 'unassigned',
      icon: <UserX size={14} />,
      title: 'Sin asignar',
      description: 'Tareas activas sin responsable',
      items: unassigned,
      accent: 'var(--ink-3)',
      bg: 'var(--bg-2)',
    },
  ].filter(s => s.items.length > 0);

  const total = overdue.length + dueToday.length + inReview.length + unassigned.length;

  return (
    <div className="p-6 max-w-[860px]">
      <div className="mb-6">
        <h1 className="text-[24px] font-bold tracking-tight" style={{ color: 'var(--ink)' }}>
          Bandeja
        </h1>
        <p className="text-[14px] mt-1" style={{ color: 'var(--ink-3)' }}>
          {total} elemento{total !== 1 ? 's' : ''} que requieren atención
        </p>
      </div>

      {total === 0 && (
        <div className="py-16 text-center" style={{ color: 'var(--ink-4)' }}>
          <div className="text-[32px] mb-2">📭</div>
          <div className="text-[14px]">Todo al día. Sin pendientes.</div>
        </div>
      )}

      <div className="flex flex-col gap-5">
        {sections.map(section => (
          <section key={section.id}>
            <div
              className="flex items-center gap-2 px-3 py-2 rounded-t-[10px] border-b"
              style={{ background: section.bg, borderColor: 'var(--line)', color: section.accent }}
            >
              {section.icon}
              <span className="text-[13px] font-semibold">{section.title}</span>
              <span
                className="ml-auto text-[11px] px-[7px] py-px rounded-full tabular-nums font-medium"
                style={{ background: 'rgba(0,0,0,.08)', color: section.accent }}
              >
                {section.items.length}
              </span>
            </div>
            <div
              className="rounded-b-[10px] overflow-hidden"
              style={{ border: '1px solid var(--line)', borderTop: 'none', background: 'var(--surface)' }}
            >
              {section.items.map((task, i) => {
                const proj = projects.find(p => p.id === task.project);
                const dueCls = dueClass(task.due, task.status);
                return (
                  <button
                    key={task.id}
                    onClick={() => onOpenTask(task)}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left text-[13px] transition-colors"
                    style={{
                      borderTop: i > 0 ? '1px solid var(--line)' : 'none',
                      background: 'transparent',
                      color: 'var(--ink)',
                    }}
                  >
                    <span className="w-[8px] h-[8px] rounded-[2px] flex-shrink-0" style={{ background: proj?.color }} />
                    <span className="flex-1 truncate font-medium">{task.title}</span>
                    <span className="text-[11px] flex-shrink-0 truncate max-w-[160px]" style={{ color: 'var(--ink-4)' }}>
                      {proj?.client && `${proj.client} · `}{proj?.name}
                    </span>
                    <span className="text-[11px] flex-shrink-0" style={{ fontFamily: 'var(--font-mono)', color: 'var(--ink-4)' }}>
                      {task.ref}
                    </span>
                    <AvatarStack userIds={task.assignees} max={2} />
                    {task.due && (
                      <span className={`flex items-center gap-1 text-[11px] flex-shrink-0 ${dueCls}`}>
                        <Clock size={11} />
                        {fmtDate(task.due, { relative: true })}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
