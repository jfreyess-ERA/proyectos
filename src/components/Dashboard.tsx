'use client';
import { Flag } from 'lucide-react';
import { PEOPLE, STATUSES, getProject, fmtDate, dueClass } from '@/lib/data';
import type { Task, Project } from '@/lib/types';

interface Props {
  tasks: Task[];
  projects: Project[];
  onOpenTask?: (task: Task) => void;
}

export function Dashboard({ tasks, projects, onOpenTask }: Props) {
  const me = PEOPLE[0];
  const myTasks = tasks.filter(t => t.assignees.includes(me.id) && t.status !== 'done');

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const overdue = tasks.filter(t => t.due && t.status !== 'done' && new Date(t.due + 'T00:00:00') < today);
  const dueWeek = tasks.filter(t => {
    if (!t.due || t.status === 'done') return false;
    const d = new Date(t.due + 'T00:00:00');
    const diff = (d.getTime() - today.getTime()) / 86400000;
    return diff >= 0 && diff <= 7;
  });

  const statusCounts = STATUSES.map(s => ({
    ...s,
    n: tasks.filter(t => t.status === s.id).length,
  }));
  const total = statusCounts.reduce((a, b) => a + b.n, 0);

  const projectStats = projects.map(p => {
    const ts = tasks.filter(t => t.project === p.id);
    const done = ts.filter(t => t.status === 'done').length;
    return { ...p, total: ts.length, done, pct: ts.length ? done / ts.length : 0 };
  });

  return (
    <div className="p-6 max-w-[1200px]">
      {/* Hero */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <div
            className="text-[11px] font-semibold tracking-widest uppercase mb-1"
            style={{ color: 'var(--ink-4)' }}
          >
            {today.toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long' })}
          </div>
          <h1 className="text-[28px] font-bold tracking-tight leading-tight" style={{ color: 'var(--ink)' }}>
            Hola, {me.name.split(' ')[0]}.
          </h1>
          <p className="text-[14px] mt-1" style={{ color: 'var(--ink-3)' }}>
            Tienes <strong style={{ color: 'var(--ink)' }}>{myTasks.length}</strong> tareas activas
            {' '}y <strong style={{ color: 'var(--ink)' }}>{dueWeek.length}</strong> vencen esta semana.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            className="h-8 px-3 text-[13px] font-medium rounded-[7px] border flex items-center gap-[6px]"
            style={{ border: '1px solid var(--line)', background: 'var(--surface)', color: 'var(--ink)' }}
          >
            Mi semana
          </button>
          <button
            className="h-8 px-3 text-[13px] font-medium rounded-[7px] flex items-center gap-[6px] border-0"
            style={{ background: 'var(--accent)', color: 'var(--on-accent)' }}
          >
            + Nueva tarea
          </button>
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-2 gap-4">
        {/* Estado general — full width */}
        <Card className="col-span-2">
          <CardHead title="Estado del trabajo" meta={`${total} tareas`} />
          <div className="flex gap-6 mb-4">
            {statusCounts.map(s => (
              <div key={s.id} className="flex flex-col gap-1">
                <div className="flex items-center gap-[6px]">
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: s.tone }} />
                  <span className="text-[11px]" style={{ color: 'var(--ink-3)' }}>{s.label}</span>
                </div>
                <span className="text-[22px] font-bold tracking-tight" style={{ color: 'var(--ink)' }}>{s.n}</span>
              </div>
            ))}
          </div>
          <div className="flex rounded-full overflow-hidden h-[6px]" style={{ background: 'var(--bg-3)' }}>
            {statusCounts.map(s => s.n > 0 && (
              <div
                key={s.id}
                style={{ flex: s.n, background: s.tone }}
                title={`${s.label}: ${s.n}`}
              />
            ))}
          </div>
        </Card>

        {/* Mis tareas */}
        <Card>
          <CardHead title="Mis tareas activas" action="Ver todas" />
          <TaskList>
            {myTasks.slice(0, 5).map(t => (
              <TaskRow key={t.id} task={t} onClick={() => onOpenTask?.(t)} />
            ))}
            {myTasks.length === 0 && <Empty text="Nada pendiente. Bien." />}
          </TaskList>
        </Card>

        {/* Vencimientos */}
        <Card>
          <CardHead title="Próximos vencimientos" meta={`${dueWeek.length + overdue.length} en total`} />
          <TaskList>
            {overdue.length > 0 && (
              <div
                className="flex items-center gap-[6px] text-[11px] font-medium px-2 py-1 rounded-[5px] mb-1"
                style={{ color: 'var(--danger)', background: 'var(--danger-bg)' }}
              >
                <Flag size={12} /> {overdue.length} atrasadas
              </div>
            )}
            {[...overdue, ...dueWeek].slice(0, 6).map(t => {
              const proj = getProject(t.project);
              return (
                <TaskRow key={t.id} task={t} onClick={() => onOpenTask?.(t)}>
                  <span className="w-2 h-2 rounded-[2px] flex-shrink-0" style={{ background: proj?.color }} />
                </TaskRow>
              );
            })}
          </TaskList>
        </Card>

        {/* Proyectos */}
        <Card className="col-span-2">
          <CardHead title="Proyectos" meta={`${projectStats.length} activos`} />
          <div className="flex flex-col gap-3">
            {projectStats.map(p => (
              <div key={p.id} className="flex items-center gap-4">
                <span className="w-[10px] h-[10px] rounded-[3px] flex-shrink-0" style={{ background: p.color }} />
                <span className="text-[13px] w-[220px] truncate" style={{ color: 'var(--ink)' }}>{p.name}</span>
                <div className="flex-1 h-[6px] rounded-full overflow-hidden" style={{ background: 'var(--bg-3)' }}>
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${p.pct * 100}%`, background: p.color }}
                  />
                </div>
                <span className="text-[12px] w-[80px] text-right tabular-nums" style={{ color: 'var(--ink-3)' }}>
                  {p.done}/{p.total} tareas
                </span>
                <span className="text-[12px] w-[36px] text-right tabular-nums font-medium" style={{ color: 'var(--ink-2)' }}>
                  {Math.round(p.pct * 100)}%
                </span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

/* ── Sub-components ──────────────────────────────────────────── */

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-[var(--radius-l)] p-5 ${className}`}
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--line)',
        boxShadow: 'var(--shadow-1)',
      }}
    >
      {children}
    </div>
  );
}

