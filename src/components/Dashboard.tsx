'use client';
import { useState } from 'react';
import { Flag, TrendingUp, Clock, CheckCircle } from 'lucide-react';
import { PEOPLE, STATUSES, fmtDate, dueClass } from '@/lib/data';
import { useAuth } from '@/lib/auth-context';
import type { Task, Project } from '@/lib/types';

const RANGE_OPTIONS = [
  { label: '1 semana',  days: 7  },
  { label: '2 semanas', days: 14 },
  { label: '3 semanas', days: 21 },
  { label: '1 mes',     days: 30 },
  { label: '2 meses',   days: 60 },
];

interface Props {
  tasks: Task[];
  projects: Project[];
  onOpenTask?: (task: Task) => void;
  onCreateTask?: () => void;
}

export function Dashboard({ tasks, projects, onOpenTask, onCreateTask }: Props) {
  const { profile } = useAuth();
  const me = profile ?? PEOPLE[0];
  const [rangeDays, setRangeDays] = useState(7);

  const myTasks = tasks.filter(t => t.assignees.includes(me.id) && t.status !== 'done');

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const overdue = tasks.filter(t => t.due && t.status !== 'done' && new Date(t.due + 'T00:00:00') < today);
  const dueInRange = tasks.filter(t => {
    if (!t.due || t.status === 'done') return false;
    const d = new Date(t.due + 'T00:00:00');
    const diff = (d.getTime() - today.getTime()) / 86400000;
    return diff >= 0 && diff <= rangeDays;
  });

  const done  = tasks.filter(t => t.status === 'done').length;
  const total = tasks.length;
  const completionRate = total > 0 ? Math.round((done / total) * 100) : 0;

  const totalEstimate = tasks.reduce((s, t) => s + (t.estimate ?? 0), 0);
  const totalSpent    = tasks.reduce((s, t) => s + (t.spent ?? 0), 0);

  const statusCounts = STATUSES.map(s => ({
    ...s,
    n: tasks.filter(t => t.status === s.id).length,
  }));

  const projectStats = projects.map(p => {
    const ts = tasks.filter(t => t.project === p.id);
    const d  = ts.filter(t => t.status === 'done').length;
    return { ...p, total: ts.length, done: d, pct: ts.length ? d / ts.length : 0 };
  });

  // Workload chart: one bar per day for the selected range
  // Group by week when range > 14 days for readability
  const groupByWeek = rangeDays > 14;
  const days = groupByWeek
    ? Array.from({ length: Math.ceil(rangeDays / 7) }, (_, wi) => {
        const weekStart = new Date(today); weekStart.setDate(weekStart.getDate() + wi * 7);
        const weekEnd   = new Date(today); weekEnd.setDate(weekEnd.getDate() + Math.min((wi + 1) * 7 - 1, rangeDays - 1));
        const count = tasks.filter(t => {
          if (!t.due || t.status === 'done') return false;
          const d = new Date(t.due + 'T00:00:00');
          return d >= weekStart && d <= weekEnd;
        }).length;
        const label = `S${wi + 1}`;
        return { label, count, iso: weekStart.toISOString().slice(0, 10) };
      })
    : Array.from({ length: rangeDays }, (_, i) => {
        const d = new Date(today); d.setDate(d.getDate() + i);
        const iso = d.toISOString().slice(0, 10);
        const count = tasks.filter(t => t.due === iso && t.status !== 'done').length;
        return { label: d.toLocaleDateString('es', { weekday: 'short', day: 'numeric' }), count, iso };
      });
  const maxDay = Math.max(...days.map(d => d.count), 1);

  return (
    <div className="p-4 md:p-6 max-w-[1200px]">
      {/* Hero */}
      <div className="flex items-start justify-between mb-6 gap-3">
        <div className="min-w-0">
          <div className="text-[11px] font-semibold tracking-widest uppercase mb-1" style={{ color: 'var(--ink-4)' }}>
            {today.toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long' })}
          </div>
          <h1 className="text-[24px] md:text-[28px] font-bold tracking-tight leading-tight" style={{ color: 'var(--ink)' }}>
            Hola, {me.name.split(' ')[0]}.
          </h1>
          <p className="text-[13px] md:text-[14px] mt-1" style={{ color: 'var(--ink-3)' }}>
            Tienes <strong style={{ color: 'var(--ink)' }}>{myTasks.length}</strong> tareas activas
            {' '}y <strong style={{ color: overdue.length > 0 ? 'var(--danger)' : 'var(--ink)' }}>{dueInRange.length}</strong> vencen en los próximos {RANGE_OPTIONS.find(r => r.days === rangeDays)?.label ?? `${rangeDays} días`}.
          </p>
        </div>
        <select
          value={rangeDays}
          onChange={e => setRangeDays(Number(e.target.value))}
          className="h-8 px-2 rounded-[7px] text-[12px] outline-none cursor-pointer flex-shrink-0"
          style={{
            border: '1px solid var(--line)',
            background: 'var(--surface)',
            color: 'var(--ink)',
            fontFamily: 'var(--font)',
          }}
        >
          {RANGE_OPTIONS.map(opt => (
            <option key={opt.days} value={opt.days}>{opt.label}</option>
          ))}
        </select>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        {[
          { icon: <CheckCircle size={15} />, label: 'Completadas', value: `${done}`, sub: `${completionRate}% del total`, color: 'var(--accent)' },
          { icon: <Flag size={15} />,        label: 'Atrasadas',   value: `${overdue.length}`, sub: overdue.length > 0 ? 'Requieren atención' : 'Al día', color: overdue.length > 0 ? 'var(--danger)' : 'var(--accent)' },
          { icon: <Clock size={15} />,       label: 'Horas estimadas', value: `${totalEstimate}h`, sub: `${totalSpent}h registradas`, color: 'var(--ink-3)' },
          { icon: <TrendingUp size={15} />,  label: 'En progreso', value: `${tasks.filter(t => t.status === 'doing' || t.status === 'review').length}`, sub: 'doing + revisión', color: 'var(--sem-orange)' },
        ].map(kpi => (
          <div
            key={kpi.label}
            className="rounded-[var(--radius-l)] p-4"
            style={{ background: 'var(--surface)', border: '1px solid var(--line)' }}
          >
            <div className="flex items-center gap-2 mb-2" style={{ color: kpi.color }}>
              {kpi.icon}
              <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--ink-4)' }}>{kpi.label}</span>
            </div>
            <div className="text-[24px] font-bold tracking-tight" style={{ color: 'var(--ink)' }}>{kpi.value}</div>
            <div className="text-[11px] mt-[2px]" style={{ color: 'var(--ink-4)' }}>{kpi.sub}</div>
          </div>
        ))}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Estado general */}
        <Card className="col-span-1 md:col-span-2">
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
              <div key={s.id} style={{ flex: s.n, background: s.tone }} title={`${s.label}: ${s.n}`} />
            ))}
          </div>
        </Card>

        {/* Mis tareas */}
        <Card>
          <CardHead title="Mis tareas activas" meta={`${myTasks.length} pendientes`} />
          <TaskList>
            {myTasks.slice(0, 5).map(t => (
              <TaskRow key={t.id} task={t} onClick={() => onOpenTask?.(t)} />
            ))}
            {myTasks.length === 0 && <Empty text="Nada pendiente. Bien." />}
          </TaskList>
        </Card>

        {/* Carga semanal */}
        <Card>
          <CardHead title="Vencimientos próximos" meta={`${dueInRange.length} tareas`} />
          <div className="flex items-end gap-[6px] h-[80px] mt-2">
            {days.map(d => (
              <div key={d.iso} className="flex-1 flex flex-col items-center gap-1">
                <div
                  className="w-full rounded-t-[3px] transition-all"
                  style={{
                    height: d.count > 0 ? `${Math.round((d.count / maxDay) * 60) + 4}px` : '4px',
                    background: d.count > 0 ? 'var(--accent)' : 'var(--bg-3)',
                    opacity: d.count > 0 ? 1 : 0.5,
                  }}
                  title={`${d.count} tareas`}
                />
                <span className="text-[9px] leading-none" style={{ color: 'var(--ink-4)' }}>
                  {d.label.split(' ')[0]}
                </span>
              </div>
            ))}
          </div>
          {overdue.length > 0 && (
            <div
              className="flex items-center gap-[6px] text-[11px] font-medium px-2 py-1 rounded-[5px] mt-3"
              style={{ color: 'var(--danger)', background: 'var(--danger-bg)' }}
            >
              <Flag size={12} /> {overdue.length} tarea{overdue.length !== 1 ? 's' : ''} atrasada{overdue.length !== 1 ? 's' : ''}
            </div>
          )}
        </Card>

        {/* Proyectos */}
        <Card className="col-span-1 md:col-span-2">
          <CardHead title="Progreso por proyecto" meta={`${projectStats.filter(p => p.total > 0).length} activos`} />
          <div className="flex flex-col gap-3">
            {projectStats.filter(p => p.total > 0).map(p => (
              <div key={p.id} className="flex items-center gap-4">
                <span className="w-[10px] h-[10px] rounded-[3px] flex-shrink-0" style={{ background: p.color }} />
                <span className="text-[13px] w-[220px] truncate" style={{ color: 'var(--ink)' }}>
                  {p.client && (
                    <span style={{ color: 'var(--ink-4)' }}>{p.client} · </span>
                  )}
                  {p.name}
                </span>
                <div className="flex-1 h-[6px] rounded-full overflow-hidden" style={{ background: 'var(--bg-3)' }}>
                  <div className="h-full rounded-full transition-all" style={{ width: `${p.pct * 100}%`, background: p.color }} />
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

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-[var(--radius-l)] p-5 ${className}`}
      style={{ background: 'var(--surface)', border: '1px solid var(--line)', boxShadow: 'var(--shadow-1)' }}
    >
      {children}
    </div>
  );
}

function CardHead({ title, meta }: { title: string; meta?: string }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <h3 className="text-[13.5px] font-semibold" style={{ color: 'var(--ink)' }}>{title}</h3>
      {meta && <span className="text-[11px]" style={{ color: 'var(--ink-3)' }}>{meta}</span>}
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
    urgent: 'var(--sem-red-2)',
    high:   'var(--sem-orange)',
    med:    'var(--sem-blue-gray-med)',
    low:    'var(--sem-blue-gray-low)',
  };
  return <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: colors[priority] ?? colors.med }} />;
}

function Empty({ text }: { text: string }) {
  return <div className="py-4 text-center text-[13px]" style={{ color: 'var(--ink-4)' }}>{text}</div>;
}
