'use client';
import { useState } from 'react';
import { ChevronLeft, ChevronRight, X, Clock, Check } from 'lucide-react';
import { useProjects } from '@/lib/projects-context';
import { useUsers } from '@/lib/users-context';
import { avatarBg } from '@/lib/data';
import type { Task, DatedSubtask } from '@/lib/types';

interface SubtaskEvent {
  subtask: DatedSubtask;
  task: Task;
}

interface Props {
  tasks: Task[];
  onOpenTask: (task: Task) => void;
  viewMode?: 'month' | 'week';
  /** Show assignee initials on each task chip — useful in team-wide calendars. */
  showAssignees?: boolean;
  /** Subtasks with a due_date, paired with their parent task — rendered alongside tasks. */
  subtaskEvents?: SubtaskEvent[];
  /** Abre el panel de la subtarea. Sin esto, una subtarea abre su tarea padre. */
  onOpenSubtask?: (subtask: DatedSubtask, task: Task) => void;
  /** Marca hecha/pendiente sin abrir nada. Sin esto, no se muestra la casilla. */
  onToggleSubtask?: (subtask: DatedSubtask, task: Task, done: boolean) => void;
}

/**
 * Tareas y subtareas comparten la grilla en pie de igualdad: se mezclan en una
 * sola lista por día y compiten por el mismo cupo. (Antes las subtareas sólo
 * usaban el espacio sobrante, así que en un día con muchas tareas no se veían.)
 */
type DayItem =
  | { kind: 'task'; key: string; title: string; priority: Task['priority']; task: Task }
  | { kind: 'subtask'; key: string; title: string; priority: Task['priority']; task: Task; subtask: DatedSubtask };

const PRIORITY_RANK: Record<string, number> = { urgent: 0, high: 1, med: 2, low: 3 };

function byPriorityThenTitle(a: DayItem, b: DayItem): number {
  const p = (PRIORITY_RANK[a.priority] ?? 9) - (PRIORITY_RANK[b.priority] ?? 9);
  return p !== 0 ? p : a.title.localeCompare(b.title);
}

