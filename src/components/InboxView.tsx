'use client';
import { AlertTriangle, Clock, Eye, UserX, Flame, RotateCcw } from 'lucide-react';
import { fmtDate, dueClass } from '@/lib/data';
import { AvatarStack } from './Avatar';
import { overdueCrmTasks, taskDue, dueForReactivation } from '@/lib/crm-alerts';
import type { Task, Project, CrmTask, Prospect } from '@/lib/types';

interface Props {
  tasks: Task[];
  projects: Project[];
  onOpenTask: (task: Task) => void;
  crmTasks?: CrmTask[];
  prospects?: Prospect[];
  onOpenProspect?: (p: Prospect) => void;
}

/**
 * Fila normalizada de la bandeja: acá conviven tareas de proyecto, tareas del CRM
 * y prospectos para reactivar, así que el render no puede asumir que todo es Task.
 */
interface Row {
  id: string;
  title: string;
  /** Contexto a la derecha: cliente · proyecto, o la empresa del prospecto. */
  context?: string;
  ref?: string;
  assignees?: string[];
  due?: string | null;
  dueClassName?: string;
  /** Color del punto: el del proyecto para tareas, el de la sección si no aplica. */
  dotColor?: string;
  onOpen: () => void;
}

interface Section {
  id: string;
  icon: React.ReactNode;
  title: string;
  rows: Row[];
  accent: string;
  bg: string;
}

