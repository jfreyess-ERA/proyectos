'use client';
import { avatarBg } from '@/lib/data';
import type { Task, Project, User } from '@/lib/types';

interface Props {
  tasks: Task[];
  projects: Project[];
  users: User[];
  onOpenTask: (task: Task) => void;
}

export function PeopleView({ tasks, projects, users }: Props) {
  const stats = users.map(u => {
    const assigned = tasks.filter(t => t.assignees.includes(u.id));
    const active = assigned.filter(t => t.status !== 'done');
    const done = assigned.filter(t => t.status === 'done').length;

    const projectIds = [...new Set(active.map(t => t.project))];
    const activeProjects = projectIds
      .map(id => projects.find(p => p.id === id))
      .filter(Boolean) as Project[];

    const byStatus = {
      urgent: active.filter(t => t.priority === 'urgent').length,
      doing:  active.filter(t => t.status === 'doing').length,
      review: active.filter(t => t.status === 'review').length,
    };

    return { user: u, active, done, activeProjects, byStatus };
  });

  return (
    <div className="p-6 max-w-[1100px]">
      <div className="mb-6">
        <h1 className="text-[24px] font-bold tracking-tight" style={{ color: 'var(--ink)' }}>
          Equipo
        </h1>
        <p className="text-[14px] mt-1" style={{ color: 'var(--ink-3)' }}>
          {users.length} personas · {tasks.filter(t => t.status !== 'done').length} tareas activas en total
        </p>
      </div>

      <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))' }}>
        {stats.map(({ user, active, done, activeProjects, byStatus }) => (
          <div
            key={user.id}
            className="rounded-[12px] p-5 flex flex-col gap-4"
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--line)',
              boxShadow: 'var(--shadow-1)',
            }}
          >
            {/* Avatar + name */}
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold text-[14px] flex-shrink-0"
                style={{ background: avatarBg(user.hue) }}
              >
                {user.initials}
              </div>
              <div className="min-w-0">
                <div className="text-[14px] font-semibold truncate" style={{ color: 'var(--ink)' }}>
                  {user.name}
                </div>
                <div className="text-[12px]" style={{ color: 'var(--ink-3)' }}>{user.role}</div>
              </div>
              <div className="ml-auto text-right flex-shrink-0">
                <div className="text-[22px] font-bold tabular-nums" style={{ color: 'var(--ink)' }}>
                  {active.length}
                </div>
                <div className="text-[11px]" style={{ color: 'var(--ink-4)' }}>activas</div>
              </div>
            </div>

            {/* Stats pills */}
            <div className="flex gap-2 flex-wrap">
              {byStatus.urgent > 0 && (
                <span
                  className="text-[11px] font-medium px-2 py-[3px] rounded-full"
                  style={{ background: 'oklch(0.96 0.03 25)', color: 'oklch(0.52 0.18 25)' }}
                >
                  {byStatus.urgent} urgente{byStatus.urgent > 1 ? 's' : ''}
                </span>
              )}
              {byStatus.doing > 0 && (
                <span
                  className="text-[11px] font-medium px-2 py-[3px] rounded-full"
                  style={{ background: 'var(--accent-bg)', color: 'var(--accent)' }}
                >
                  {byStatus.doing} en curso
                </span>
              )}
              {byStatus.review > 0 && (
                <span
                  className="text-[11px] font-medium px-2 py-[3px] rounded-full"
                  style={{ background: 'oklch(0.96 0.02 38)', color: 'oklch(0.52 0.13 38)' }}
                >
                  {byStatus.review} en revisión
                </span>
              )}
              {done > 0 && (
                <span
                  className="text-[11px] font-medium px-2 py-[3px] rounded-full"
                  style={{ background: 'oklch(0.96 0.03 160)', color: 'oklch(0.45 0.12 160)' }}
                >
                  {done} completadas
                </span>
              )}
              {active.length === 0 && (
                <span className="text-[12px]" style={{ color: 'var(--ink-4)' }}>Sin tareas activas</span>
              )}
            </div>

            {/* Projects */}
            {activeProjects.length > 0 && (
              <div className="flex flex-col gap-[6px]">
                <div className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--ink-4)' }}>
                  Proyectos activos
                </div>
                {activeProjects.map(p => {
                  const pTasks = active.filter(t => t.project === p.id);
                  return (
                    <div key={p.id} className="flex items-center gap-2">
                      <span className="w-[8px] h-[8px] rounded-[2px] flex-shrink-0" style={{ background: p.color }} />
                      <span className="text-[12px] flex-1 truncate" style={{ color: 'var(--ink-2)' }}>{p.name}</span>
                      <span className="text-[11px] tabular-nums" style={{ color: 'var(--ink-4)' }}>
                        {pTasks.length} tarea{pTasks.length > 1 ? 's' : ''}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
