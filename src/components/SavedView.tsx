'use client';
import { Clock } from 'lucide-react';
import { getProject, fmtDate, dueClass, getLabel } from '@/lib/data';
import { AvatarStack } from './Avatar';
import type { Task, Project } from '@/lib/types';

interface Props {
  title: string;
  description: string;
  tasks: Task[];
  projects: Project[];
  onOpenTask: (task: Task) => void;
}

export function SavedView({ title, description, tasks, projects, onOpenTask }: Props) {
  return (
    <div className="p-6 max-w-[860px]">
      <div className="mb-6">
        <h1 className="text-[24px] font-bold tracking-tight" style={{ color: 'var(--ink)' }}>{title}</h1>
        <p className="text-[14px] mt-1" style={{ color: 'var(--ink-3)' }}>
          {description} · <span className="font-medium">{tasks.length} tarea{tasks.length !== 1 ? 's' : ''}</span>
        </p>
      </div>

      {tasks.length === 0 ? (
        <div className="py-16 text-center" style={{ color: 'var(--ink-4)' }}>
          <div className="text-[32px] mb-2">✓</div>
          <div className="text-[14px]">Sin tareas en esta vista</div>
        </div>
      ) : (
        <div
          className="rounded-[12px] overflow-hidden"
          style={{ border: '1px solid var(--line)', background: 'var(--surface)' }}
        >
          {tasks.map((task, i) => {
            const proj = projects.find(p => p.id === task.project) ?? getProject(task.project);
            const dueCls = dueClass(task.due, task.status);
            const labels = task.labels.map(id => getLabel(id)).filter(Boolean);
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
                {labels.slice(0, 2).map(l => l && (
                  <span
                    key={l.id}
                    className="hidden sm:inline-flex items-center h-5 px-2 rounded-[4px] text-[11px] font-medium flex-shrink-0"
                    style={{ background: l.bg, color: l.fg }}
                  >
                    {l.text}
                  </span>
                ))}
                <span className="text-[11px] flex-shrink-0" style={{ fontFamily: 'var(--font-mono)', color: 'var(--ink-4)' }}>
                  {task.ref}
                </span>
                <span className="text-[11px] w-[80px] text-right flex-shrink-0 truncate" style={{ color: 'var(--ink-3)' }}>
                  {proj?.name}
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
      )}
    </div>
  );
}
