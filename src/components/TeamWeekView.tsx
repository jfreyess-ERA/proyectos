'use client';
import { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, ChevronDown, Clock, Flag } from 'lucide-react';
import { avatarBg, fmtDate, dueClass } from '@/lib/data';
import { CalendarView } from './CalendarView';
import { WeekGrid, computeWeeklyLoad } from './WeekGrid';
import { TaskFilterBar, applyTaskFilters, applySubtaskFilters, EMPTY_FILTERS, type TaskFilterState } from './TaskFilterBar';
import type { Task, Project, User, DatedSubtask } from '@/lib/types';

interface Props {
  tasks: Task[];
  projects: Project[];
  users: User[];
  datedSubtasks: DatedSubtask[];
  onOpenTask: (task: Task) => void;
  onOpenProject: (projectId: string) => void;
  onOpenSubtask?: (subtask: DatedSubtask, task: Task) => void;
  onToggleSubtask?: (subtask: DatedSubtask, task: Task, done: boolean) => void;
}

const PRIORITY_COLORS: Record<string, string> = {
  urgent: 'var(--sem-red-2)',
  high:   'var(--sem-orange)',
  med:    'var(--sem-blue-gray-med)',
  low:    'var(--sem-blue-gray-low)',
};

const STATUS_LABELS: Record<string, string> = {
  backlog: 'Backlog',
  todo: 'Por hacer',
  doing: 'En curso',
  review: 'En revisión',
  done: 'Completado',
};

const STATUS_TONES: Record<string, string> = {
  backlog: 'oklch(0.55 0.02 250)',
  todo:    'oklch(0.55 0.05 250)',
  doing:   'var(--sem-indigo)',
  review:  'var(--sem-amber)',
  done:    'var(--sem-green-2)',
};

function startOfWeek(d: Date): Date {
  const date = new Date(d);
  date.setHours(0, 0, 0, 0);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1); // Monday
  date.setDate(diff);
  return date;
}

function addDays(d: Date, n: number): Date {
  const date = new Date(d);
  date.setDate(date.getDate() + n);
  return date;
}

function fmtRange(monday: Date): string {
  const sunday = addDays(monday, 6);
  const sameMonth = monday.getMonth() === sunday.getMonth();
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: sameMonth ? undefined : 'short' };
  return `${monday.toLocaleDateString('es', opts)} — ${sunday.toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' })}`;
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

interface Buckets {
  overdue: Task[];
  dueThisWeek: Task[];
  inProgress: Task[];
  pending: Task[];
  completedThisWeek: Task[];
  activeCount: number;
}

function computeBuckets(taskList: Task[], weekStartISO: string, weekEndISO: string): Buckets {
  const active = taskList.filter(t => t.status !== 'done');
  const dueThisWeek = active.filter(t => t.due && t.due >= weekStartISO && t.due <= weekEndISO);
  const overdue = active.filter(t => t.due && t.due < weekStartISO);
  const inProgressAll = active.filter(t => t.status === 'doing');
  const seenIds = new Set([...dueThisWeek, ...overdue].map(t => t.id));
  const inProgress = inProgressAll.filter(t => !seenIds.has(t.id));
  const pending = active.filter(t => !seenIds.has(t.id) && t.status !== 'doing' && (t.status === 'todo' || t.status === 'review' || t.status === 'backlog'));
  const completedThisWeek = taskList.filter(t => t.status === 'done' && t.due && t.due >= weekStartISO && t.due <= weekEndISO);
  return { overdue, dueThisWeek, inProgress, pending, completedThisWeek, activeCount: active.length };
}

type GroupBy = 'person' | 'project';
type ViewMode = 'grid' | 'panel' | 'calendar-week' | 'calendar-month';

