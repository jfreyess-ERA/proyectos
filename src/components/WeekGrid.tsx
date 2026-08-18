'use client';
import { CornerDownRight, Flag } from 'lucide-react';
import { avatarBg } from '@/lib/data';
import type { Task, Project, User, DatedSubtask } from '@/lib/types';

interface SubtaskEvent {
  subtask: DatedSubtask;
  task: Task;
}

interface Props {
  weekStart: Date;
  users: User[];
  /** Universo ya filtrado por TaskFilterBar; acá se filtra además por asignado/fecha/estado. */
  tasks: Task[];
  subtaskEvents: SubtaskEvent[];
  projects: Project[];
  showEmpty: boolean;
  onOpenTask: (task: Task) => void;
}

const PRIORITY_COLORS: Record<string, string> = {
  urgent: 'oklch(0.58 0.18 25)',
  high:   'oklch(0.65 0.14 50)',
  med:    'oklch(0.62 0.05 250)',
  low:    'oklch(0.62 0.02 250)',
};

const WEEKDAY_LABELS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie'];

function addDays(d: Date, n: number): Date {
  const date = new Date(d);
  date.setDate(date.getDate() + n);
  return date;
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Un ítem de trabajo genérico (tarea o subtarea) ya resuelto contra su tarea padre. */
interface GridItem {
  key: string;
  title: string;
  due: string;
  priority: Task['priority'];
  isSubtask: boolean;
  parentTask: Task;
  projectColor?: string;
  /** A quién se le puede asignar esta fila: varios en una tarea, uno en una subtarea. */
  assignees: string[];
}

/**
 * Grilla semanal: filas = personas, columnas = días de la semana laboral +
 * atrasado + fin de semana. Responde de un vistazo "¿qué tiene que hacer cada
 * uno esta semana, y quién está libre tal día?" — la pregunta que una lista de
 * tareas por persona no contesta directamente.
 */
export function WeekGrid({ weekStart, users, tasks, subtaskEvents, projects, showEmpty, onOpenTask }: Props) {
  const projectById = new Map(projects.map(p => [p.id, p]));
  const weekdays = WEEKDAY_LABELS.map((label, i) => ({ label, date: addDays(weekStart, i) }));
  const weekendStart = addDays(weekStart, 5);
  const weekendEnd = addDays(weekStart, 6);
  const weekStartISO = isoDate(weekStart);
  const weekendEndISO = isoDate(weekendEnd);
  const todayISO = isoDate(new Date());

  // Todo lo pendiente (tarea o subtarea) se aplana a una sola forma para poder
  // ubicarlo en columnas sin dos caminos de código paralelos.
  const items: GridItem[] = [];
  for (const t of tasks) {
    if (t.status === 'done' || !t.due) continue;
    items.push({ key: 'task:' + t.id, title: t.title, due: t.due, priority: t.priority, isSubtask: false, parentTask: t, projectColor: projectById.get(t.project)?.color, assignees: t.assignees });
  }
  for (const { subtask, task } of subtaskEvents) {
    if (subtask.done) continue;
    items.push({ key: 'sub:' + subtask.id, title: subtask.title, due: subtask.due_date, priority: task.priority, isSubtask: true, parentTask: task, projectColor: projectById.get(task.project)?.color, assignees: subtask.assignee ? [subtask.assignee] : [] });
  }

  const rows = users.map(u => {
    const mine = items.filter(it => it.assignees.includes(u.id));
    const overdue = mine.filter(it => it.due < weekStartISO).sort(byPriorityThenTitle);
    const byDay = weekdays.map(({ date }) => {
      const iso = isoDate(date);
      return mine.filter(it => it.due === iso).sort(byPriorityThenTitle);
    });
    const weekend = mine.filter(it => it.due >= isoDate(weekendStart) && it.due <= weekendEndISO).sort(byPriorityThenTitle);
    const total = overdue.length + byDay.reduce((s, d) => s + d.length, 0) + weekend.length;
    return { user: u, overdue, byDay, weekend, total };
  });

  const visibleRows = showEmpty ? rows : rows.filter(r => r.total > 0);

  if (visibleRows.length === 0) {
    return (
      <div className="text-[13px] text-center py-12" style={{ color: 'var(--ink-4)' }}>
        Nadie tiene tareas o subtareas con fecha en esta semana.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-[10px]" style={{ border: '1px solid var(--line)' }}>
      <table className="border-collapse" style={{ minWidth: 980, width: '100%' }}>
        <thead>
          <tr>
            <th
              scope="col"
              className="text-left px-3 py-2 text-[11px] font-semibold uppercase tracking-wide"
              style={{
                position: 'sticky', left: 0, top: 0, zIndex: 3, width: 190, minWidth: 190,
                background: 'var(--bg-2)', color: 'var(--ink-4)', borderBottom: '1px solid var(--line)', borderRight: '1px solid var(--line)',
              }}
            >
              Persona
            </th>
            <th
              scope="col"
              className="text-left px-2 py-2 text-[11px] font-semibold uppercase tracking-wide"
              style={{
                position: 'sticky', top: 0, zIndex: 2, width: 120, minWidth: 120,
                background: 'oklch(0.97 0.02 25)', color: 'oklch(0.5 0.14 25)', borderBottom: '1px solid var(--line)',
              }}
            >
              Atrasado
            </th>
            {weekdays.map(({ label, date }) => {
              const iso = isoDate(date);
              const isToday = iso === todayISO;
              return (
                <th
                  key={iso}
                  scope="col"
                  className="text-left px-2 py-2 text-[11px] font-semibold uppercase tracking-wide"
                  style={{
                    position: 'sticky', top: 0, zIndex: 2, width: 130, minWidth: 130,
                    background: isToday ? 'var(--accent-bg)' : 'var(--bg-2)',
                    color: isToday ? 'var(--accent)' : 'var(--ink-4)',
                    borderBottom: '1px solid var(--line)',
                  }}
                >
                  {label} <span style={{ fontWeight: 400, textTransform: 'none' }}>{date.getDate()}</span>
                </th>
              );
            })}
            <th
              scope="col"
              className="text-left px-2 py-2 text-[11px] font-semibold uppercase tracking-wide"
              style={{
                position: 'sticky', top: 0, zIndex: 2, width: 130, minWidth: 130,
                background: 'var(--bg-2)', color: 'var(--ink-4)', borderBottom: '1px solid var(--line)',
              }}
            >
              Fin de semana
            </th>
          </tr>
        </thead>
        <tbody>
          {visibleRows.map((row, i) => (
            <tr key={row.user.id}>
              <th
                scope="row"
                className="text-left px-3 py-2 align-top"
                style={{
                  position: 'sticky', left: 0, zIndex: 1, width: 190, minWidth: 190,
                  background: 'var(--surface)', borderTop: i > 0 ? '1px solid var(--line)' : 'none', borderRight: '1px solid var(--line)',
                }}
              >
                <div className="flex items-center gap-2">
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center text-white font-semibold text-[11px] flex-shrink-0"
                    style={{ background: avatarBg(row.user.hue) }}
                  >
                    {row.user.initials}
                  </div>
                  <div className="min-w-0">
                    <div className="text-[12.5px] font-semibold truncate" style={{ color: 'var(--ink)' }}>{row.user.name}</div>
                    <div className="text-[11px] truncate" style={{ color: row.overdue.length > 0 ? 'var(--danger)' : 'var(--ink-4)' }}>
                      {row.total === 0 ? 'Sin pendientes' : `${row.total} pendiente${row.total > 1 ? 's' : ''}`}
                    </div>
                  </div>
                </div>
              </th>

              <Cell items={row.overdue} tint="oklch(0.985 0.008 25)" borderTop={i > 0} onOpenTask={onOpenTask} overdue />

              {row.byDay.map((dayItems, di) => {
                const iso = isoDate(weekdays[di].date);
                return (
                  <Cell key={iso} items={dayItems} tint={iso === todayISO ? 'var(--accent-bg)' : undefined} borderTop={i > 0} onOpenTask={onOpenTask} />
                );
              })}

              <Cell items={row.weekend} borderTop={i > 0} onOpenTask={onOpenTask} showDayTag />
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function byPriorityThenTitle(a: GridItem, b: GridItem): number {
  const order: Record<string, number> = { urgent: 0, high: 1, med: 2, low: 3 };
  const p = (order[a.priority] ?? 9) - (order[b.priority] ?? 9);
  return p !== 0 ? p : a.title.localeCompare(b.title);
}

const DOW_SHORT = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

function Cell({ items, tint, borderTop, onOpenTask, overdue, showDayTag }: {
  items: GridItem[];
  tint?: string;
  borderTop: boolean;
  onOpenTask: (t: Task) => void;
  overdue?: boolean;
  showDayTag?: boolean;
}) {
  return (
    <td
      className="align-top px-[6px] py-[6px]"
      style={{ borderTop: borderTop ? '1px solid var(--line)' : 'none', background: tint ?? 'transparent', minHeight: 44 }}
    >
      <div className="flex flex-col gap-[4px]">
        {items.map(it => (
          <button
            key={it.key}
            onClick={() => onOpenTask(it.parentTask)}
            title={it.isSubtask ? `${it.title} (subtarea de "${it.parentTask.title}")` : it.title}
            className="w-full flex items-center gap-[5px] h-6 px-[6px] rounded-[5px] text-[11px] border-0 text-left"
            style={{
              background: overdue ? 'oklch(0.95 0.03 25)' : 'var(--bg-3)',
              color: overdue ? 'oklch(0.42 0.16 25)' : 'var(--ink-2)',
            }}
          >
            <span
              className="rounded-[2px] flex-shrink-0"
              style={{ width: 6, height: 6, background: it.projectColor ?? 'var(--ink-4)' }}
            />
            {it.isSubtask && <CornerDownRight size={10} className="flex-shrink-0" style={{ color: 'var(--ink-4)' }} />}
            {it.priority === 'urgent' && <Flag size={10} className="flex-shrink-0" style={{ color: PRIORITY_COLORS.urgent }} />}
            <span className="truncate flex-1">{it.title}</span>
            {showDayTag && (
              <span className="flex-shrink-0 text-[9.5px]" style={{ color: 'var(--ink-4)' }}>
                {DOW_SHORT[new Date(it.due + 'T12:00:00').getDay()]}
              </span>
            )}
          </button>
        ))}
      </div>
    </td>
  );
}