function CardHead({ title, meta, action }: { title: string; meta?: string; action?: string }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <h3 className="text-[13.5px] font-semibold" style={{ color: 'var(--ink)' }}>{title}</h3>
      {meta && <span className="text-[11px]" style={{ color: 'var(--ink-3)' }}>{meta}</span>}
      {action && (
        <button
          className="text-[12px] font-medium h-[26px] px-[9px] rounded-[6px] border-0 bg-transparent flex items-center gap-1"
          style={{ color: 'var(--ink-2)' }}
        >
          {action}
        </button>
      )}
    </div>
  );
}

function TaskList({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-col gap-[2px]">{children}</div>;
}

function TaskRow({ task, onClick, children }: { task: Task; onClick?: () => void; children?: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 w-full text-left px-2 py-[6px] rounded-[6px] border-0 bg-transparent transition-colors text-[13px]"
      style={{ color: 'var(--ink)' }}
    >
      {children}
      <PriorityDot priority={task.priority} />
      <span className="flex-1 truncate" style={{ color: 'var(--ink)' }}>{task.title}</span>
      <span className={`text-[11px] flex-shrink-0 ${dueClass(task.due, task.status)}`}>
        {fmtDate(task.due, { relative: true })}
      </span>
    </button>
  );
}

function PriorityDot({ priority }: { priority: string }) {
  const colors: Record<string, string> = {
    urgent: 'oklch(0.58 0.18 25)',
    high:   'oklch(0.65 0.14 50)',
    med:    'oklch(0.62 0.05 250)',
    low:    'oklch(0.62 0.02 250)',
  };
  return (
    <span
      className="w-2 h-2 rounded-full flex-shrink-0"
      style={{ background: colors[priority] ?? colors.med }}
    />
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="py-4 text-center text-[13px]" style={{ color: 'var(--ink-4)' }}>{text}</div>
  );
}
