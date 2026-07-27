'use client';
import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useProjects } from '@/lib/projects-context';
import type { Task } from '@/lib/types';

interface Props {
  tasks: Task[];
  onOpenTask: (task: Task) => void;
}

const PRIORITY_COLORS: Record<string, string> = {
  urgent: 'oklch(0.58 0.18 25)',
  high:   'oklch(0.65 0.14 50)',
  med:    'oklch(0.62 0.05 250)',
  low:    'oklch(0.62 0.02 250)',
};

const DOW = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

export function CalendarView({ tasks, onOpenTask }: Props) {
  const projects = useProjects();
  const todayBase = new Date(); todayBase.setHours(0, 0, 0, 0);
  const [cursor, setCursor] = useState(() => new Date(todayBase.getFullYear(), todayBase.getMonth(), 1));

  const monthLabel = cursor.toLocaleDateString('es', { month: 'long', year: 'numeric' });
  const firstDay = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const lastDay  = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);
  const startOffset = (firstDay.getDay() + 6) % 7; // Monday-first
  const gridStart = new Date(firstDay); gridStart.setDate(firstDay.getDate() - startOffset);
  const totalCells = Math.ceil((startOffset + lastDay.getDate()) / 7) * 7;

  const cells: Date[] = [];
  for (let i = 0; i < totalCells; i++) {
    const d = new Date(gridStart); d.setDate(gridStart.getDate() + i);
    cells.push(d);
  }

  const tasksOn = (d: Date) => {
    const iso = d.toISOString().slice(0, 10);
    return tasks.filter(t => t.due === iso);
  };

  const prev = () => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1));
  const next = () => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1));
  const goToday = () => setCursor(new Date(todayBase.getFullYear(), todayBase.getMonth(), 1));

  const tasksWithDate = tasks.filter(t => t.due).length;

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
            {monthLabel}
          </span>
        </div>
        <span className="text-[12px]" style={{ color: 'var(--ink-3)' }}>
          {tasksWithDate} tareas con fecha
        </span>
      </div>

      {/* Day-of-week header */}
      <div
        className="grid border-b flex-shrink-0"
        style={{ gridTemplateColumns: 'repeat(7, 1fr)', borderColor: 'var(--line)' }}
      >
        {DOW.map(d => (
          <div
            key={d}
            className="px-3 py-2 text-[11px] font-semibold tracking-wider uppercase border-r last:border-r-0"
            style={{ color: 'var(--ink-4)', borderColor: 'var(--line-2)' }}
          >
            {d}
          </div>
        ))}
      </div>

      {/* Grid */}
      <div
        className="flex-1 min-h-0 overflow-auto grid"
        style={{
          gridTemplateColumns: 'repeat(7, 1fr)',
          gridAutoRows: '1fr',
        }}
      >
        {cells.map((d, i) => {
          const inMonth = d.getMonth() === cursor.getMonth();
          const isToday = d.getTime() === todayBase.getTime();
          const dayTasks = tasksOn(d);
          const isWeekend = d.getDay() === 0 || d.getDay() === 6;

          return (
            <div
              key={i}
              className="border-r border-b last:border-r-0 min-h-[110px] p-[6px] flex flex-col gap-[3px]"
              style={{
                borderColor: 'var(--line-2)',
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
                {dayTasks.length > 3 && (
                  <span className="text-[11px]" style={{ color: 'var(--ink-4)' }}>
                    +{dayTasks.length}
                  </span>
                )}
              </div>

              {/* Events */}
              {dayTasks.slice(0, 3).map(t => {
                const proj = projects.find(p => p.id === t.project);
                return (
                  <button
                    key={t.id}
                    onClick={() => onOpenTask(t)}
                    className="flex items-center gap-[6px] text-left rounded-[4px] px-[6px] py-[3px] border-0 border-l-[3px] text-[11.5px] transition-colors w-full"
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
                    <span className="truncate">{t.title}</span>
                  </button>
                );
              })}
              {dayTasks.length > 3 && (
                <button
                  className="text-[11px] px-1 py-[2px] border-0 bg-transparent text-left"
                  style={{ color: 'var(--ink-3)' }}
                >
                  + {dayTasks.length - 3} más
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