export function TeamWeekView({ tasks, projects, users, datedSubtasks, onOpenTask, onOpenProject, onOpenSubtask, onToggleSubtask }: Props) {
  const [weekStart, setWeekStart] = useState<Date>(() => startOfWeek(new Date()));
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [showEmpty, setShowEmpty] = useState(false);
  const [groupBy, setGroupBy]     = useState<GroupBy>('person');
  const [viewMode, setViewMode]   = useState<ViewMode>('grid');
  const [filters, setFilters]     = useState<TaskFilterState>(EMPTY_FILTERS);

  const filteredTasks = useMemo(() => applyTaskFilters(tasks, projects, filters), [tasks, projects, filters]);
  const filteredSubtaskEvents = useMemo(
    () => applySubtaskFilters(datedSubtasks, tasks, projects, filters),
    [datedSubtasks, tasks, projects, filters],
  );

  const weekEnd = addDays(weekStart, 6);
  const weekStartISO = isoDate(weekStart);
  const weekEndISO = isoDate(weekEnd);
  const todayISO = isoDate(new Date());
  const isCalendar = viewMode === 'calendar-week' || viewMode === 'calendar-month';
  const isGrid = viewMode === 'grid';

  // ── Person rows ─────────────────────────────────────────────────
  const personRows = useMemo(() => {
    return users.map(u => {
      const mine = filteredTasks.filter(t => t.assignees.includes(u.id));
      return { user: u, ...computeBuckets(mine, weekStartISO, weekEndISO) };
    });
  }, [users, filteredTasks, weekStartISO, weekEndISO]);

  // ── Project rows (grouped by client) ────────────────────────────
  const clientSections = useMemo(() => {
    const projRows = projects.map(p => {
      const pt = filteredTasks.filter(t => t.project === p.id);
      return { project: p, ...computeBuckets(pt, weekStartISO, weekEndISO) };
    });
    const byClient = new Map<string, typeof projRows>();
    for (const r of projRows) {
      const key = r.project.client ?? 'Sin cliente';
      if (!byClient.has(key)) byClient.set(key, []);
      byClient.get(key)!.push(r);
    }
    // sort each client's projects alphabetically
    for (const arr of byClient.values()) arr.sort((a, b) => a.project.name.localeCompare(b.project.name));
    return [...byClient.entries()]
      .map(([client, rows]) => ({ client, rows }))
      .sort((a, b) => a.client.localeCompare(b.client));
  }, [projects, filteredTasks, weekStartISO, weekEndISO]);

  // ── Totals ──────────────────────────────────────────────────────
  const totalActive = groupBy === 'person'
    ? personRows.reduce((s, r) => s + r.activeCount, 0)
    // sum only distinct active tasks (each task once) — but each task belongs to one project, so summing works
    : clientSections.reduce((s, sec) => s + sec.rows.reduce((ss, r) => ss + r.activeCount, 0), 0);
  const totalOverdue = groupBy === 'person'
    ? personRows.reduce((s, r) => s + r.overdue.length, 0)
    : clientSections.reduce((s, sec) => s + sec.rows.reduce((ss, r) => ss + r.overdue.length, 0), 0);
  const weeklyLoad = useMemo(() => computeWeeklyLoad(users, filteredTasks, weekStart), [users, filteredTasks, weekStart]);
  const visiblePersons = showEmpty ? personRows : personRows.filter(r => r.activeCount > 0 || r.completedThisWeek.length > 0);
  const visibleClientSections = groupBy === 'project'
    ? clientSections.map(sec => ({
        ...sec,
        rows: showEmpty ? sec.rows : sec.rows.filter(r => r.activeCount > 0 || r.completedThisWeek.length > 0),
      })).filter(sec => sec.rows.length > 0)
    : [];

  return (
    <div className={isCalendar ? 'flex flex-col h-full' : 'p-6 max-w-[1200px]'}>
      {/* Header */}
      <div className={isCalendar ? 'px-6 pt-6 pb-3 flex items-start justify-between flex-wrap gap-4' : 'mb-6 flex items-start justify-between flex-wrap gap-4'}>
        <div>
          <h1 className="text-[24px] font-bold tracking-tight" style={{ color: 'var(--ink)' }}>
            Panel del equipo
          </h1>
          <p className="text-[14px] mt-1" style={{ color: 'var(--ink-3)' }}>
            {groupBy === 'person' ? `${personRows.length} personas` : `${projects.length} proyectos`} · {totalActive} tareas activas
            {totalOverdue > 0 && (
              <span className="ml-2 font-medium" style={{ color: 'var(--danger)' }}>
                · {totalOverdue} atrasadas
              </span>
            )}
            {weeklyLoad.capacity > 0 && (
              <span
                className="ml-2 font-medium"
                style={{ color: weeklyLoad.hours > weeklyLoad.capacity ? 'var(--danger)' : 'var(--ink-3)' }}
                title="Horas estimadas de tareas activas con vencimiento hasta el domingo, vs. capacidad semanal del equipo"
              >
                · {weeklyLoad.hours}h / {weeklyLoad.capacity}h esta semana
              </span>
            )}
          </p>
        </div>

        {/* Week picker — panel mode only (calendar has its own nav) */}
        {!isCalendar && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setWeekStart(w => addDays(w, -7))}
              className="w-8 h-8 flex items-center justify-center rounded-[6px] border transition-colors"
              style={{ background: 'var(--surface)', borderColor: 'var(--line)', color: 'var(--ink-2)' }}
              aria-label="Semana anterior"
            >
              <ChevronLeft size={15} />
            </button>
            <div
              className="h-8 px-3 flex items-center rounded-[6px] border text-[12px] font-medium"
              style={{ background: 'var(--surface)', borderColor: 'var(--line)', color: 'var(--ink)', minWidth: 220, justifyContent: 'center' }}
            >
              {fmtRange(weekStart)}
            </div>
            <button
              onClick={() => setWeekStart(w => addDays(w, 7))}
              className="w-8 h-8 flex items-center justify-center rounded-[6px] border transition-colors"
              style={{ background: 'var(--surface)', borderColor: 'var(--line)', color: 'var(--ink-2)' }}
              aria-label="Semana siguiente"
            >
              <ChevronRight size={15} />
            </button>
            <input
              type="date"
              value={weekStartISO}
              onChange={e => e.target.value && setWeekStart(startOfWeek(new Date(e.target.value + 'T00:00:00')))}
              className="h-8 px-2 rounded-[6px] border text-[12px] outline-none"
              style={{ background: 'var(--surface)', borderColor: 'var(--line)', color: 'var(--ink-2)' }}
            />
            <button
              onClick={() => setWeekStart(startOfWeek(new Date()))}
              className="h-8 px-3 rounded-[6px] border text-[12px] font-medium transition-colors"
              style={{ background: 'var(--surface)', borderColor: 'var(--line)', color: 'var(--ink-2)' }}
            >
              Hoy
            </button>
          </div>
        )}
      </div>

      {/* View toggle */}
      <div className={isCalendar ? 'px-6 pb-3' : 'mb-4'}>
        <div className="inline-flex rounded-[8px] border overflow-hidden" style={{ borderColor: 'var(--line)' }}>
          <ViewTab active={viewMode === 'grid'}            onClick={() => setViewMode('grid')}>Grilla semanal</ViewTab>
          <ViewTab active={viewMode === 'panel'}           onClick={() => setViewMode('panel')} border>Panel</ViewTab>
          <ViewTab active={viewMode === 'calendar-week'}   onClick={() => setViewMode('calendar-week')} border>Calendario · Semana</ViewTab>
          <ViewTab active={viewMode === 'calendar-month'}  onClick={() => setViewMode('calendar-month')} border>Calendario · Mes</ViewTab>
        </div>
      </div>

      {/* Filters */}
      <div className={isCalendar ? 'px-6 pb-3' : 'mb-4'}>
        <TaskFilterBar
          filters={filters}
          onChange={setFilters}
          projects={projects}
          users={users}
          trailing={!isCalendar ? (
            <label className="flex items-center gap-2 text-[12px]" style={{ color: 'var(--ink-3)' }}>
              <input type="checkbox" checked={showEmpty} onChange={e => setShowEmpty(e.target.checked)} />
              Mostrar {isGrid || groupBy === 'person' ? 'personas' : 'proyectos'} sin tareas activas
            </label>
          ) : undefined}
        />
      </div>

      {/* Calendar modes */}
      {isCalendar && (
        <div className="flex-1 min-h-0">
          <CalendarView
            tasks={filteredTasks}
            onOpenTask={onOpenTask}
            viewMode={viewMode === 'calendar-week' ? 'week' : 'month'}
            showAssignees
            subtaskEvents={filteredSubtaskEvents}
            onOpenSubtask={onOpenSubtask}
            onToggleSubtask={onToggleSubtask}
          />
        </div>
      )}

      {/* Grilla semanal: persona × día */}
      {isGrid && (
        <WeekGrid
          weekStart={weekStart}
          users={users}
          tasks={filteredTasks}
          subtaskEvents={filteredSubtaskEvents}
          projects={projects}
          showEmpty={showEmpty}
          onOpenTask={onOpenTask}
          onOpenSubtask={onOpenSubtask}
          onToggleSubtask={onToggleSubtask}
        />
      )}

      {/* Panel: group-by toggle */}
      {viewMode === 'panel' && (
        <div className="mb-4">
          <div className="inline-flex rounded-[8px] border overflow-hidden" style={{ borderColor: 'var(--line)' }}>
            <button
              onClick={() => setGroupBy('person')}
              className="h-8 px-3 text-[12px] font-medium border-0 transition-colors"
              style={{
                background: groupBy === 'person' ? 'var(--surface)' : 'transparent',
                color: groupBy === 'person' ? 'var(--ink)' : 'var(--ink-3)',
                boxShadow: groupBy === 'person' ? 'var(--shadow-1)' : 'none',
              }}
            >
              Persona
            </button>
            <button
              onClick={() => setGroupBy('project')}
              className="h-8 px-3 text-[12px] font-medium border-0 transition-colors"
              style={{
                background: groupBy === 'project' ? 'var(--surface)' : 'transparent',
                color: groupBy === 'project' ? 'var(--ink)' : 'var(--ink-3)',
                boxShadow: groupBy === 'project' ? 'var(--shadow-1)' : 'none',
                borderLeft: '1px solid var(--line)',
              }}
            >
              Cliente → Proyecto
            </button>
          </div>
        </div>
      )}

      {/* Body */}
      {viewMode === 'panel' && groupBy === 'person' && (
        <div className="flex flex-col gap-3">
          {visiblePersons.map(row => (
            <EntityCard
              key={row.user.id}
              id={row.user.id}
              collapsed={!!collapsed[row.user.id]}
              onToggle={() => setCollapsed(c => ({ ...c, [row.user.id]: !c[row.user.id] }))}
              buckets={row}
              projects={projects}
              users={users}
              onOpenTask={onOpenTask}
              onOpenProject={onOpenProject}
              todayISO={todayISO}
              variant="person"
              user={row.user}
            />
          ))}
          {visiblePersons.length === 0 && (
            <EmptyState label="Nadie tiene tareas activas esta semana." />
          )}
        </div>
      )}

      {viewMode === 'panel' && groupBy === 'project' && (
        <div className="flex flex-col gap-6">
          {visibleClientSections.map(sec => (
            <section key={sec.client}>
              <div className="flex items-baseline gap-2 mb-2 px-1">
                <h2 className="text-[15px] font-bold" style={{ color: 'var(--ink)' }}>{sec.client}</h2>
                <span className="text-[11px] tabular-nums" style={{ color: 'var(--ink-4)' }}>
                  {sec.rows.length} proyecto{sec.rows.length > 1 ? 's' : ''}
                </span>
              </div>
              <div className="flex flex-col gap-2">
                {sec.rows.map(row => (
                  <EntityCard
                    key={row.project.id}
                    id={row.project.id}
                    collapsed={!!collapsed[row.project.id]}
                    onToggle={() => setCollapsed(c => ({ ...c, [row.project.id]: !c[row.project.id] }))}
                    buckets={row}
                    projects={projects}
                    users={users}
                    onOpenTask={onOpenTask}
                    onOpenProject={onOpenProject}
                    todayISO={todayISO}
                    variant="project"
                    project={row.project}
                  />
                ))}
              </div>
            </section>
          ))}
          {visibleClientSections.length === 0 && (
            <EmptyState label="Ningún proyecto tiene tareas activas esta semana." />
          )}
        </div>
      )}
    </div>
  );
}