function todayISOStr(): string {
  const d = new Date(); d.setHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
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

export function CalendarView({ tasks, onOpenTask, viewMode = 'month', showAssignees = false, subtaskEvents = [], onOpenSubtask, onToggleSubtask }: Props) {
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

  const itemsOn = (d: Date): DayItem[] => {
    const iso = isoDate(d);
    const out: DayItem[] = [
      ...tasks.filter(t => t.due === iso)
        .map((t): DayItem => ({ kind: 'task', key: 't:' + t.id, title: t.title, priority: t.priority, task: t })),
      ...subtaskEvents.filter(e => e.subtask.due_date === iso)
        .map(({ subtask, task }): DayItem => ({ kind: 'subtask', key: 's:' + subtask.id, title: subtask.title, priority: task.priority, task, subtask })),
    ];
    return out.sort(byPriorityThenTitle);
  };
  const todayISO2 = todayISOStr();

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
  const selectedItems = selectedISO ? itemsOn(new Date(selectedISO + 'T12:00:00')) : [];
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
          {subtaskEvents.length > 0 && ` · ${subtaskEvents.length} subtarea${subtaskEvents.length > 1 ? 's' : ''} con fecha`}
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
          const dayItems = itemsOn(d);
          const dayCount = dayItems.length;
          const cap = viewMode === 'week' ? 12 : 3;
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
                {dayCount > cap && (
                  <span className="text-[11px]" style={{ color: 'var(--ink-4)' }}>
                    +{dayCount}
                  </span>
                )}
              </div>

              {/* Eventos del día: tareas y subtareas mezcladas, mismo cupo */}
              {dayItems.slice(0, cap).map(item => {
                const proj = projects.find(p => p.id === item.task.project);
                const isSub = item.kind === 'subtask';
                const sub = isSub ? item.subtask : null;
                const isOverdue = !!sub && !sub.done && sub.due_date < todayISO2;
                const isDone = !!sub?.done;
                const bg = isOverdue ? 'var(--danger-bg)' : 'var(--bg-2)';
                // Una subtarea muestra su propio responsable; una tarea, los suyos.
                const chipUsers = isSub
                  ? (sub!.assignee ? users.filter(u => u.id === sub!.assignee) : [])
                  : users.filter(u => item.task.assignees.includes(u.id)).slice(0, 2);

                return (
                  <div
                    key={item.key}
                    className="min-w-0 flex items-center gap-[5px] rounded-[4px] px-[6px] py-[3px] text-[11.5px] transition-colors w-full"
                    style={{
                      borderLeft: `3px ${isSub ? 'dashed' : 'solid'} ${proj?.color ?? 'var(--ink-3)'}`,
                      background: bg,
                      color: isOverdue ? 'var(--danger)' : isSub ? 'var(--ink-2)' : 'var(--ink)',
                    }}
                    onMouseEnter={e => { if (!isOverdue) e.currentTarget.style.background = 'var(--bg-3)'; }}
                    onMouseLeave={e => { if (!isOverdue) e.currentTarget.style.background = bg; }}
                  >
                    {isSub && onToggleSubtask ? (
                      <button
                        onClick={e => { e.stopPropagation(); onToggleSubtask(sub!, item.task, !sub!.done); }}
                        className="flex items-center justify-center flex-shrink-0 rounded-[3px] border"
                        style={{
                          width: 11, height: 11, padding: 0,
                          borderColor: isDone ? 'oklch(0.55 0.14 160)' : 'var(--ink-4)',
                          background: isDone ? 'oklch(0.55 0.14 160)' : 'transparent',
                          color: 'white',
                        }}
                        title={isDone ? 'Marcar como pendiente' : 'Marcar como hecha'}
                        aria-label={`${isDone ? 'Marcar como pendiente' : 'Marcar como hecha'}: ${item.title}`}
                      >
                        {isDone && <Check size={8} />}
                      </button>
                    ) : (
                      <span
                        className="rounded-full flex-shrink-0"
                        style={{ width: 6, height: 6, background: PRIORITY_COLORS[item.priority] }}
                      />
                    )}
                    <button
                      onClick={e => {
                        e.stopPropagation();
                        if (isSub && onOpenSubtask) onOpenSubtask(sub!, item.task);
                        else onOpenTask(item.task);
                      }}
                      title={isSub ? `${item.title} — subtarea de: ${item.task.title}` : item.title}
                      className="flex-1 min-w-0 truncate text-left border-0 bg-transparent p-0 text-[11.5px]"
                      style={{ color: 'inherit', textDecoration: isDone ? 'line-through' : 'none', opacity: isDone ? 0.6 : 1 }}
                    >
                      {item.title}
                    </button>
                    {showAssignees && chipUsers.length > 0 && (
                      <span className="inline-flex flex-shrink-0">
                        {chipUsers.map((u, ix) => (
                          <span
                            key={u.id}
                            className="w-[14px] h-[14px] rounded-full inline-flex items-center justify-center font-semibold text-white flex-shrink-0 border-[1.5px]"
                            style={{ background: avatarBg(u.hue), borderColor: bg, fontSize: 7.5, marginLeft: ix > 0 ? -5 : 0 }}
                            title={u.name}
                          >
                            {u.initials}
                          </span>
                        ))}
                      </span>
                    )}
                  </div>
                );
              })}
              {dayCount > cap && (
                <button
                  className="text-[11px] px-1 py-[2px] border-0 bg-transparent text-left"
                  style={{ color: 'var(--ink-3)' }}
                >
                  + {dayCount - cap} más
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
                {selectedItems.length}
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

          {selectedItems.length === 0 ? (
            <div className="px-6 py-6 text-center text-[13px]" style={{ color: 'var(--ink-4)' }}>
              Sin tareas este día
            </div>
          ) : (
            <div className="flex flex-col px-3 pb-3">
              {selectedItems.map((item, i) => {
                const proj = projects.find(p => p.id === item.task.project);
                const isSub = item.kind === 'subtask';
                const sub = isSub ? item.subtask : null;
                const isOverdue = !!sub && !sub.done && sub.due_date < todayISO2;
                const isDone = !!sub?.done;
                const rowUsers = isSub
                  ? (sub!.assignee ? users.filter(u => u.id === sub!.assignee) : [])
                  : users.filter(u => item.task.assignees.includes(u.id)).slice(0, 3);

                return (
                  <div
                    key={item.key}
                    className="flex items-center gap-3 px-3 py-[10px] text-[13px] transition-colors w-full"
                    style={{
                      borderTop: i > 0 ? '1px solid var(--line-2)' : 'none',
                      color: isOverdue ? 'var(--danger)' : 'var(--ink)',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-2)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    {isSub && onToggleSubtask ? (
                      <button
                        onClick={() => onToggleSubtask(sub!, item.task, !sub!.done)}
                        className="w-5 h-5 rounded-[5px] border flex items-center justify-center flex-shrink-0"
                        style={{
                          borderColor: isDone ? 'oklch(0.55 0.14 160)' : 'var(--line)',
                          background: isDone ? 'oklch(0.55 0.14 160)' : 'transparent',
                          color: 'white',
                        }}
                        title={isDone ? 'Marcar como pendiente' : 'Marcar como hecha'}
                        aria-label={`${isDone ? 'Marcar como pendiente' : 'Marcar como hecha'}: ${item.title}`}
                      >
                        {isDone && <Check size={12} />}
                      </button>
                    ) : (
                      <span className="w-[8px] h-[8px] rounded-full flex-shrink-0" style={{ background: PRIORITY_COLORS[item.priority] }} />
                    )}
                    <span className="w-[8px] h-[8px] rounded-[2px] flex-shrink-0" style={{ background: proj?.color }} />
                    <button
                      onClick={() => {
                        if (isSub && onOpenSubtask) onOpenSubtask(sub!, item.task);
                        else onOpenTask(item.task);
                      }}
                      className="flex-1 min-w-0 truncate font-medium text-left border-0 bg-transparent p-0 text-[13px]"
                      style={{ color: 'inherit', textDecoration: isDone ? 'line-through' : 'none', opacity: isDone ? 0.6 : 1 }}
                    >
                      {item.title}
                    </button>
                    <span className="text-[11px] flex-shrink-0 truncate max-w-[160px] hidden sm:inline" style={{ color: 'var(--ink-4)' }}>
                      {isSub ? item.task.title : `${proj?.client ? `${proj.client} · ` : ''}${proj?.name ?? ''}`}
                    </span>
                    {(showAssignees || isSub) && rowUsers.length > 0 && (
                      <span className="inline-flex flex-shrink-0">
                        {rowUsers.map((u, ix) => (
                          <span
                            key={u.id}
                            className="w-5 h-5 rounded-full inline-flex items-center justify-center font-semibold text-white text-[9px] flex-shrink-0 border-[1.5px]"
                            style={{ background: avatarBg(u.hue), borderColor: 'var(--surface)', marginLeft: ix > 0 ? -6 : 0 }}
                            title={u.name}
                          >
                            {u.initials}
                          </span>
                        ))}
                      </span>
                    )}
                    <span className="text-[11px] flex-shrink-0 flex items-center gap-1" style={{ color: isOverdue ? 'var(--danger)' : 'var(--ink-3)' }}>
                      {!isSub && <Clock size={11} />}
                      {isSub
                        ? (isDone ? 'Completada' : isOverdue ? 'Atrasada' : 'Subtarea')
                        : item.task.status === 'done' ? 'Completada' : item.task.status === 'doing' ? 'En curso' : item.task.status === 'review' ? 'En revisión' : item.task.status === 'todo' ? 'Por hacer' : 'Backlog'}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