export function InboxView({ tasks, projects, onOpenTask, crmTasks = [], prospects = [], onOpenProspect }: Props) {
  const today = new Date(); today.setHours(0, 0, 0, 0);

  const taskRow = (t: Task): Row => {
    const proj = projects.find(p => p.id === t.project);
    return {
      id: t.id,
      title: t.title,
      context: [proj?.client, proj?.name].filter(Boolean).join(' · '),
      ref: t.ref,
      assignees: t.assignees,
      due: t.due,
      dueClassName: dueClass(t.due, t.status),
      dotColor: proj?.color,
      onOpen: () => onOpenTask(t),
    };
  };

  const overdue = tasks.filter(t => t.status !== 'done' && t.due && new Date(t.due + 'T00:00:00') < today);
  const inReview = tasks.filter(t => t.status === 'review');
  const unassigned = tasks.filter(t => t.assignees.length === 0 && t.status !== 'done');
  const dueToday = tasks.filter(t => {
    if (!t.due || t.status === 'done') return false;
    return new Date(t.due + 'T00:00:00').getTime() === today.getTime();
  });

  // ── CRM ──────────────────────────────────────────────────────────
  const prospectById = new Map(prospects.map(p => [p.id, p]));
  const openProspect = (id: string) => {
    const p = prospectById.get(id);
    if (p && onOpenProspect) onOpenProspect(p);
  };

  const crmOverdue = overdueCrmTasks(crmTasks).map((t): Row => {
    const d = taskDue(t);
    return {
      id: t.id,
      title: t.notes?.trim() || t.task_type || 'Tarea CRM',
      context: prospectById.get(t.prospect_id)?.company,
      ref: t.task_type,
      due: d ? d.toISOString().slice(0, 10) : null,
      dueClassName: 'text-[var(--danger)]',
      onOpen: () => openProspect(t.prospect_id),
    };
  });

  const toReactivate = dueForReactivation(prospects).map((p): Row => ({
    id: p.id,
    title: p.company,
    context: p.contact_name,
    due: p.reconnect_at ?? (p.reconnect_month ? `${p.reconnect_month}-01` : null),
    dueClassName: 'text-[var(--danger)]',
    onOpen: () => onOpenProspect?.(p),
  }));

  const sections: Section[] = [
    {
      id: 'overdue',
      icon: <AlertTriangle size={14} />,
      title: 'Atrasadas',
      rows: overdue.map(taskRow),
      accent: 'var(--danger)',
      bg: 'var(--danger-bg)',
    },
    {
      id: 'crm-overdue',
      icon: <Flame size={14} />,
      title: 'Seguimiento CRM atrasado',
      rows: crmOverdue,
      accent: 'var(--danger)',
      bg: 'var(--danger-bg)',
    },
    {
      id: 'crm-reactivate',
      icon: <RotateCcw size={14} />,
      title: 'Prospectos para reactivar',
      rows: toReactivate,
      accent: 'oklch(0.62 0.16 265)',
      bg: 'var(--accent-bg)',
    },
    {
      id: 'today',
      icon: <Clock size={14} />,
      title: 'Vencen hoy',
      rows: dueToday.map(taskRow),
      accent: 'var(--warn)',
      bg: 'oklch(0.97 0.03 60)',
    },
    {
      id: 'review',
      icon: <Eye size={14} />,
      title: 'Esperando revisión',
      rows: inReview.map(taskRow),
      accent: 'oklch(0.68 0.13 38)',
      bg: 'oklch(0.97 0.02 38)',
    },
    {
      id: 'unassigned',
      icon: <UserX size={14} />,
      title: 'Sin asignar',
      rows: unassigned.map(taskRow),
      accent: 'var(--ink-3)',
      bg: 'var(--bg-2)',
    },
  ].filter(s => s.rows.length > 0);

  const total = sections.reduce((sum, s) => sum + s.rows.length, 0);

  return (
    <div className="p-6 max-w-[860px]">
      <div className="mb-6">
        <h1 className="text-[24px] font-bold tracking-tight" style={{ color: 'var(--ink)' }}>
          Bandeja
        </h1>
        <p className="text-[14px] mt-1" style={{ color: 'var(--ink-3)' }}>
          {total} elemento{total !== 1 ? 's' : ''} que requieren atención
        </p>
      </div>

      {total === 0 && (
        <div className="py-16 text-center" style={{ color: 'var(--ink-4)' }}>
          <div className="text-[32px] mb-2">📭</div>
          <div className="text-[14px]">Todo al día. Sin pendientes.</div>
        </div>
      )}

      <div className="flex flex-col gap-5">
        {sections.map(section => (
          <section key={section.id}>
            <div
              className="flex items-center gap-2 px-3 py-2 rounded-t-[10px] border-b"
              style={{ background: section.bg, borderColor: 'var(--line)', color: section.accent }}
            >
              {section.icon}
              <span className="text-[13px] font-semibold">{section.title}</span>
              <span
                className="ml-auto text-[11px] px-[7px] py-px rounded-full tabular-nums font-medium"
                style={{ background: 'rgba(0,0,0,.08)', color: section.accent }}
              >
                {section.rows.length}
              </span>
            </div>
            <div
              className="rounded-b-[10px] overflow-hidden"
              style={{ border: '1px solid var(--line)', borderTop: 'none', background: 'var(--surface)' }}
            >
              {section.rows.map((row, i) => (
                <button
                  key={row.id}
                  onClick={row.onOpen}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left text-[13px] transition-colors"
                  style={{
                    borderTop: i > 0 ? '1px solid var(--line)' : 'none',
                    background: 'transparent',
                    color: 'var(--ink)',
                  }}
                >
                  <span className="w-[8px] h-[8px] rounded-[2px] flex-shrink-0" style={{ background: row.dotColor ?? section.accent }} />
                  <span className="flex-1 truncate font-medium">{row.title}</span>
                  {row.context && (
                    <span className="text-[11px] flex-shrink-0 truncate max-w-[160px]" style={{ color: 'var(--ink-4)' }}>
                      {row.context}
                    </span>
                  )}
                  {row.ref && (
                    <span className="text-[11px] flex-shrink-0" style={{ fontFamily: 'var(--font-mono)', color: 'var(--ink-4)' }}>
                      {row.ref}
                    </span>
                  )}
                  {row.assignees && <AvatarStack userIds={row.assignees} max={2} />}
                  {row.due && (
                    <span className={`flex items-center gap-1 text-[11px] flex-shrink-0 ${row.dueClassName ?? ''}`}>
                      <Clock size={11} />
                      {fmtDate(row.due, { relative: true })}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
