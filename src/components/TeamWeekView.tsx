'use client';
import { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, ChevronDown, Clock, Flag } from 'lucide-react';
import { avatarBg, fmtDate, dueClass } from '@/lib/data';
import type { Task, Project, User } from '@/lib/types';

interface Props {
  tasks: Task[];
  projects: Project[];
  users: User[];
  onOpenTask: (task: Task) => void;
  onOpenProject: (projectId: string) => void;
}

const PRIORITY_COLORS: Record<string, string> = {
  urgent: 'oklch(0.58 0.18 25)',
  high:   'oklch(0.65 0.14 50)',
  med:    'oklch(0.62 0.05 250)',
  low:    'oklch(0.62 0.02 250)',
};

const STATUS_LABELS: Record<string, string> = {
  backlog: 'Backlog',
  todo: 'Por hacer',
  doing: 'En curso',
  review: 'En revisión',
  done: 'Completado',
};

const STATUS_TONES: Record<string, string> = {
  backlog: 'oklch(0.55 0.02 250)',
  todo:    'oklch(0.55 0.05 250)',
  doing:   'oklch(0.62 0.16 265)',
  review:  'oklch(0.68 0.13 38)',
  done:    'oklch(0.60 0.14 160)',
};

function startOfWeek(d: Date): Date {
  const date = new Date(d);
  date.setHours(0, 0, 0, 0);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1); // Monday
  date.setDate(diff);
  return date;
}

function addDays(d: Date, n: number): Date {
  const date = new Date(d);
  date.setDate(date.getDate() + n);
  return date;
}

