'use client';
import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { CrmTask, CrmInteraction, Prospect } from '@/lib/types';

interface Props {
  crmTasks: CrmTask[];
  interactions: CrmInteraction[];
  prospects: Prospect[];
  onOpenProspect: (p: Prospect) => void;
}

interface DayItem {
  type: 'task' | 'followup';
  label: string;
  prospect?: Prospect;
  color: string;
  bg: string;
}

export function CrmCalendarView({ crmTasks, interactions, prospects, onOpenProspect }: Props) {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth()); // 0-indexed
  const [selectedDay, setSelectedDay] = useState<number | null>(today.getDate());

  const prospectMap = Object.fromEntries(prospects.map(p => [p.id, p]));

  // Build items per day
  const itemsByDay: Record<number, DayItem[]> = {};

  // Tasks by due_date
  for (const task of crmTasks) {
    if (!task.due_date || task.status === 'Done' || task.status === 'Cancelled') continue;
    const d = new Date(task.due_date + 'T12:00:00');
    if (d.getFullYear() !== year || d.getMonth() !== month) continue;
    const day = d.getDate();
    if (!itemsByDay[day]) itemsByDay[day] = [];
    itemsByDay[day].push({
      type: 'task',
      label: `${task.task_type ?? 'Tarea'} · ${prospectMap[task.prospect_id]?.company ?? '…'}`,
      prospect: prospectMap[task.prospect_id],
      color: 'var(--sem-blue-dark)',
      bg: 'var(--sem-blue-bg)',
    });
  }

  // Interactions follow-up due
  for (const i of interactions) {
    if (!i.follow_up_due) continue;
    const d = new Date(i.follow_up_due + 'T12:00:00');
    if (d.getFullYear() !== year || d.getMonth() !== month) continue;
    const day = d.getDate();
    if (!itemsByDay[day]) itemsByDay[day] = [];
    itemsByDay[day].push({
      type: 'followup',
      label: `Follow-up · ${prospectMap[i.prospect_id]?.company ?? '…'}`,
      prospect: prospectMap[i.prospect_id],
      color: 'var(--sem-purple-dark)',
      bg: 'var(--sem-purple-bg)',
    });
  }

  // Calendar grid
  const firstDay = new Date(year, month, 1).getDay(); // 0=Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const weeks: (number | null)[][] = [];
  let week: (number | null)[] = Array(firstDay).fill(null);
  for (let d = 1; d <= daysInMonth; d++) {
    week.push(d);
    if (week.length === 7) { weeks.push(week); week = []; }
  }
  if (week.length > 0) weeks.push([...week, ...Array(7 - week.length).fill(null)]);

  const monthName = new Date(year, month, 1).toLocaleString('es-CL', { month: 'long', year: 'numeric' });

  const selectedItems = selectedDay ? itemsByDay[selectedDay] ?? [] : [];

  const todayStr = today.toISOString().slice(0, 10);
  const isToday = (d: number) => `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}` === todayStr;

  function prevMonth() {
    if (month === 0) { setMonth(11); setYear(y => y - 1); } else setMonth(m => m - 1);
    setSelectedDay(null);
  }
  function nextMonth() {
    if (month === 11) { setMonth(0); setYear(y => y + 1); } else setMonth(m => m + 1);
    setSelectedDay(null);
  }

  return (
    <div className="p-6 max-w-[900px]">
      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <h1 className="text-[22px] font-bold tracking-tight flex-1" style={{ color: 'var(--ink)' }}>
          Calendario CRM
        </h1>
        <div className="flex items-center gap-2">
          <button onClick={prevMonth} className="w-8 h-8 flex items-center justify-center rounded-[7px] border-0" style={{ background: 'var(--bg-3)', color: 'var(--ink-2)' }}>
            <ChevronLeft size={15} />
          </button>
          <span className="text-[14px] font-semibold capitalize w-[160px] text-center" style={{ color: 'var(--ink)' }}>{monthName}</span>
          <button onClick={nextMonth} className="w-8 h-8 flex items-center justify-center rounded-[7px] border-0" style={{ background: 'var(--bg-3)', color: 'var(--ink-2)' }}>
            <ChevronRight size={15} />
          </button>
        </div>
        {/* Legend */}
        <div className="flex items-center gap-3 ml-4">
          <div className="flex items-center gap-1"><span className="w-3 h-3 rounded-[3px]" style={{ background: 'var(--sem-blue-bg)' }} /><span className="text-[11px]" style={{ color: 'var(--ink-3)' }}>Tarea CRM</span></div>
          <div className="flex items-center gap-1"><span className="w-3 h-3 rounded-[3px]" style={{ background: 'var(--sem-purple-bg)' }} /><span className="text-[11px]" style={{ color: 'var(--ink-3)' }}>Follow-up</span></div>
        </div>
      </div>

      {/* Grid */}
      <div className="rounded-[12px] overflow-hidden" style={{ border: '1px solid var(--line)', background: 'var(--surface)', boxShadow: 'var(--shadow-1)' }}>
        {/* Day headers */}
        <div className="grid grid-cols-7" style={{ borderBottom: '1px solid var(--line)', background: 'var(--bg-2)' }}>
          {['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'].map(d => (
            <div key={d} className="text-center py-2 text-[11.5px] font-semibold" style={{ color: 'var(--ink-4)' }}>{d}</div>
          ))}
        </div>

        {/* Weeks */}
        {weeks.map((week, wi) => (
          <div key={wi} className="grid grid-cols-7" style={{ borderBottom: wi < weeks.length - 1 ? '1px solid var(--line)' : 'none' }}>
            {week.map((day, di) => {
              const items = day ? itemsByDay[day] ?? [] : [];
              const isSelected = day === selectedDay;
              const isTodayDay = day !== null && isToday(day);
              return (
                <div
                  key={di}
                  onClick={() => day && setSelectedDay(day === selectedDay ? null : day)}
                  className="min-h-[80px] p-2 transition-colors cursor-pointer"
                  style={{
                    borderLeft: di > 0 ? '1px solid var(--line)' : 'none',
                    background: isSelected ? 'var(--accent-bg, oklch(0.97 0.03 245))' : '',
                    opacity: day ? 1 : 0.3,
                  }}
                  onMouseEnter={e => { if (day && !isSelected) e.currentTarget.style.background = 'var(--bg-2)'; }}
                  onMouseLeave={e => { if (day && !isSelected) e.currentTarget.style.background = ''; }}
                >
                  {day && (
                    <>
                      <div
                        className="text-[13px] font-medium mb-1 w-7 h-7 flex items-center justify-center rounded-full"
                        style={{
                          color: isTodayDay ? 'white' : 'var(--ink)',
                          background: isTodayDay ? 'var(--accent)' : 'transparent',
                          fontWeight: isTodayDay ? 700 : 400,
                        }}
                      >
                        {day}
                      </div>
                      <div className="flex flex-col gap-[3px]">
                        {items.slice(0, 2).map((item, ii) => (
                          <div key={ii}
                            className="text-[10px] px-[5px] py-[2px] rounded-[4px] truncate font-medium"
                            style={{ background: item.bg, color: item.color }}>
                            {item.label}
                          </div>
                        ))}
                        {items.length > 2 && (
                          <div className="text-[10px] px-[5px]" style={{ color: 'var(--ink-4)' }}>+{items.length - 2} más</div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* Selected day detail */}
      {selectedDay && (
        <div className="mt-4 rounded-[12px] p-4" style={{ background: 'var(--surface)', border: '1px solid var(--line)', boxShadow: 'var(--shadow-1)' }}>
          <div className="text-[13px] font-semibold mb-3" style={{ color: 'var(--ink)' }}>
            {new Date(year, month, selectedDay).toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long' })}
            <span className="ml-2 font-normal" style={{ color: 'var(--ink-4)' }}>· {selectedItems.length} elemento{selectedItems.length !== 1 ? 's' : ''}</span>
          </div>
          {selectedItems.length === 0 && (
            <div className="text-[13px]" style={{ color: 'var(--ink-4)' }}>Sin tareas ni seguimientos este día</div>
          )}
          <div className="flex flex-col gap-2">
            {selectedItems.map((item, ii) => (
              <div key={ii} className="flex items-center gap-3 rounded-[8px] px-3 py-2" style={{ background: item.bg }}>
                <span className="text-[12px]">{item.type === 'task' ? '✅' : '🔔'}</span>
                <span className="text-[13px] flex-1" style={{ color: item.color, fontWeight: 500 }}>{item.label}</span>
                {item.prospect && (
                  <button
                    onClick={() => onOpenProspect(item.prospect!)}
                    className="text-[11px] px-2 py-[2px] rounded-[5px] border-0"
                    style={{ background: 'rgba(255,255,255,0.6)', color: item.color }}
                  >
                    Ver prospecto ↗
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
