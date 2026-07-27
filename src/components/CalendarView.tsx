'use client';
import { useState } from 'react';
import { ChevronLeft, ChevronRight, X, Clock } from 'lucide-react';
import { useProjects } from '@/lib/projects-context';
import { useUsers } from '@/lib/users-context';
import { avatarBg } from '@/lib/data';
import type { Task } from '@/lib/types';

interface Props {
  tasks: Task[];
  onOpenTask: (task: Task) => void;
  viewMode?: 'month' | 'week';
  /** Show assignee initials on each task chip — useful in team-wide calendars. */
  showAssignees?: boolean;
}

const PRIORITY_COLORS: Record<string, string> = {
  urgent: 'oklch(0.58 0.18 25)',
  high:   'oklch(0.65 0.14 50)',
  med:    'oklch(0.62 0.05 250)',
  low:    'oklch(0.62 0.02 250)',
};

const DOW = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function startOfWeekMon(d: Date): Date {
  const date = new Date(d); date.setHours(0, 0, 0, 0);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  date.setDate(diff);
  return date;
}

export function CalendarView({ tasks, onOpenTask, viewMode = 'month', showAssignees = false }: Props) {
  const projects = useProjects();
  const users = useUsers();
  const todayBase = new Date(); todayBase.setHours(0, 0, 0, 0);
  const [cursor, setCursor] = useState(() =>
    viewMode === 'week' ? startOfWeekMon(todayBase) : new Date(todayBase.getFullYear(), todayBase.getMonth(), 1)
  );
  const [selectedISO, setSelectedISO] = useState<string | null>(null);

  // Reset cursor when viewMode changes so it snaps to a valid boundary
  const cursorRef = cursor;
  const normalisedCursor = viewMode === 'week' ? startOfWeekMon(cursorRef) : new Date(cursorRef.getFullYear(), cursorRef.getMonth(), 1);

  const cells: Date[] = [];
  let headerLabel = '';

  if (viewMode === 'week') {
    for (let i = 0; i < 7; i++) {
      const d = new Date(normalisedCursor); d.setDate(normalisedCursor.getDate() + i);
      cells.push(d);
    }
    const sunday = cells[6];
    const sameMonth = normalisedCursor.getMonth() === sunday.getMonth();
    const startLbl = normalisedCursor.toLocaleDateString('es', { day: 'numeric', month: sameMonth ? undefined : 'short' });
    const endLbl = sunday.toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' });
    headerLabel = `${startLbl} — ${endLbl}`;
  } else {
    const firstDay = new Date(normalisedCursor.getFullYear(), normalisedCursor.getMonth(), 1);
    const lastDay  = new Date(normalisedCursor.getFullYear(), normalisedCursor.getMonth() + 1, 0);
    const startOffset = (firstDay.getDay() + 6) % 7;
    const gridStart = new Date(firstDay); gridStart.setDate(firstDay.getDate() - startOffset);
    const totalCells = Math.ceil((startOffset + lastDay.getDate()) / 7) * 7;
    for (let i = 0; i < totalCells; i++) {
      const d = new Date(gridStart); d.setDate(gridStart.getDate() + i);
      cells.push(d);
    }
    headerLabel = normalisedCursor.toLocaleDateString('es', { month: 'long', year: 'numeric' });
  }

  const tasksOn = (d: Date) => tasks.filter(t => t.due === isoDate(d));

  const prev = () => {
    setSelectedISO(null);
    if (viewMode === 'week') {
      const n = new Date(normalisedCursor); n.setDate(n.getDate() - 7); setCursor(n);
    } else {
      setCursor(new Date(normalisedCursor.getFullYear(), normalisedCursor.getMonth() - 1, 1));
    }
  };
  const next = () => {
    setSelectedISO(null);
    if (viewMode === 'week') {
      const n = new Date(normalisedCursor); n.setDate(n.getDate() + 7); setCursor(n);
    } else {
      setCursor(new Date(normalisedCursor.getFullYear(), normalisedCursor.getMonth() + 1, 1));
    }
  };
  const goToday = () => {
    setSelectedISO(null);
    setCursor(viewMode === 'week' ? startOfWeekMon(todayBase) : new Date(todayBase.getFullYear(), todayBase.getMonth(), 1));
  };

  const tasksWithDate = tasks.filter(t => t.due).length;
  const selectedTasks = selectedISO ? tasks.filter(t => t.due === selectedISO) : [];
  const selectedLabel = selectedISO
    ? new Date(selectedISO + 'T00:00:00').toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long' })
    : '';

  return (
    <div className="flex flex-col h-full">
      {/* Calendar header */}
      <div
        className="flex items-center justify-between px-6 py-[10px] border-b flex-shrink-0"
        style={{ borderColor: 'var(--line)', background: 'var(--bg)' }}
      >
        <div className="flex items-center gap-[6px]">
          <button
            onClick={prev}
            className="w-8 h-8 flex items-center justify-center rounded-[7px] border-0 bg-transparent transition-colors"
            style={{ color: 'var(--ink-2)' }}
          >
            <ChevronLeft size={16} />
          </button>
          <button
            onClick={goToday}
            className="h-[26px] px-3 rounded-[6px] text-[12px] font-medium border transition-colors"
            style={{ border: '1px solid var(--line)', background: 'var(--surface)', color: 'var(--ink)' }}
          >
            Hoy
          </button>
          <button
            onClick={next}
            className="w-8 h-8 flex items-center justify-center rounded-[7px] border-0 bg-transparent transition-colors"
            style={{ color: 'var(--ink-2)' }}
          >
            <ChevronRight size={16} />
          </button>
          <span
            className="ml-2 font-semibold text-[14px] capitalize"
            style={{ color: 'var(--ink)' }}
          >
            {headerLabel}
          </span>
        </div>
        <span className="text-[12px]" style={{ color: 'var(--ink-3)' }}>
          {tasksWithDate} tareas con fecha
        </span>
      </div>

      {/* Day-of-week header + grid share one scroll container so columns always line up */}
      <div className="flex-1 min-h-0 overflow-auto">
        <div
          className="grid"
          style={{
            gridTemplateColumns: 'repeat(7, 1fr)',
            gridTemplateRows: 'auto',
            gridAutoRows: viewMode === 'week' ? 'minmax(400px, 1fr)' : 'minmax(110px, 1fr)',
          }}
        >
        {DOW.map(d => (
          <div
            key={d}
            className="sticky top-0 z-10 px-3 py-2 text-[11px] font-semibold tracking-wider uppercase border-r border-b last:border-r-0"
            style={{ color: 'var(--ink-4)', borderColor: 'var(--line-2)', background: 'var(--bg)' }}
          >
            {d}
          </div>
        ))}
        {cells.map((d, i) => {
          const inMonth = viewMode === 'week' ? true : d.getMonth() === normalisedCursor.getMonth();
          const isToday = d.getTime() === todayBase.getTime();
          const dayTasks = tasksOn(d);
          const isWeekend = d.getDay() === 0 || d.getDay() === 6;
          const dayISO = isoDate(d);
          const isSelected = dayISO === selectedISO;

          return (
            <div
              key={i}
              onClick={() => setSelectedISO(prev => prev === dayISO ? null : dayISO)}
              className="min-w-0 border-r border-b last:border-r-0 min-h-[110px] p-[6px] flex flex-col gap-[3px] cursor-pointer transition-colors"
              style={{
                borderColor: 'var(--line-2)',
                boxShadow: isSelected ? 'inset 0 0 0 2px var(--accent)' : 'none',
                background: isToday
                  ? 'var(--accent-bg)'
                  : !inMonth
                  ? 'var(--bg-2)'
                  : isWeekend
                  ? 'var(--bg-2)'
                  : 'var(--surface)',
              }}
            >
              {/* Day number */}
              <div className="flex justify-between items-center mb-[2px]">
                <span
                  className={`text-[12px] font-medium tabular-nums ${isToday
                    ? 'w-[22px] h-[22px] rounded-full flex items-center justify-center font-semibold'
                    : ''}`}
                  style={{
                    background: isToday ? 'var(--accent)' : 'transparent',
                    color: isToday ? 'var(--on-accent)' : inMonth ? 'var(--ink-2)' : 'var(--ink-4)',
                  }}
                >
                  {d.getDate()}
                </span>
                {dayTasks.length > (viewMode === 'week' ? 12 : 3) && (
                  <span className="text-[11px]" style={{ color: 'var(--ink-4)' }}>
                    +{dayTasks.length}
                  </span>
                )}
              </div>

              {/* Events */}
              {dayTasks.slice(0, viewMode === 'week' ? 12 : 3).map(t => {
                const proj = projects.find(p => p.id === t.project);
                return (
                  <button
                    key={t.id}
                    onClick={e => { e.stopPropagation(); onOpenTask(t); }}
                    className="min-w-0 flex items-center gap-[6px] text-left rounded-[4px] px-[6px] py-[3px] border-0 border-l-[3px] text-[11.5px] transition-colors w-full"
                    style={{
                      borderLeftColor: proj?.color ?? 'var(--ink-3)',
                      borderLeftStyle: 'solid',
                      borderLeftWidth: 3,
                      background: 'var(--bg-2)',
                      color: 'var(--ink)',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-3)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'var(--bg-2)')}
                  >
                    <span
                      className="w-[6px] h-[6px] rounded-full flex-shrink-0"
                      style={{ background: PRIORITY_COLORS[t.priority] }}
                    />
                    <span className="flex-1 min-w-0 truncate">{t.title}</span>
                    {showAssignees && t.assignees.length > 0 && (
                      <span className="inline-flex flex-shrink-0">
                        {t.assignees.slice(0, 2).map((id, ix) => {
                          const u = users.find(x => x.id === id);
                          if (!u) return null;
                          return (
                            <span
                              key={id}
                              className="w-[14px] h-[14px] rounded-full inline-flex items-center justify-center font-semibold text-white flex-shrink-0 border-[1.5px]"
                              style={{
                                background: avatarBg(u.hue),
                                borderColor: 'var(--bg-2)',
                                fontSize: 7.5,
                                marginLeft: ix > 0 ? -5 : 0,
                              }}
                              title={u.name}
                            >
                              {u.initials}
                            </span>
                          );
                        })}
                      </span>
                    )}
                  </button>
                );
              })}
              {dayTasks.length > (viewMode === 'week' ? 12 : 3) && (
                <button
                  className="text-[11px] px-1 py-[2px] border-0 bg-transparent text-left"
                  style={{ color: 'var(--ink-3)' }}
                >
                  + {dayTasks.length - (viewMode === 'week' ? 12 : 3)} más
                </button>
              )}
            </div>
          );
        })}
        </div>
      </div>

      {/* Selected day detail */}
      {selectedISO && (
        <div
          className="flex-shrink-0 border-t overflow-y-auto"
          style={{ borderColor: 'var(--line)', background: 'var(--surface)', maxHeight: '40%' }}
        >
          <div className="flex items-center justify-between px-6 py-3 sticky top-0" style={{ background: 'var(--surface)', borderBottom: '1px solid var(--line-2)' }}>
            <div className="flex items-center gap-2">
              <span className="text-[13px] font-semibold capitalize" style={{ color: 'var(--ink)' }}>
                {selectedLabel}
              </span>
              <span className="text-[11px] px-[7px] py-px rounded-full tabular-nums" style={{ background: 'var(--bg-3)', color: 'var(--ink-4)' }}>
                {selectedTasks.length}
              </span>
            </div>
            <button
              onClick={() => setSelectedISO(null)}
              className="w-7 h-7 flex items-center justify-center rounded-[7px] border-0 bg-transparent transition-colors"
              style={{ color: 'var(--ink-3)' }}
            >
              <X size={15} />
            </button>
          </div>

          {selectedTasks.length === 0 ? (
            <div className="px-6 py-6 text-center text-[13px]" style={{ color: 'var(--ink-4)' }}>
              Sin tareas este día
            </div>
          ) : (
            <div className="flex flex-col px-3 pb-3">
              {selectedTasks.map((t, i) => {
                const proj = projects.find(p => p.id === t.project);
                return (
                  <button
                    key={t.id}
                    onClick={() => onOpenTask(t)}
                    className="flex items-center gap-3 px-3 py-[10px] text-left text-[13px] border-0 bg-transparent transition-colors w-full"
                    style={{
                      borderTop: i > 0 ? '1px solid var(--line-2)' : 'none',
                      color: 'var(--ink)',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-2)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <span className="w-[8px] h-[8px] rounded-full flex-shrink-0" style={{ background: PRIORITY_COLORS[t.priority] }} />
                    <span className="w-[8px] h-[8px] rounded-[2px] flex-shrink-0" style={{ background: proj?.color }} />
                    <span className="flex-1 min-w-0 truncate font-medium">{t.title}</span>
                    <span className="text-[11px] flex-shrink-0 truncate max-w-[160px] hidden sm:inline" style={{ color: 'var(--ink-4)' }}>
                      {proj?.client && `${proj.client} · `}{proj?.name}
                    </span>
                    {showAssignees && t.assignees.length > 0 && (
                      <span className="inline-flex flex-shrink-0">
                        {t.assignees.slice(0, 3).map((id, ix) => {
                          const u = users.find(x => x.id === id);
                          if (!u) return null;
                          return (
                            <span
                              key={id}
                              className="w-5 h-5 rounded-full inline-flex items-center justify-center font-semibold text-white text-[9px] flex-shrink-0 border-[1.5px]"
                              style={{ background: avatarBg(u.hue), borderColor: 'var(--surface)', marginLeft: ix > 0 ? -6 : 0 }}
                              title={u.name}
                            >
                              {u.initials}
                            </span>
                          );
                        })}
                      </span>
                    )}
                    <span className="text-[11px] flex-shrink-0 flex items-center gap-1" style={{ color: 'var(--ink-3)' }}>
                      <Clock size={11} />
                      {t.status === 'done' ? 'Completada' : t.status === 'doing' ? 'En curso' : t.status === 'review' ? 'En revisión' : t.status === 'todo' ? 'Por hacer' : 'Backlog'}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