function fmtRange(monday: Date): string {
  const sunday = addDays(monday, 6);
  const sameMonth = monday.getMonth() === sunday.getMonth();
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: sameMonth ? undefined : 'short' };
  return `${monday.toLocaleDateString('es', opts)} — ${sunday.toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' })}`;
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function TeamWeekView({ tasks, projects, users, onOpenTask, onOpenProject }: Props) {
  const [weekStart, setWeekStart] = useState<Date>(() => startOfWeek(new Date()));
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [showEmpty, setShowEmpty]         = useState(false);

  const weekEnd = addDays(weekStart, 6);
  const weekStartISO = isoDate(weekStart);
  const weekEndISO = isoDate(weekEnd);
  const todayISO = isoDate(new Date());

  const rows = useMemo(() => {
    return users.map(u => {
      const mine = tasks.filter(t => t.assignees.includes(u.id));

      // active = doing / review / todo / backlog (i.e. not done)
      const active = mine.filter(t => t.status !== 'done');

      // due this week (any status except done)
      const dueThisWeek = active.filter(t => t.due && t.due >= weekStartISO && t.due <= weekEndISO);

      // overdue = due before weekStart, still active
      const overdue = active.filter(t => t.due && t.due < weekStartISO);

      // in progress (doing) — always show
      const inProgress = active.filter(t => t.status === 'doing');

      // pending = todo + review + backlog, not already counted in dueThisWeek/overdue
      const seenIds = new Set([...dueThisWeek, ...overdue, ...inProgress].map(t => t.id));
      const pending = active.filter(t => !seenIds.has(t.id) && (t.status === 'todo' || t.status === 'review' || t.status === 'backlog'));

      // completed this week
      const completedThisWeek = mine.filter(t => t.status === 'done' && t.due && t.due >= weekStartISO && t.due <= weekEndISO);

      return {
        user: u,
        overdue,
        dueThisWeek,
        inProgress: inProgress.filter(t => !dueThisWeek.some(x => x.id === t.id) && !overdue.some(x => x.id === t.id)),
        pending,
        completedThisWeek,
        activeCount: active.length,
      };
    });
  }, [users, tasks, weekStartISO, weekEndISO]);

  const visibleRows = showEmpty ? rows : rows.filter(r => r.activeCount > 0 || r.completedThisWeek.length > 0);

  const totalActive = rows.reduce((s, r) => s + r.activeCount, 0);
  const totalOverdue = rows.reduce((s, r) => s + r.overdue.length, 0);

  return (
    <div className="p-6 max-w-[1200px]">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-[24px] font-bold tracking-tight" style={{ color: 'var(--ink)' }}>
            Panel del equipo
          </h1>
          <p className="text-[14px] mt-1" style={{ color: 'var(--ink-3)' }}>
            {rows.length} personas · {totalActive} tareas activas
            {totalOverdue > 0 && (
              <span className="ml-2 font-medium" style={{ color: 'var(--danger)' }}>
                · {totalOverdue} atrasadas
              </span>
            )}
          </p>
        </div>

        {/* Week picker */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setWeekStart(w => addDays(w, -7))}
            className="w-8 h-8 flex items-center justify-center rounded-[7px] border transition-colors"
            style={{ background: 'var(--surface)', borderColor: 'var(--line)', color: 'var(--ink-2)' }}
            aria-label="Semana anterior"
          >
            <ChevronLeft size={15} />
          </button>
          <div
            className="h-8 px-3 flex items-center rounded-[7px] border text-[12.5px] font-medium"
            style={{ background: 'var(--surface)', borderColor: 'var(--line)', color: 'var(--ink)', minWidth: 220, justifyContent: 'center' }}
          >
            {fmtRange(weekStart)}
          </div>
          <button
            onClick={() => setWeekStart(w => addDays(w, 7))}
            className="w-8 h-8 flex items-center justify-center rounded-[7px] border transition-colors"
            style={{ background: 'var(--surface)', borderColor: 'var(--line)', color: 'var(--ink-2)' }}
            aria-label="Semana siguiente"
          >
            <ChevronRight size={15} />
          </button>
          <input
            type="date"
            value={weekStartISO}
            onChange={e => e.target.value && setWeekStart(startOfWeek(new Date(e.target.value + 'T00:00:00')))}
            className="h-8 px-2 rounded-[7px] border text-[12px] outline-none"
            style={{ background: 'var(--surface)', borderColor: 'var(--line)', color: 'var(--ink-2)' }}
          />
          <button
            onClick={() => setWeekStart(startOfWeek(new Date()))}
            className="h-8 px-3 rounded-[7px] border text-[12.5px] font-medium transition-colors"
            style={{ background: 'var(--surface)', borderColor: 'var(--line)', color: 'var(--ink-2)' }}
          >
            Hoy
          </button>
        </div>
      </div>

      {/* Toggle empty */}
      <div className="mb-4 flex items-center gap-3">
        <label className="flex items-center gap-2 text-[12px]" style={{ color: 'var(--ink-3)' }}>
          <input
            type="checkbox"
            checked={showEmpty}
            onChange={e => setShowEmpty(e.target.checked)}
          />
          Mostrar personas sin tareas activas
        </label>
      </div>

      {/* Rows */}
      <div className="flex flex-col gap-3">
        {visibleRows.map(row => {
          const isCollapsed = collapsed[row.user.id];
          const groups = [
            { key: 'overdue', title: 'Atrasadas', items: row.overdue, accent: 'var(--danger)' },
            { key: 'week', title: 'Vencen esta semana', items: row.dueThisWeek, accent: 'oklch(0.62 0.16 265)' },
            { key: 'doing', title: 'En curso', items: row.inProgress, accent: 'oklch(0.62 0.16 265)' },
            { key: 'pending', title: 'Pendientes', items: row.pending, accent: 'var(--ink-3)' },
            { key: 'done', title: 'Completadas esta semana', items: row.completedThisWeek, accent: 'oklch(0.60 0.14 160)' },
          ].filter(g => g.items.length > 0);

          return (
            <div
              key={row.user.id}
              className="rounded-[12px]"
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--line)',
                boxShadow: 'var(--shadow-1)',
              }}
            >
              {/* Header */}
              <button
                onClick={() => setCollapsed(c => ({ ...c, [row.user.id]: !c[row.user.id] }))}
                className="w-full flex items-center gap-3 px-5 py-4 text-left border-0 bg-transparent"
              >
                <ChevronDown
                  size={16}
                  style={{
                    color: 'var(--ink-3)',
                    flexShrink: 0,
                    transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)',
                    transition: 'transform 150ms',
                  }}
                />
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center text-white font-semibold text-[13px] flex-shrink-0"
                  style={{ background: avatarBg(row.user.hue) }}
                >
                  {row.user.initials}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[14px] font-semibold" style={{ color: 'var(--ink)' }}>{row.user.name}</div>
                  <div className="text-[12px]" style={{ color: 'var(--ink-3)' }}>{row.user.role}</div>
                </div>
                <div className="flex items-center gap-2 flex-wrap justify-end">
                  {row.overdue.length > 0 && (
                    <Pill color="var(--danger)" bg="var(--danger-bg)" label={`${row.overdue.length} atrasada${row.overdue.length > 1 ? 's' : ''}`} />
                  )}
                  {row.inProgress.length + row.dueThisWeek.filter(t => t.status === 'doing').length > 0 && (
                    <Pill color="oklch(0.42 0.14 265)" bg="oklch(0.94 0.03 265)" label={`${row.inProgress.length + row.dueThisWeek.filter(t => t.status === 'doing').length} en curso`} />
                  )}
                  {row.pending.length + row.dueThisWeek.filter(t => t.status !== 'doing').length > 0 && (
                    <Pill color="var(--ink-2)" bg="var(--bg-3)" label={`${row.pending.length + row.dueThisWeek.filter(t => t.status !== 'doing').length} pendientes`} />
                  )}
                  {row.completedThisWeek.length > 0 && (
                    <Pill color="oklch(0.42 0.12 160)" bg="oklch(0.94 0.03 160)" label={`${row.completedThisWeek.length} completada${row.completedThisWeek.length > 1 ? 's' : ''}`} />
                  )}
                  {row.activeCount === 0 && row.completedThisWeek.length === 0 && (
                    <span className="text-[12px]" style={{ color: 'var(--ink-4)' }}>Sin tareas en esta semana</span>
                  )}
                </div>
              </button>

              {/* Body */}
              {!isCollapsed && groups.length > 0 && (
                <div className="border-t px-5 py-4 flex flex-col gap-4" style={{ borderColor: 'var(--line)' }}>
                  {groups.map(group => (
                    <section key={group.key}>
                      <div className="text-[11px] font-semibold uppercase tracking-wider mb-2 flex items-center gap-2" style={{ color: group.accent }}>
                        {group.title}
                        <span className="text-[11px] px-[7px] py-px rounded-full tabular-nums" style={{ background: 'var(--bg-3)', color: 'var(--ink-4)' }}>
                          {group.items.length}
                        </span>
                      </div>
                      <div className="flex flex-col rounded-[8px] overflow-hidden" style={{ border: '1px solid var(--line-2)' }}>
                        {group.items.map((task, i) => {
                          const proj = projects.find(p => p.id === task.project);
                          const dueCls = dueClass(task.due, task.status);
                          const isOverdue = task.due && task.due < todayISO && task.status !== 'done';
                          return (
                            <button
                              key={task.id}
                              onClick={() => onOpenTask(task)}
                              className="flex items-center gap-3 px-3 py-2 text-left text-[13px] border-0 bg-transparent transition-colors"
                              style={{
                                borderTop: i > 0 ? '1px solid var(--line-2)' : 'none',
                                color: 'var(--ink)',
                              }}
                              onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-2)')}
                              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                            >
                              <span className="w-[8px] h-[8px] rounded-full flex-shrink-0" style={{ background: PRIORITY_COLORS[task.priority] }} title={task.priority} />
                              <span
                                onClick={e => { e.stopPropagation(); if (proj) onOpenProject(proj.id); }}
                                className="w-[8px] h-[8px] rounded-[2px] flex-shrink-0 cursor-pointer"
                                style={{ background: proj?.color }}
                                title={proj ? `${proj.client ? proj.client + ' · ' : ''}${proj.name}` : ''}
                              />
                              <span className="text-[11px] flex-shrink-0 truncate max-w-[150px]" style={{ color: 'var(--ink-4)' }}>
                                {proj?.client && `${proj.client} · `}{proj?.name}
                              </span>
                              <span className="flex-1 truncate">{task.title}</span>
                              <span
                                className="inline-flex items-center gap-1 h-5 px-2 rounded-[4px] text-[10.5px] font-medium flex-shrink-0"
                                style={{ background: 'transparent', color: STATUS_TONES[task.status] ?? 'var(--ink-3)', border: `1px solid ${STATUS_TONES[task.status] ?? 'var(--line)'}` }}
                              >
                                {STATUS_LABELS[task.status]}
                              </span>
                              {task.due && (
                                <span className={`flex items-center gap-1 text-[11px] flex-shrink-0 tabular-nums ${isOverdue ? '' : dueCls}`} style={{ color: isOverdue ? 'var(--danger)' : undefined, minWidth: 78, justifyContent: 'flex-end' }}>
                                  {isOverdue ? <Flag size={11} /> : <Clock size={11} />}
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
              )}
              {!isCollapsed && groups.length === 0 && (
                <div className="border-t px-5 py-6 text-center text-[13px]" style={{ borderColor: 'var(--line)', color: 'var(--ink-4)' }}>
                  Sin tareas relevantes para esta semana.
                </div>
              )}
            </div>
          );
        })}

        {visibleRows.length === 0 && (
          <div className="py-16 text-center" style={{ color: 'var(--ink-4)' }}>
            <div className="text-[14px]">Nadie tiene tareas activas esta semana.</div>
          </div>
        )}
      </div>
    </div>
  );
}

function Pill({ label, color, bg }: { label: string; color: string; bg: string }) {
  return (
    <span className="text-[11px] font-medium px-2 py-[3px] rounded-full tabular-nums" style={{ color, background: bg }}>
      {label}
    </span>
  );
}
