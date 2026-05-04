'use client';
import { useState } from 'react';
import { ChevronDown, ChevronRight, Plus, Download } from 'lucide-react';
import { STATUSES, PRIORITIES, getLabel, getProject, getUser, fmtDate, dueClass } from '@/lib/data';
import { AvatarStack } from './Avatar';
import type { Task } from '@/lib/types';

interface Props {
  tasks: Task[];
  onOpenTask: (task: Task) => void;
}

function exportCSV(tasks: Task[]) {
  const headers = ['Ref', 'Título', 'Proyecto', 'Estado', 'Prioridad', 'Asignados', 'Etiquetas', 'Inicio', 'Vence', 'Estimado (h)', 'Real (h)'];
  const rows = tasks.map(t => {
    const proj     = getProject(t.project);
    const assignees = t.assignees.map(id => getUser(id)?.name ?? id).join('; ');
    const labels   = t.labels.map(id => getLabel(id)?.text ?? id).join('; ');
    return [t.ref, t.title, proj?.name ?? '', t.status, t.priority, assignees, labels, t.start ?? '', t.due ?? '', t.estimate, t.spent];
  });
  const csv = [headers, ...rows].map(row => row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `tareas-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

const PRIORITY_COLORS: Record<string, string> = {
  urgent: 'oklch(0.58 0.18 25)',
  high:   'oklch(0.65 0.14 50)',
  med:    'oklch(0.62 0.05 250)',
  low:    'oklch(0.62 0.02 250)',
};

export function ListView({ tasks, onOpenTask }: Props) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const toggle = (id: string) => setCollapsed(c => ({ ...c, [id]: !c[id] }));

  const groups = STATUSES
    .map(s => ({ status: s, items: tasks.filter(t => t.status === s.id) }))
    .filter(g => g.items.length > 0);

  return (
    <div className="h-full overflow-auto" style={{ padding: '0 24px 24px' }}>
      <div className="flex flex-col">
        {/* Toolbar */}
        <div className="flex items-center justify-end py-3 gap-2">
          <button
            onClick={() => exportCSV(tasks)}
            className="flex items-center gap-[6px] h-7 px-3 rounded-[6px] text-[12px] border-0 transition-colors"
            style={{ background: 'var(--bg-2)', color: 'var(--ink-3)', border: '1px solid var(--line)' }}
          >
            <Download size={12} /> Exportar CSV
          </button>
        </div>
        {/* Header row */}
        <div
          className="grid sticky top-0 z-10 h-8 border-b"
          style={{
            gridTemplateColumns: 'minmax(280px,1fr) 130px 90px 110px 180px 90px 80px',
            gap: 12,
            padding: '0 14px',
            background: 'var(--bg)',
            borderColor: 'var(--line)',
            alignItems: 'center',
          }}
        >
          {['Tarea', 'Estado', 'Prioridad', 'Asignado', 'Etiquetas', 'Vence', 'Estimado'].map(h => (
            <div
              key={h}
              className="text-[11px] font-semibold tracking-wider uppercase overflow-hidden text-ellipsis"
              style={{ color: 'var(--ink-4)' }}
            >
              {h}
            </div>
          ))}
        </div>

        {groups.map(g => {
          const open = !collapsed[g.status.id];
          return (
            <div key={g.status.id} className="mt-1">
              {/* Group header */}
              <button
                onClick={() => toggle(g.status.id)}
                className="flex items-center gap-2 w-full h-9 px-[14px] border-b text-left border-0 bg-transparent transition-colors"
                style={{ borderBottom: '1px solid var(--line-2)', color: 'var(--ink)' }}
              >
                {open
                  ? <ChevronDown size={14} style={{ color: 'var(--ink-3)', flexShrink: 0 }} />
                  : <ChevronRight size={14} style={{ color: 'var(--ink-3)', flexShrink: 0 }} />
                }
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: g.status.tone }} />
                <span className="text-[13px] font-semibold" style={{ color: 'var(--ink)' }}>{g.status.label}</span>
                <span
                  className="text-[11px] px-[7px] py-px rounded-full tabular-nums ml-1"
                  style={{ background: 'var(--bg-3)', color: 'var(--ink-4)' }}
                >
                  {g.items.length}
                </span>
              </button>

              {open && (
                <>
                  {g.items.map(t => {
                    const labels = t.labels.map(id => getLabel(id)).filter(Boolean);
                    const priority = PRIORITIES.find(p => p.id === t.priority);
                    const dueCls = dueClass(t.due, t.status);

                    return (
                      <div
                        key={t.id}
                        onClick={() => onOpenTask(t)}
                        className="grid cursor-pointer border-b transition-colors"
                        style={{
                          gridTemplateColumns: 'minmax(280px,1fr) 130px 90px 110px 180px 90px 80px',
                          gap: 12,
                          padding: '0 14px',
                          height: 'var(--row-h)',
                          borderColor: 'var(--line-2)',
                          alignItems: 'center',
                        }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-2)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                      >
                        {/* Title cell */}
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className="w-2 h-2 rounded-full flex-shrink-0"
                            style={{ background: PRIORITY_COLORS[t.priority] }}
                          />
                          <span
                            className="text-[11px] flex-shrink-0 tabular-nums"
                            style={{ fontFamily: 'var(--font-mono)', color: 'var(--ink-4)' }}
                          >
                            {t.ref}
                          </span>
                          <span className="text-[13px] truncate" style={{ color: 'var(--ink)' }}>
                            {t.title}
                          </span>
                          {t.subtasks.total > 0 && (
                            <span className="flex-shrink-0 text-[11px]" style={{ color: 'var(--ink-4)' }}>
                              {t.subtasks.done}/{t.subtasks.total}
                            </span>
                          )}
                        </div>

                        {/* Status */}
                        <div>
                          <span
                            className="inline-flex items-center gap-[6px] h-[22px] px-2 rounded-[5px] text-[11.5px] font-medium border"
                            style={{ background: 'var(--bg-2)', borderColor: 'var(--line)', color: 'var(--ink-2)' }}
                          >
                            <span className="w-[7px] h-[7px] rounded-full" style={{ background: g.status.tone }} />
                            {g.status.label}
                          </span>
                        </div>

                        {/* Priority */}
                        <div className="text-[13px]" style={{ color: 'var(--ink-2)' }}>
                          {priority?.label}
                        </div>

                        {/* Assignees */}
                        <div>
                          <AvatarStack userIds={t.assignees} max={3} />
                        </div>

                        {/* Labels */}
                        <div className="flex items-center gap-1 overflow-hidden">
                          {labels.slice(0, 2).map(l => l && (
                            <span
                              key={l.id}
                              className="inline-flex items-center h-5 px-2 rounded-[4px] text-[11px] font-medium flex-shrink-0"
                              style={{ background: l.bg, color: l.fg }}
                            >
                              {l.text}
                            </span>
                          ))}
                          {labels.length > 2 && (
                            <span className="text-[11px] flex-shrink-0" style={{ color: 'var(--ink-4)' }}>
                              +{labels.length - 2}
                            </span>
                          )}
                        </div>

                        {/* Due */}
                        <div className={`text-[13px] ${dueCls}`}>
                          {fmtDate(t.due, { relative: true })}
                        </div>

                        {/* Estimate */}
                        <div className="text-[13px]" style={{ color: 'var(--ink-3)' }}>
                          {t.estimate}h
                        </div>
                      </div>
                    );
                  })}

                  <button
                    className="flex items-center gap-[6px] w-full px-[14px] py-2 border-0 bg-transparent text-[12.5px] text-left transition-colors"
                    style={{ color: 'var(--ink-4)' }}
                    onMouseEnter={e => (e.currentTarget.style.color = 'var(--ink)')}
                    onMouseLeave={e => (e.currentTarget.style.color = 'var(--ink-4)')}
                  >
                    <Plus size={13} /> Nueva tarea en {g.status.label.toLowerCase()}
                  </button>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
