'use client';
import { STATUSES, PRIORITIES, PEOPLE, avatarBg } from '@/lib/data';
import type { Task, Project } from '@/lib/types';

interface Props {
  tasks: Task[];
  projects: Project[];
}

export function ReportsView({ tasks, projects }: Props) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const activeTasks = tasks.filter(t => t.status !== 'done');
  const overdue = tasks.filter(t =>
    t.status !== 'done' && t.due && new Date(t.due + 'T00:00:00') < today
  );

  const statusCounts = STATUSES.map(s => ({
    ...s,
    n: tasks.filter(t => t.status === s.id).length,
  }));
  const total = statusCounts.reduce((a, b) => a + b.n, 0);

  const priorityCounts = PRIORITIES.map(p => ({
    ...p,
    n: activeTasks.filter(t => t.priority === p.id).length,
  }));

  const projectStats = projects.map(p => {
    const pt = tasks.filter(t => t.project === p.id);
    const done = pt.filter(t => t.status === 'done').length;
    const pct = pt.length ? done / pt.length : 0;
    const totalEst = pt.reduce((a, t) => a + (t.estimate || 0), 0);
    const totalSpent = pt.reduce((a, t) => a + (t.spent || 0), 0);
    return { ...p, total: pt.length, done, pct, totalEst, totalSpent };
  });

  const workload = PEOPLE.map(u => {
    const assigned = activeTasks.filter(t => t.assignees.includes(u.id));
    const urgentHigh = assigned.filter(t => t.priority === 'urgent' || t.priority === 'high').length;
    return { user: u, count: assigned.length, urgentHigh };
  }).sort((a, b) => b.count - a.count);

  const maxWorkload = Math.max(...workload.map(w => w.count), 1);

  return (
    <div className="p-6 max-w-[1100px]">
      <div className="mb-6">
        <h1 className="text-[24px] font-bold tracking-tight" style={{ color: 'var(--ink)' }}>
          Reportes
        </h1>
        <p className="text-[14px] mt-1" style={{ color: 'var(--ink-3)' }}>
          {total} tareas en total · {activeTasks.length} activas · {overdue.length} atrasadas
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">

        {/* Estado general */}
        <Card className="col-span-2">
          <SectionTitle>Estado del trabajo</SectionTitle>
          <div className="flex gap-8 mb-4 flex-wrap">
            {statusCounts.map(s => (
              <div key={s.id} className="flex flex-col gap-1">
                <div className="flex items-center gap-[6px]">
                  <span className="w-2 h-2 rounded-full" style={{ background: s.tone }} />
                  <span className="text-[12px]" style={{ color: 'var(--ink-3)' }}>{s.label}</span>
                </div>
                <span className="text-[28px] font-bold tabular-nums" style={{ color: 'var(--ink)' }}>{s.n}</span>
                <span className="text-[11px]" style={{ color: 'var(--ink-4)' }}>
                  {total > 0 ? Math.round(s.n / total * 100) : 0}%
                </span>
              </div>
            ))}
          </div>
          <div className="flex rounded-full overflow-hidden h-[8px]" style={{ background: 'var(--bg-3)' }}>
            {statusCounts.map(s => s.n > 0 && (
              <div
                key={s.id}
                style={{ flex: s.n, background: s.tone, transition: 'flex .3s' }}
                title={`${s.label}: ${s.n}`}
              />
            ))}
          </div>
        </Card>

        {/* Progreso por proyecto */}
        <Card className="col-span-2">
          <SectionTitle>Progreso por proyecto</SectionTitle>
          <div className="flex flex-col gap-4">
            {projectStats.map(p => (
              <div key={p.id} className="flex flex-col gap-[6px]">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-[10px] h-[10px] rounded-[3px]" style={{ background: p.color }} />
                    <span className="text-[13px] font-medium" style={{ color: 'var(--ink)' }}>{p.name}</span>
                  </div>
                  <div className="flex items-center gap-4 text-[12px]" style={{ color: 'var(--ink-3)' }}>
                    <span>{p.done}/{p.total} tareas</span>
                    {p.totalEst > 0 && (
                      <span>{p.totalSpent}h / {p.totalEst}h estimadas</span>
                    )}
                    <span className="font-semibold w-[36px] text-right" style={{ color: 'var(--ink-2)' }}>
                      {Math.round(p.pct * 100)}%
                    </span>
                  </div>
                </div>
                <div className="h-[6px] rounded-full overflow-hidden" style={{ background: 'var(--bg-3)' }}>
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${p.pct * 100}%`, background: p.color }}
                  />
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Carga por persona */}
        <Card>
          <SectionTitle>Carga de trabajo</SectionTitle>
          <div className="flex flex-col gap-3">
            {workload.map(({ user, count, urgentHigh }) => (
              <div key={user.id} className="flex items-center gap-3">
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[11px] font-semibold flex-shrink-0"
                  style={{ background: avatarBg(user.hue) }}
                >
                  {user.initials}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-[4px]">
                    <span className="text-[12.5px] font-medium truncate" style={{ color: 'var(--ink)' }}>
                      {user.name.split(' ')[0]}
                    </span>
                    <span className="text-[11px] tabular-nums ml-2 flex-shrink-0" style={{ color: 'var(--ink-3)' }}>
                      {count} tarea{count !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <div className="h-[5px] rounded-full overflow-hidden" style={{ background: 'var(--bg-3)' }}>
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${(count / maxWorkload) * 100}%`,
                        background: urgentHigh > 0
                          ? 'oklch(0.62 0.16 265)'
                          : 'oklch(0.60 0.14 160)',
                      }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Distribución de prioridad */}
        <Card>
          <SectionTitle>Tareas activas por prioridad</SectionTitle>
          <div className="flex flex-col gap-3 mt-2">
            {priorityCounts.map(p => (
              <div key={p.id} className="flex items-center gap-3">
                <span
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ background: p.tone }}
                />
                <span className="text-[13px] w-[80px]" style={{ color: 'var(--ink-2)' }}>{p.label}</span>
                <div className="flex-1 h-[6px] rounded-full overflow-hidden" style={{ background: 'var(--bg-3)' }}>
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: activeTasks.length > 0 ? `${(p.n / activeTasks.length) * 100}%` : '0%',
                      background: p.tone,
                    }}
                  />
                </div>
                <span className="text-[13px] font-semibold tabular-nums w-[28px] text-right" style={{ color: 'var(--ink)' }}>
                  {p.n}
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
      className={`rounded-[12px] p-5 ${className}`}
      style={{ background: 'var(--surface)', border: '1px solid var(--line)', boxShadow: 'var(--shadow-1)' }}
    >
      {children}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[13px] font-semibold mb-4" style={{ color: 'var(--ink)' }}>{children}</div>
  );
}
