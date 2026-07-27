'use client';
import { useState } from 'react';
import { Clock, Pencil, CheckSquare } from 'lucide-react';
import { STATUSES, fmtDate, dueClass } from '@/lib/data';
import { AvatarStack } from './Avatar';
import { SprintModal } from './SprintModal';
import type { Task, Sprint, Project } from '@/lib/types';

interface Props {
  sprint: Sprint;
  tasks: Task[];
  projects: Project[];
  onOpenTask: (task: Task) => void;
  onSprintUpdated: (s: Sprint) => void;
  onSprintDeleted: (id: string) => void;
}

const STATUS_COLS = STATUSES.map(s => s.id);

export function SprintView({ sprint, tasks, projects, onOpenTask, onSprintUpdated, onSprintDeleted }: Props) {
  const [editing, setEditing] = useState(false);

  const sprintTasks = tasks.filter(t => t.sprint_id === sprint.id);
  const done  = sprintTasks.filter(t => t.status === 'done').length;
  const total = sprintTasks.length;
  const pct   = total ? Math.round(done / total * 100) : 0;

  const STATUS_LABEL: Record<string, string> = {
    planned: 'Planificado', active: 'Activo', completed: 'Completado',
  };
  const STATUS_COLOR: Record<string, string> = {
    planned: 'var(--ink-4)', active: 'var(--accent)', completed: 'oklch(0.60 0.14 160)',
  };

  function fmtRange() {
    const parts = [];
    if (sprint.start_date) parts.push(fmtDate(sprint.start_date));
    if (sprint.end_date)   parts.push(fmtDate(sprint.end_date));
    return parts.join(' → ');
  }

  return (
    <>
      <div className="p-6 max-w-[1100px]">
        {/* Header */}
        <div className="mb-6 flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-[24px] font-bold tracking-tight" style={{ color: 'var(--ink)' }}>{sprint.name}</h1>
              <span
                className="text-[11px] font-semibold px-2 py-px rounded-full"
                style={{ background: 'var(--bg-3)', color: STATUS_COLOR[sprint.status] }}
              >
                {STATUS_LABEL[sprint.status]}
              </span>
            </div>
            {sprint.goal && (
              <p className="text-[13px] mb-2" style={{ color: 'var(--ink-3)' }}>{sprint.goal}</p>
            )}
            <div className="flex items-center gap-4 text-[12px]" style={{ color: 'var(--ink-4)' }}>
              {fmtRange() && <span>{fmtRange()}</span>}
              <span>{done}/{total} tareas completadas · {pct}%</span>
            </div>
            {total > 0 && (
              <div className="mt-3 h-[5px] rounded-full overflow-hidden w-[200px]" style={{ background: 'var(--bg-3)' }}>
                <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: 'var(--accent)' }} />
              </div>
            )}
          </div>
          <button
            onClick={() => setEditing(true)}
            className="h-8 px-3 rounded-[7px] text-[12px] font-medium border-0 flex items-center gap-1"
            style={{ background: 'var(--bg-3)', color: 'var(--ink-3)' }}
          >
            <Pencil size={12} /> Editar sprint
          </button>
        </div>

        {/* Board columns */}
        {total === 0 ? (
          <div className="py-16 text-center rounded-[12px]" style={{ border: '1px dashed var(--line)', color: 'var(--ink-4)' }}>
            <div className="text-[32px] mb-2">🏃</div>
            <div className="text-[14px]">Sin tareas en este sprint</div>
            <div className="text-[12px] mt-1">Asigna tareas desde el detalle de cada tarea</div>
          </div>
        ) : (
          <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${STATUSES.length}, 1fr)` }}>
            {STATUSES.map(col => {
              const colTasks = sprintTasks.filter(t => t.status === col.id);
              return (
                <div key={col.id}>
                  <div className="flex items-center gap-[6px] mb-2 px-1">
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: col.tone }} />
                    <span className="text-[11px] font-semibold uppercase tracking-wider flex-1" style={{ color: 'var(--ink-3)' }}>{col.label}</span>
                    <span className="text-[11px]" style={{ color: 'var(--ink-4)' }}>{colTasks.length}</span>
                  </div>
                  <div className="flex flex-col gap-2">
                    {colTasks.map(t => {
                      const proj = projects.find(p => p.id === t.project);
                      const dueCls = dueClass(t.due, t.status);
                      return (
                        <button
                          key={t.id}
                          onClick={() => onOpenTask(t)}
                          className="w-full text-left rounded-[8px] p-3 flex flex-col gap-2 transition-colors"
                          style={{ background: 'var(--surface)', border: '1px solid var(--line)' }}
                        >
                          <div className="flex items-start gap-2">
                            <span className="w-[6px] h-[6px] rounded-sm flex-shrink-0 mt-[5px]" style={{ background: proj?.color }} />
                            <span className="text-[12.5px] font-medium leading-snug" style={{ color: 'var(--ink)' }}>{t.title}</span>
                          </div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[10px]" style={{ color: 'var(--ink-4)', fontFamily: 'var(--font-mono)' }}>{t.ref}</span>
                            <AvatarStack userIds={t.assignees} max={2} />
                            {t.due && (
                              <span className={`flex items-center gap-1 text-[10px] ml-auto ${dueCls}`}>
                                <Clock size={9} />{fmtDate(t.due, { relative: true })}
                              </span>
                            )}
                            {t.subtasks.total > 0 && (
                              <span className="flex items-center gap-1 text-[10px]" style={{ color: 'var(--ink-4)' }}>
                                <CheckSquare size={9} />{t.subtasks.done}/{t.subtasks.total}
                              </span>
                            )}
                          </div>
                        </button>
                      );
                    })}
                    {colTasks.length === 0 && (
                      <div className="rounded-[8px] py-4 text-center text-[11px]" style={{ border: '1px dashed var(--line)', color: 'var(--ink-4)' }}>—</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <SprintModal
        open={editing}
        sprint={sprint}
        projects={projects}
        onClose={() => setEditing(false)}
        onSaved={onSprintUpdated}
        onDeleted={onSprintDeleted}
      />
    </>
  );
}
