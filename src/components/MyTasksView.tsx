'use client';
import { Clock } from 'lucide-react';
import { STATUSES, PEOPLE, getProject, fmtDate, dueClass } from '@/lib/data';
import type { Task, Project } from '@/lib/types';

interface Props {
  tasks: Task[];
  projects: Project[];
  onOpenTask: (task: Task) => void;
}

const PRIORITY_COLORS: Record<string, string> = {
  urgent: 'oklch(0.58 0.18 25)',
  high:   'oklch(0.65 0.14 50)',
  med:    'oklch(0.62 0.05 250)',
  low:    'oklch(0.62 0.02 250)',
};

export function MyTasksView({ tasks, onOpenTask }: Props) {
  const me = PEOPLE[0];
  const myTasks = tasks.filter(t => t.assignees.includes(me.id));

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const overdue = myTasks.filter(t => t.due && t.status !== 'done' && new Date(t.due + 'T00:00:00') < today);

  const grouped = STATUSES.map(s => ({
    ...s,
    items: myTasks.filter(t => t.status === s.id),
  })).filter(g => g.items.length > 0);

  return (
    <div className="p-6 max-w-[860px]">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-[24px] font-bold tracking-tight" style={{ color: 'var(--ink)' }}>
          Mis tareas
        </h1>
        <p className="text-[14px] mt-1" style={{ color: 'var(--ink-3)' }}>
          {myTasks.filter(t => t.status !== 'done').length} activas
          {overdue.length > 0 && (
            <span className="ml-2 font-medium" style={{ color: 'var(--danger)' }}>
              · {overdue.length} atrasada{overdue.length > 1 ? 's' : ''}
            </span>
          )}
        </p>
      </div>

      <div className="flex flex-col gap-6">
        {grouped.map(group => (
          <section key={group.id}>
            {/* Group header */}
            <div className="flex items-center gap-2 mb-2">
              <span className="w-2 h-2 rounded-full" style={{ background: group.tone }} />
              <span className="text-[12px] font-semibold uppercase tracking-wider" style={{ color: 'var(--ink-3)' }}>
                {group.label}
              </span>
              <span
                className="text-[11px] px-[7px] py-px rounded-full tabular-nums"
                style={{ background: 'var(--bg-3)', color: 'var(--ink-4)' }}
              >
                {group.items.length}
              </span>
            </div>

            {/* Task rows */}
            <div
              className="rounded-[10px] overflow-hidden"
              style={{ border: '1px solid var(--line)', background: 'var(--surface)' }}
            >
              {group.items.map((task, i) => {
                const proj = getProject(task.project);
                const dueCls = dueClass(task.due, task.status);
                return (
                  <button
                    key={task.id}
                    onClick={() => onOpenTask(task)}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors text-[13px]"
                    style={{
                      borderTop: i > 0 ? '1px solid var(--line)' : 'none',
                      background: 'transparent',
                      color: 'var(--ink)',
                    }}
                  >
                    <span
                      className="w-[8px] h-[8px] rounded-full flex-shrink-0"
                      style={{ background: PRIORITY_COLORS[task.priority] }}
                    />
                    <span
                      className="w-[8px] h-[8px] rounded-[2px] flex-shrink-0"
                      style={{ background: proj?.color }}
                    />
                    <span className="flex-1 truncate font-medium">{task.title}</span>
                    <span
                      className="text-[11px] flex-shrink-0"
                      style={{ fontFamily: 'var(--font-mono)', color: 'var(--ink-4)' }}
                    >
                      {task.ref}
                    </span>
                    <span className="text-[11px] w-[80px] text-right flex-shrink-0 truncate" style={{ color: 'var(--ink-3)' }}>
                      {proj?.name}
                    </span>
                    {task.due && (
                      <span className={`flex items-center gap-1 text-[11px] w-[72px] justify-end flex-shrink-0 ${dueCls}`}>
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

        {myTasks.length === 0 && (
          <div className="py-16 text-center" style={{ color: 'var(--ink-4)' }}>
            <div className="text-[32px] mb-2">✓</div>
            <div className="text-[14px]">Sin tareas asignadas</div>
          </div>
        )}
      </div>
    </div>
  );
}
