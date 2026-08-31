'use client';
import { STATUSES } from '@/lib/data';
import { AvatarStack } from './Avatar';
import type { Task, Project } from '@/lib/types';

const DAY_W = 32; // px per day
const SIDEBAR_W = 280;

const DOW = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];

const PRIORITY_COLORS: Record<string, string> = {
  urgent: 'var(--sem-red-2)',
  high:   'var(--sem-orange)',
  med:    'var(--sem-blue-gray-med)',
  low:    'var(--sem-blue-gray-low)',
};

interface Props {
  tasks: Task[];
  projects: Project[];
  onOpenTask: (task: Task) => void;
}

export function TimelineView({ tasks, projects, onOpenTask }: Props) {
  const datedTasks = tasks.filter(t => t.start && t.due);
  if (datedTasks.length === 0) {
    return (
      <div className="flex items-center justify-center h-full" style={{ color: 'var(--ink-4)' }}>
        Sin tareas con fechas para mostrar.
      </div>
    );
  }

  // Compute date range
  const allDates = datedTasks.flatMap(t => [t.start, t.due]);
  const minStr = allDates.reduce((a, b) => (a < b ? a : b));
  const maxStr = allDates.reduce((a, b) => (a > b ? a : b));

  const rangeStart = new Date(minStr + 'T00:00:00');
  const rangeEnd   = new Date(maxStr + 'T00:00:00');
  rangeStart.setDate(rangeStart.getDate() - 3);
  rangeEnd.setDate(rangeEnd.getDate() + 3);

  const totalDays = Math.round((rangeEnd.getTime() - rangeStart.getTime()) / 86400000) + 1;
  const totalW = totalDays * DAY_W;

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const todayOffset = Math.round((today.getTime() - rangeStart.getTime()) / 86400000);

  // Build day array
  const days: Date[] = [];
  for (let i = 0; i < totalDays; i++) {
    const d = new Date(rangeStart);
    d.setDate(d.getDate() + i);
    days.push(d);
  }

  // Build month markers
  const months: { idx: number; label: string }[] = [];
  let curMonth = -1;
  days.forEach((d, i) => {
    if (d.getMonth() !== curMonth) {
      curMonth = d.getMonth();
      months.push({ idx: i, label: d.toLocaleDateString('es', { month: 'long', year: 'numeric' }) });
    }
  });

  // Group by project
  const groups = projects.map(p => ({
    project: p,
    items: datedTasks.filter(t => t.project === p.id),
  })).filter(g => g.items.length > 0);

  const offsetFor = (dateStr: string) =>
    Math.round((new Date(dateStr + 'T00:00:00').getTime() - rangeStart.getTime()) / 86400000);

  const todayLine = todayOffset >= 0 && todayOffset < totalDays ? (
    <div
      className="absolute top-0 bottom-0 pointer-events-none"
      style={{
        left: todayOffset * DAY_W + DAY_W / 2,
        width: 1.5,
        background: 'var(--accent)',
        opacity: 0.5,
        zIndex: 2,
      }}
    />
  ) : null;

  // Row styles
  const sideStyle: React.CSSProperties = {
    position: 'sticky',
    left: 0,
    zIndex: 3,
    background: 'var(--bg)',
    borderRight: '1px solid var(--line)',
    borderBottom: '1px solid var(--line-2)',
    width: SIDEBAR_W,
    minWidth: SIDEBAR_W,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '0 14px',
    height: 36,
  };

  const rowStyle: React.CSSProperties = {
    position: 'relative',
    height: 36,
    width: totalW,
    borderBottom: '1px solid var(--line-2)',
    backgroundImage: `repeating-linear-gradient(to right, transparent 0, transparent ${DAY_W - 1}px, var(--line-2) ${DAY_W - 1}px, var(--line-2) ${DAY_W}px)`,
  };

  return (
    <div className="h-full overflow-auto" style={{ background: 'var(--bg)' }}>
      {/* Sticky top header */}
      <div
        className="flex sticky top-0 z-[5]"
        style={{ background: 'var(--bg)', borderBottom: '1px solid var(--line)' }}
      >
        {/* Sidebar header */}
        <div
          className="flex-shrink-0 sticky left-0 z-[6] flex items-end px-[14px]"
          style={{
            width: SIDEBAR_W,
            minWidth: SIDEBAR_W,
            height: 60,
            background: 'var(--bg)',
            borderRight: '1px solid var(--line)',
            paddingBottom: 8,
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            color: 'var(--ink-4)',
          }}
        >
          Tareas
        </div>

        {/* Day/month header */}
        <div style={{ width: totalW, flexShrink: 0, position: 'relative' }}>
          {/* Month row */}
          <div className="relative" style={{ height: 26, borderBottom: '1px solid var(--line-2)' }}>
            {months.map((m, i) => {
              const nextIdx = months[i + 1]?.idx ?? totalDays;
              return (
                <div
                  key={i}
                  className="absolute top-0 h-full flex items-center border-r"
                  style={{
                    left: m.idx * DAY_W,
                    width: (nextIdx - m.idx) * DAY_W,
                    padding: '0 8px',
                    fontSize: 11.5,
                    fontWeight: 600,
                    textTransform: 'capitalize',
                    color: 'var(--ink-2)',
                    borderColor: 'var(--line-2)',
                  }}
                >
                  {m.label}
                </div>
              );
            })}
          </div>

          {/* Day row */}
          <div className="flex" style={{ height: 34 }}>
            {days.map((d, i) => {
              const isWeekend = d.getDay() === 0 || d.getDay() === 6;
              const isToday = i === todayOffset;
              return (
                <div
                  key={i}
                  className="flex-shrink-0 flex flex-col items-center justify-center border-r"
                  style={{
                    width: DAY_W,
                    background: isToday ? 'var(--accent-bg)' : isWeekend ? 'var(--bg-2)' : 'transparent',
                    borderColor: 'var(--line-2)',
                    color: isToday ? 'var(--accent)' : 'var(--ink-3)',
                  }}
                >
                  <span style={{ fontSize: 12, fontWeight: isToday ? 600 : 500, lineHeight: 1 }}>
                    {d.getDate()}
                  </span>
                  <span style={{ fontSize: 9.5, textTransform: 'uppercase', marginTop: 1, opacity: 0.8 }}>
                    {DOW[d.getDay()]}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Body rows */}
      {groups.map(g => (
        <div key={g.project.id}>
          {/* Project group header */}
          <div className="flex">
            <div
              style={{
                ...sideStyle,
                background: 'var(--bg-2)',
                fontWeight: 600,
                fontSize: 12.5,
                zIndex: 3,
              }}
            >
              <span className="w-[10px] h-[10px] rounded-[3px] flex-shrink-0" style={{ background: g.project.color }} />
              <span style={{ color: 'var(--ink)' }}>{g.project.name}</span>
              <span
                className="ml-auto text-[11px] tabular-nums"
                style={{ color: 'var(--ink-4)' }}
              >
                {g.items.length}
              </span>
            </div>
            <div
              style={{
                ...rowStyle,
                background: 'var(--bg-2)',
                backgroundImage: `repeating-linear-gradient(to right, transparent 0, transparent ${DAY_W - 1}px, var(--line-2) ${DAY_W - 1}px, var(--line-2) ${DAY_W}px)`,
              }}
            >
              {todayLine}
            </div>
          </div>

          {/* Task rows */}
          {g.items.map(t => {
            const off = offsetFor(t.start);
            const len = Math.round(
              (new Date(t.due + 'T00:00:00').getTime() - new Date(t.start + 'T00:00:00').getTime()) / 86400000
            ) + 1;
            const status = STATUSES.find(s => s.id === t.status);
            const progress = t.subtasks.total > 0
              ? t.subtasks.done / t.subtasks.total
              : t.status === 'done' ? 1 : 0;

            return (
              <div key={t.id} className="flex group">
                {/* Sidebar cell */}
                <div
                  style={sideStyle}
                  className="cursor-pointer hover:bg-[var(--bg-2)] transition-colors"
                  onClick={() => onOpenTask(t)}
                >
                  <span
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ background: PRIORITY_COLORS[t.priority] }}
                  />
                  <span
                    className="flex-1 truncate text-[13px]"
                    style={{ color: 'var(--ink)' }}
                  >
                    {t.title}
                  </span>
                  <AvatarStack userIds={t.assignees} max={2} />
                </div>

                {/* Timeline row */}
                <div style={rowStyle}>
                  {todayLine}

                  {/* Gantt bar */}
                  <div
                    onClick={() => onOpenTask(t)}
                    className="absolute flex items-center overflow-hidden cursor-pointer"
                    style={{
                      top: 7,
                      bottom: 7,
                      left: off * DAY_W + 4,
                      width: Math.max(20, len * DAY_W - 8),
                      borderRadius: 6,
                      background: status?.tone ?? 'var(--accent)',
                      boxShadow: '0 1px 2px rgba(0,0,0,.15), inset 0 1px 0 rgba(255,255,255,.2)',
                      zIndex: 1,
                    }}
                  >
                    {/* Progress fill */}
                    <div
                      className="absolute left-0 top-0 bottom-0 pointer-events-none"
                      style={{
                        width: `${progress * 100}%`,
                        background: 'rgba(255,255,255,.25)',
                        borderRadius: 6,
                      }}
                    />
                    {/* Label */}
                    <span
                      className="relative px-2 text-[11.5px] font-medium truncate"
                      style={{
                        color: '#fff',
                        textShadow: '0 1px 0 rgba(0,0,0,.15)',
                        zIndex: 1,
                      }}
                    >
                      {t.title}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
