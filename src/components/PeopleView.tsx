'use client';
import { useState } from 'react';
import { avatarBg } from '@/lib/data';
import { CalendarView } from './CalendarView';
import { TaskFilterBar, applyTaskFilters, applySubtaskFilters, EMPTY_FILTERS, type TaskFilterState } from './TaskFilterBar';
import type { Task, Project, User, DatedSubtask } from '@/lib/types';

interface Props {
  tasks: Task[];
  projects: Project[];
  users: User[];
  datedSubtasks: DatedSubtask[];
  onOpenTask: (task: Task) => void;
  onOpenProject: (projectId: string) => void;
}

type ViewMode = 'cards' | 'calendar-week' | 'calendar-month';

export function PeopleView({ tasks, projects, users, datedSubtasks, onOpenTask, onOpenProject }: Props) {
  const [viewMode, setViewMode] = useState<ViewMode>('cards');
  const [personFilter, setPersonFilter] = useState<string>('all');
  const [filters, setFilters] = useState<TaskFilterState>(EMPTY_FILTERS);

  const isCalendar = viewMode !== 'cards';

  const filtered = applyTaskFilters(tasks, projects, filters);

  const visibleUsers = personFilter === 'all' ? users : users.filter(u => u.id === personFilter);

  // Tasks shown in calendar modes: all team tasks, or one person's when filtered.
  const calendarTasks = personFilter === 'all'
    ? filtered
    : filtered.filter(t => t.assignees.includes(personFilter));

  // Subtasks shown alongside: when a person is selected, their assigned subtasks (even on tasks
  // not assigned to them); otherwise every dated subtask matching the active client/project/etc filters.
  const calendarSubtaskEvents = applySubtaskFilters(
    datedSubtasks, tasks, projects,
    personFilter === 'all' ? filters : { ...filters, assignee: personFilter },
  );

  const stats = visibleUsers.map(u => {
    const assigned = filtered.filter(t => t.assignees.includes(u.id));
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
    <div className={isCalendar ? 'flex flex-col h-full' : 'p-6 max-w-[1100px]'}>
      {/* Header */}
      <div className={isCalendar ? 'px-6 pt-6 pb-3 flex items-start justify-between flex-wrap gap-3' : 'mb-6 flex items-start justify-between flex-wrap gap-3'}>
        <div>
          <h1 className="text-[24px] font-bold tracking-tight" style={{ color: 'var(--ink)' }}>
            Equipo
          </h1>
          <p className="text-[14px] mt-1" style={{ color: 'var(--ink-3)' }}>
            {visibleUsers.length} {visibleUsers.length === 1 ? 'persona' : 'personas'} ·{' '}
            {calendarTasks.filter(t => t.status !== 'done').length} tareas activas
            {personFilter === 'all' ? ' en total' : ''}
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* Person filter */}
          <label className="flex items-center gap-2 text-[12px]" style={{ color: 'var(--ink-3)' }}>
            <span className="font-medium">Persona:</span>
            <select
              value={personFilter}
              onChange={e => setPersonFilter(e.target.value)}
              className="h-8 px-2 rounded-[7px] border text-[12px] outline-none"
              style={{ background: 'var(--bg-2)', borderColor: 'var(--line)', color: 'var(--ink)', fontFamily: 'var(--font)' }}
            >
              <option value="all">Todas</option>
              {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </label>

          {/* View toggle */}
          <div className="inline-flex rounded-[8px] border overflow-hidden" style={{ borderColor: 'var(--line)' }}>
            <ViewTab active={viewMode === 'cards'}           onClick={() => setViewMode('cards')}>Tarjetas</ViewTab>
            <ViewTab active={viewMode === 'calendar-week'}   onClick={() => setViewMode('calendar-week')} border>Calendario · Semana</ViewTab>
            <ViewTab active={viewMode === 'calendar-month'}  onClick={() => setViewMode('calendar-month')} border>Calendario · Mes</ViewTab>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className={isCalendar ? 'px-6 pb-3' : 'mb-5'}>
        <TaskFilterBar
          filters={filters}
          onChange={setFilters}
          projects={projects}
          show={['client', 'project', 'status', 'priority']}
        />
      </div>

      {isCalendar && (
        <div className="flex-1 min-h-0">
          <CalendarView
            tasks={calendarTasks}
            onOpenTask={onOpenTask}
            viewMode={viewMode === 'calendar-week' ? 'week' : 'month'}
            showAssignees={personFilter === 'all'}
            subtaskEvents={calendarSubtaskEvents}
          />
        </div>
      )}

      {viewMode === 'cards' && (
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
                      <button
                        key={p.id}
                        onClick={() => onOpenProject(p.id)}
                        className="flex items-center gap-2 -mx-1 px-1 py-[2px] rounded-[6px] text-left transition-colors"
                        style={{ background: 'transparent' }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-3)'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                      >
                        <span className="w-[8px] h-[8px] rounded-[2px] flex-shrink-0" style={{ background: p.color }} />
                        <span className="text-[12px] flex-1 truncate">
                          {p.client && (
                            <span style={{ color: 'var(--ink-4)' }}>{p.client} · </span>
                          )}
                          <span style={{ color: 'var(--ink-2)' }}>{p.name}</span>
                        </span>
                        <span className="text-[11px] tabular-nums" style={{ color: 'var(--ink-4)' }}>
                          {pTasks.length} tarea{pTasks.length > 1 ? 's' : ''}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ViewTab({ active, onClick, children, border }: { active: boolean; onClick: () => void; children: React.ReactNode; border?: boolean }) {
  return (
    <button
      onClick={onClick}
      className="h-8 px-3 text-[12.5px] font-medium border-0 transition-colors"
      style={{
        background: active ? 'var(--surface)' : 'transparent',
        color: active ? 'var(--ink)' : 'var(--ink-3)',
        boxShadow: active ? 'var(--shadow-1)' : 'none',
        borderLeft: border ? '1px solid var(--line)' : undefined,
      }}
    >
      {children}
    </button>
  );
}