// ── Entity card (person or project) ────────────────────────────────

interface EntityCardProps {
  id: string;
  collapsed: boolean;
  onToggle: () => void;
  buckets: Buckets;
  projects: Project[];
  users: User[];
  onOpenTask: (t: Task) => void;
  onOpenProject: (id: string) => void;
  todayISO: string;
  variant: 'person' | 'project';
  user?: User;
  project?: Project;
}

function EntityCard({ collapsed, onToggle, buckets, projects, users, onOpenTask, onOpenProject, todayISO, variant, user, project }: EntityCardProps) {
  const groups = [
    { key: 'overdue', title: 'Atrasadas', items: buckets.overdue, accent: 'var(--danger)' },
    { key: 'week', title: 'Vencen esta semana', items: buckets.dueThisWeek, accent: 'var(--sem-indigo)' },
    { key: 'doing', title: 'En curso', items: buckets.inProgress, accent: 'var(--sem-indigo)' },
    { key: 'pending', title: 'Pendientes', items: buckets.pending, accent: 'var(--ink-3)' },
    { key: 'done', title: 'Completadas esta semana', items: buckets.completedThisWeek, accent: 'var(--sem-green-2)' },
  ].filter(g => g.items.length > 0);

  const doingCount = buckets.inProgress.length + buckets.dueThisWeek.filter(t => t.status === 'doing').length;
  const pendingCount = buckets.pending.length + buckets.dueThisWeek.filter(t => t.status !== 'doing').length;

  return (
    <div
      className="rounded-[12px]"
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--line)',
        boxShadow: 'var(--shadow-1)',
      }}
    >
      {/* Header */}
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-5 py-4 text-left border-0 bg-transparent"
      >
        <ChevronDown
          size={16}
          style={{
            color: 'var(--ink-3)',
            flexShrink: 0,
            transform: collapsed ? 'rotate(-90deg)' : 'rotate(0deg)',
            transition: 'transform 150ms',
          }}
        />
        {variant === 'person' && user && (
          <>
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center text-white font-semibold text-[13px] flex-shrink-0"
              style={{ background: avatarBg(user.hue) }}
            >
              {user.initials}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[14px] font-semibold" style={{ color: 'var(--ink)' }}>{user.name}</div>
              <div className="text-[12px]" style={{ color: 'var(--ink-3)' }}>{user.role}</div>
            </div>
          </>
        )}
        {variant === 'project' && project && (
          <>
            <span className="w-3 h-3 rounded-[2px] flex-shrink-0" style={{ background: project.color }} />
            <div className="min-w-0 flex-1">
              <div className="text-[14px] font-semibold" style={{ color: 'var(--ink)' }}>
                <span
                  className="cursor-pointer hover:underline"
                  onClick={e => { e.stopPropagation(); onOpenProject(project.id); }}
                >
                  {project.name}
                </span>
              </div>
              {project.client && (
                <div className="text-[12px]" style={{ color: 'var(--ink-3)' }}>{project.client}</div>
              )}
            </div>
          </>
        )}
        <div className="flex items-center gap-2 flex-wrap justify-end">
          {buckets.overdue.length > 0 && (
            <Pill color="var(--danger)" bg="var(--danger-bg)" label={`${buckets.overdue.length} atrasada${buckets.overdue.length > 1 ? 's' : ''}`} />
          )}
          {doingCount > 0 && (
            <Pill color="var(--accent)" bg="var(--accent-bg)" label={`${doingCount} en curso`} />
          )}
          {pendingCount > 0 && (
            <Pill color="var(--ink-2)" bg="var(--bg-3)" label={`${pendingCount} pendientes`} />
          )}
          {buckets.completedThisWeek.length > 0 && (
            <Pill color="oklch(0.42 0.12 160)" bg="oklch(0.94 0.03 160)" label={`${buckets.completedThisWeek.length} completada${buckets.completedThisWeek.length > 1 ? 's' : ''}`} />
          )}
          {buckets.activeCount === 0 && buckets.completedThisWeek.length === 0 && (
            <span className="text-[12px]" style={{ color: 'var(--ink-4)' }}>Sin tareas en esta semana</span>
          )}
        </div>
      </button>

      {/* Body */}
      {!collapsed && groups.length > 0 && (
        <div className="border-t px-5 py-4 flex flex-col gap-4" style={{ borderColor: 'var(--line)' }}>
          {groups.map(group => (
            <section key={group.key}>
              <div className="text-[11px] font-semibold uppercase tracking-wider mb-2 flex items-center gap-2" style={{ color: group.accent }}>
                {group.title}
                <span className="text-[11px] px-[7px] py-px rounded-full tabular-nums" style={{ background: 'var(--bg-3)', color: 'var(--ink-4)' }}>
                  {group.items.length}
                </span>
              </div>
              <div className="flex flex-col rounded-[8px] overflow-hidden" style={{ border: '1px solid var(--line-2)' }}>
                {group.items.map((task, i) => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    firstBorder={i > 0}
                    variant={variant}
                    projects={projects}
                    users={users}
                    onOpenTask={onOpenTask}
                    onOpenProject={onOpenProject}
                    todayISO={todayISO}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
      {!collapsed && groups.length === 0 && (
        <div className="border-t px-5 py-6 text-center text-[13px]" style={{ borderColor: 'var(--line)', color: 'var(--ink-4)' }}>
          Sin tareas relevantes para esta semana.
        </div>
      )}
    </div>
  );
}

// ── Task row ───────────────────────────────────────────────────────

interface TaskRowProps {
  task: Task;
  firstBorder: boolean;
  variant: 'person' | 'project';
  projects: Project[];
  users: User[];
  onOpenTask: (t: Task) => void;
  onOpenProject: (id: string) => void;
  todayISO: string;
}

function TaskRow({ task, firstBorder, variant, projects, users, onOpenTask, onOpenProject, todayISO }: TaskRowProps) {
  const dueCls = dueClass(task.due, task.status);
  const isOverdue = task.due && task.due < todayISO && task.status !== 'done';
  const proj = variant === 'person' ? projects.find(p => p.id === task.project) : undefined;
  const assignees = variant === 'project'
    ? task.assignees.map(id => users.find(u => u.id === id)).filter(Boolean) as User[]
    : [];

  return (
    <button
      onClick={() => onOpenTask(task)}
      className="flex items-center gap-3 px-3 py-2 text-left text-[13px] border-0 bg-transparent transition-colors"
      style={{
        borderTop: firstBorder ? '1px solid var(--line-2)' : 'none',
        color: 'var(--ink)',
      }}
      onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-2)')}
      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
    >
      <span className="w-[8px] h-[8px] rounded-full flex-shrink-0" style={{ background: PRIORITY_COLORS[task.priority] }} title={task.priority} />
      {variant === 'person' && (
        <>
          <span
            onClick={e => { e.stopPropagation(); if (proj) onOpenProject(proj.id); }}
            className="w-[8px] h-[8px] rounded-[2px] flex-shrink-0 cursor-pointer"
            style={{ background: proj?.color }}
            title={proj ? `${proj.client ? proj.client + ' · ' : ''}${proj.name}` : ''}
          />
          <span className="text-[11px] flex-shrink-0 truncate max-w-[150px]" style={{ color: 'var(--ink-4)' }}>
            {proj?.client && `${proj.client} · `}{proj?.name}
          </span>
        </>
      )}
      <span className="flex-1 truncate">{task.title}</span>
      {variant === 'project' && (
        <span className="inline-flex flex-shrink-0" style={{ minWidth: 0 }}>
          {assignees.length === 0 ? (
            <span className="text-[11px]" style={{ color: 'var(--ink-4)' }}>Sin asignar</span>
          ) : (
            assignees.slice(0, 3).map((u, i) => (
              <span
                key={u.id}
                className="w-5 h-5 rounded-full inline-flex items-center justify-center font-semibold text-white text-[9px] flex-shrink-0 border-[1.5px]"
                style={{ background: avatarBg(u.hue), borderColor: 'var(--surface)', marginLeft: i > 0 ? -6 : 0 }}
                title={u.name}
              >{u.initials}</span>
            ))
          )}
          {assignees.length > 3 && (
            <span className="ml-1 text-[11px]" style={{ color: 'var(--ink-4)' }}>+{assignees.length - 3}</span>
          )}
        </span>
      )}
      <span
        className="inline-flex items-center gap-1 h-5 px-2 rounded-[4px] text-[10px] font-medium flex-shrink-0"
        style={{ background: 'transparent', color: STATUS_TONES[task.status] ?? 'var(--ink-3)', border: `1px solid ${STATUS_TONES[task.status] ?? 'var(--line)'}` }}
      >
        {STATUS_LABELS[task.status]}
      </span>
      {task.due && (
        <span className={`flex items-center gap-1 text-[11px] flex-shrink-0 tabular-nums ${isOverdue ? '' : dueCls}`} style={{ color: isOverdue ? 'var(--danger)' : undefined, minWidth: 78, justifyContent: 'flex-end' }}>
          {isOverdue ? <Flag size={11} /> : <Clock size={11} />}
          {fmtDate(task.due, { relative: true })}
        </span>
      )}
    </button>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="py-16 text-center" style={{ color: 'var(--ink-4)' }}>
      <div className="text-[14px]">{label}</div>
    </div>
  );
}

function Pill({ label, color, bg }: { label: string; color: string; bg: string }) {
  return (
    <span className="text-[11px] font-medium px-2 py-[3px] rounded-full tabular-nums" style={{ color, background: bg }}>
      {label}
    </span>
  );
}

function ViewTab({ active, onClick, children, border }: { active: boolean; onClick: () => void; children: React.ReactNode; border?: boolean }) {
  return (
    <button
      onClick={onClick}
      className="h-8 px-3 text-[12px] font-medium border-0 transition-colors"
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
