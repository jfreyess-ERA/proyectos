'use client';
import { useState } from 'react';
import { Clock } from 'lucide-react';
import { STATUSES, PEOPLE, fmtDate, dueClass } from '@/lib/data';
import { useAuth } from '@/lib/auth-context';
import { updateTaskStatus } from '@/lib/db';
import { CalendarView } from './CalendarView';
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

type ViewMode = 'list' | 'calendar-month' | 'calendar-week';

export function MyTasksView({ tasks, projects, onOpenTask }: Props) {
  const { profile } = useAuth();
  const me = profile ?? PEOPLE[0];
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [statusOverrides, setStatusOverrides] = useState<Record<string, Task['status']>>({});

  function effectiveStatus(t: Task): Task['status'] {
    return statusOverrides[t.id] ?? t.status;
  }

  function handleStatusChange(taskId: string, status: Task['status']) {
    setStatusOverrides(prev => ({ ...prev, [taskId]: status }));
    updateTaskStatus(taskId, status).catch(console.error);
  }

  const myTasks = tasks.filter(t => t.assignees.includes(me.id));

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const overdue = myTasks.filter(t => t.due && effectiveStatus(t) !== 'done' && new Date(t.due + 'T00:00:00') < today);

  const grouped = STATUSES.map(s => ({
    ...s,
    items: myTasks.filter(t => effectiveStatus(t) === s.id),
  })).filter(g => g.items.length > 0);

  const isCalendar = viewMode !== 'list';

  return (
    <div className={isCalendar ? 'flex flex-col h-full' : 'p-6 max-w-[860px]'}>
      {/* Header */}
      <div className={isCalendar ? 'px-6 pt-6 pb-3 flex items-start justify-between flex-wrap gap-3' : 'mb-6 flex items-start justify-between flex-wrap gap-3'}>
        <div>
          <h1 className="text-[24px] font-bold tracking-tight" style={{ color: 'var(--ink)' }}>
            Mis tareas
          </h1>
          <p className="text-[14px] mt-1" style={{ color: 'var(--ink-3)' }}>
            {myTasks.filter(t => effectiveStatus(t) !== 'done').length} activas
            {overdue.length > 0 && (
              <span className="ml-2 font-medium" style={{ color: 'var(--danger)' }}>
                · {overdue.length} atrasada{overdue.length > 1 ? 's' : ''}
              </span>
            )}
          </p>
        </div>

        {/* View toggle */}
        <div className="inline-flex rounded-[8px] border overflow-hidden" style={{ borderColor: 'var(--line)' }}>
          <ViewTab active={viewMode === 'list'}           onClick={() => setViewMode('list')}>Lista</ViewTab>
          <ViewTab active={viewMode === 'calendar-week'}  onClick={() => setViewMode('calendar-week')} border>Calendario · Semana</ViewTab>
          <ViewTab active={viewMode === 'calendar-month'} onClick={() => setViewMode('calendar-month')} border>Calendario · Mes</ViewTab>
        </div>
      </div>

      {viewMode === 'calendar-week' && (
        <div className="flex-1 min-h-0">
          <CalendarView tasks={myTasks} onOpenTask={onOpenTask} viewMode="week" />
        </div>
      )}
      {viewMode === 'calendar-month' && (
        <div className="flex-1 min-h-0">
          <CalendarView tasks={myTasks} onOpenTask={onOpenTask} viewMode="month" />
        </div>
      )}

      {viewMode === 'list' && (
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
                  const proj = projects.find(p => p.id === task.project);
                  const dueCls = dueClass(task.due, task.status);
                  const status = effectiveStatus(task);
                  return (
                    <div
                      key={task.id}
                      onClick={() => onOpenTask(task)}
                      className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors text-[13px] cursor-pointer"
                      style={{
                        borderTop: i > 0 ? '1px solid var(--line)' : 'none',
                        background: 'transparent',
                        color: 'var(--ink)',
                      }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-2)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
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
                        className="text-[11px] flex-shrink-0 hidden md:inline"
                        style={{ fontFamily: 'var(--font-mono)', color: 'var(--ink-4)' }}
                      >
                        {task.ref}
                      </span>
                      <span className="text-[11px] w-[160px] text-right flex-shrink-0 truncate hidden sm:inline" style={{ color: 'var(--ink-3)' }}>
                        {proj?.client && `${proj.client} · `}{proj?.name}
                      </span>
                      <select
                        value={status}
                        onClick={e => e.stopPropagation()}
                        onChange={e => handleStatusChange(task.id, e.target.value as Task['status'])}
                        className="flex-shrink-0 h-[26px] pl-2 pr-1 rounded-[6px] text-[11.5px] font-medium border outline-none cursor-pointer"
                        style={{
                          background: 'var(--bg-2)',
                          borderColor: 'var(--line)',
                          color: STATUSES.find(s => s.id === status)?.tone ?? 'var(--ink-2)',
                          fontFamily: 'var(--font)',
                        }}
                      >
                        {STATUSES.map(s => (
                          <option key={s.id} value={s.id}>{s.label}</option>
                        ))}
                      </select>
                      {task.due && (
                        <span className={`flex items-center gap-1 text-[11px] w-[72px] justify-end flex-shrink-0 hidden lg:flex ${dueCls}`}>
                          <Clock size={11} />
                          {fmtDate(task.due, { relative: true })}
                        </span>
                      )}
                    </div>
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
      )}
    </div>
  );
}

function ViewTab({ active, onClick, children, border }: { active: boolean; onClick: () => void; children: React.ReactNode; border?: boolean }) {
  return (
    <button
      onClick={onClick}
      className="h-8 px-3 text-[12.5px] font-medium border-0 transition-colors"
      style={{
        background: active ? 'var(--surface)' : 'transparent',
        color: active ? 'var(--ink)' : 'var(--ink-3)',
        boxShadow: active ? 'var(--shadow-1)' : 'none',
        borderLeft: border ? '1px solid var(--line)' : undefined,
      }}
    >
      {children}
    </button>
  );
}
