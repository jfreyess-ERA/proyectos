'use client';
import { useState, useMemo } from 'react';
import { ArrowUp, ArrowDown, Download, Filter } from 'lucide-react';
import type { Task, Project, User } from '@/lib/types';
import { avatarBg } from '@/lib/data';
import { EmptyState } from './EmptyState';

interface Props {
  tasks: Task[];
  projects: Project[];
  users: User[];
  onOpenProject: (projectId: string) => void;
}

const STAGE_LABELS: Record<string, string> = {
  situacion: 'Situación',
  opciones: 'Opciones',
  implementacion: 'Implementación',
  seguimiento: 'Seguimiento',
  none: 'Sin etapa',
};

const STAGE_COLORS: Record<string, string> = {
  situacion: 'var(--sem-indigo)',
  opciones: 'var(--sem-amber)',
  implementacion: 'var(--sem-pink)',
  seguimiento: 'var(--sem-green-2)',
  none: 'var(--ink-4)',
};

const STATUS_LABELS: Record<string, string> = {
  backlog: 'Backlog',
  todo: 'Por hacer',
  doing: 'En curso',
  review: 'En revisión',
  done: 'Completado',
};

const STATUS_COLORS: Record<string, string> = {
  backlog: 'oklch(0.55 0.02 250)',
  todo:    'oklch(0.55 0.05 250)',
  doing:   'var(--sem-indigo)',
  review:  'var(--sem-amber)',
  done:    'var(--sem-green-2)',
};

const PRIORITY_LABELS: Record<string, string> = {
  urgent: 'Urgente',
  high: 'Alta',
  med: 'Media',
  low: 'Baja',
};

type SortDir = 'asc' | 'desc';

export function StatsView({ tasks, projects, users, onOpenProject }: Props) {
  // Filters
  const [clientFilter, setClientFilter]     = useState<string>('all');
  const [stageFilter, setStageFilter]       = useState<string>('all');
  const [analystFilter, setAnalystFilter]   = useState<string>('all');
  const [projectSort, setProjectSort]       = useState<{ key: string; dir: SortDir }>({ key: 'openTasks', dir: 'desc' });
  const [analystSort, setAnalystSort]       = useState<{ key: string; dir: SortDir }>({ key: 'active', dir: 'desc' });

  const clients = useMemo(() => [...new Set(projects.map(p => p.client).filter(Boolean) as string[])].sort(), [projects]);

  // Apply filters at project level
  const filteredProjects = useMemo(() => projects.filter(p => {
    if (clientFilter !== 'all' && p.client !== clientFilter) return false;
    return true;
  }), [projects, clientFilter]);

  const filteredProjectIds = new Set(filteredProjects.map(p => p.id));

  // Tasks scoped to filtered projects, plus stage/analyst filters
  const filteredTasks = useMemo(() => tasks.filter(t => {
    if (!filteredProjectIds.has(t.project)) return false;
    if (stageFilter !== 'all') {
      const s = t.project_stage ?? 'none';
      if (s !== stageFilter) return false;
    }
    if (analystFilter !== 'all' && !t.assignees.includes(analystFilter)) return false;
    return true;
  }), [tasks, filteredProjectIds, stageFilter, analystFilter]);

  // ── KPI cards ──────────────────────────────────────────────────────
  const totalProjects = filteredProjects.length;
  const totalClients  = new Set(filteredProjects.map(p => p.client).filter(Boolean)).size;
  const totalTasks    = filteredTasks.length;
  const doneTasks     = filteredTasks.filter(t => t.status === 'done').length;
  const activeTasks   = filteredTasks.filter(t => t.status !== 'done').length;
  const overdueTasks  = filteredTasks.filter(t => t.status !== 'done' && t.due && new Date(t.due + 'T00:00:00') < new Date(new Date().setHours(0,0,0,0))).length;
  const completionRate = totalTasks ? Math.round((doneTasks / totalTasks) * 100) : 0;

  // ── Projects by stage ──────────────────────────────────────────────
  const projectsByStage = useMemo(() => {
    const map: Record<string, Project[]> = {};
    filteredProjects.forEach(p => {
      // pick the "most advanced" stage represented by its tasks
      const stages = new Set(tasks.filter(t => t.project === p.id).map(t => t.project_stage ?? 'none'));
      const order = ['seguimiento', 'implementacion', 'opciones', 'situacion', 'none'];
      const stage = order.find(s => stages.has(s as never)) ?? 'none';
      if (!map[stage]) map[stage] = [];
      map[stage].push(p);
    });
    return ['situacion', 'opciones', 'implementacion', 'seguimiento', 'none'].map(s => ({ stage: s, projects: map[s] ?? [] }));
  }, [filteredProjects, tasks]);

  // ── Tasks by status ────────────────────────────────────────────────
  const tasksByStatus = useMemo(() => {
    const counts: Record<string, number> = { backlog: 0, todo: 0, doing: 0, review: 0, done: 0 };
    filteredTasks.forEach(t => { counts[t.status] = (counts[t.status] ?? 0) + 1; });
    return counts;
  }, [filteredTasks]);

  // ── Projects table ─────────────────────────────────────────────────
  const projectRows = useMemo(() => {
    return filteredProjects.map(p => {
      const pt = tasks.filter(t => t.project === p.id);
      const stagesSeen = new Set(pt.map(t => t.project_stage ?? 'none'));
      const order = ['seguimiento', 'implementacion', 'opciones', 'situacion', 'none'];
      const currentStage = order.find(s => stagesSeen.has(s as never)) ?? 'none';
      const openTasks = pt.filter(t => t.status !== 'done').length;
      const doneTasks = pt.filter(t => t.status === 'done').length;
      const overdueTasksP = pt.filter(t => t.status !== 'done' && t.due && new Date(t.due + 'T00:00:00') < new Date(new Date().setHours(0,0,0,0))).length;
      const analysts = new Set<string>();
      pt.forEach(t => t.assignees.forEach(a => analysts.add(a)));
      // oldest open task age in days
      const now = new Date().setHours(0,0,0,0);
      let ageDays: number | null = null;
      const withStart = pt.filter(t => t.status !== 'done' && t.start);
      if (withStart.length) {
        const earliest = withStart.reduce((min, t) => t.start < min ? t.start : min, withStart[0].start);
        ageDays = Math.max(0, Math.floor((now - new Date(earliest + 'T00:00:00').getTime()) / 86400000));
      }
      return {
        project: p,
        currentStage,
        totalTasks: pt.length,
        openTasks,
        doneTasks,
        overdueTasks: overdueTasksP,
        pct: pt.length ? doneTasks / pt.length : 0,
        analystIds: [...analysts],
        ageDays,
      };
    });
  }, [filteredProjects, tasks]);

  const sortedProjectRows = useMemo(() => {
    const rows = [...projectRows];
    const { key, dir } = projectSort;
    rows.sort((a, b) => {
      const aVal = getProjectVal(a, key);
      const bVal = getProjectVal(b, key);
      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return 1;
      if (bVal == null) return -1;
      const cmp = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
      return dir === 'asc' ? cmp : -cmp;
    });
    return rows;
  }, [projectRows, projectSort]);

  // ── Analyst rows ───────────────────────────────────────────────────
  const analystRows = useMemo(() => {
    return users.map(u => {
      const mine = filteredTasks.filter(t => t.assignees.includes(u.id));
      const active = mine.filter(t => t.status !== 'done').length;
      const done = mine.filter(t => t.status === 'done').length;
      const today = new Date().setHours(0,0,0,0);
      const overdue = mine.filter(t => t.status !== 'done' && t.due && new Date(t.due + 'T00:00:00').getTime() < today).length;
      const doing = mine.filter(t => t.status === 'doing').length;
      const review = mine.filter(t => t.status === 'review').length;
      const projs = new Set(mine.map(t => t.project)).size;
      return { user: u, active, done, overdue, doing, review, projects: projs };
    });
  }, [users, filteredTasks]);

  const sortedAnalystRows = useMemo(() => {
    const rows = [...analystRows];
    const { key, dir } = analystSort;
    rows.sort((a, b) => {
      const aVal = getAnalystVal(a, key);
      const bVal = getAnalystVal(b, key);
      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return 1;
      if (bVal == null) return -1;
      const cmp = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
      return dir === 'asc' ? cmp : -cmp;
    });
    return rows;
  }, [analystRows, analystSort]);

  function toggleProjectSort(key: string) {
    setProjectSort(s => s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'desc' });
  }

  function toggleAnalystSort(key: string) {
    setAnalystSort(s => s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'desc' });
  }

  function exportProjectsCSV() {
    const headers = ['Cliente', 'Proyecto', 'Etapa actual', 'Tareas totales', 'Abiertas', 'Completadas', 'Atrasadas', '% Avance', 'Analistas', 'Días abierto'];
    const rows = sortedProjectRows.map(r => [
      r.project.client ?? '',
      r.project.name,
      STAGE_LABELS[r.currentStage] ?? r.currentStage,
      r.totalTasks,
      r.openTasks,
      r.doneTasks,
      r.overdueTasks,
      `${Math.round(r.pct * 100)}%`,
      r.analystIds.map(id => users.find(u => u.id === id)?.name ?? id).join('; '),
      r.ageDays ?? '',
    ]);
    const csv = [headers, ...rows].map(row => row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `proyectos-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="p-6 max-w-[1200px] flex flex-col gap-6">
      {/* Header */}
      <div>
        <h1 className="text-[24px] font-bold tracking-tight" style={{ color: 'var(--ink)' }}>
          Estadísticas
        </h1>
        <p className="text-[14px] mt-1" style={{ color: 'var(--ink-3)' }}>
          Vista de gestión: proyectos, clientes, tareas y analistas.
        </p>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap p-4 rounded-[12px]" style={{ background: 'var(--surface)', border: '1px solid var(--line)' }}>
        <FilterSelect label="Cliente" value={clientFilter} onChange={setClientFilter}>
          <option value="all">Todos ({clients.length})</option>
          {clients.map(c => <option key={c} value={c}>{c}</option>)}
        </FilterSelect>
        <FilterSelect label="Etapa" value={stageFilter} onChange={setStageFilter}>
          <option value="all">Todas</option>
          <option value="situacion">Situación</option>
          <option value="opciones">Opciones</option>
          <option value="implementacion">Implementación</option>
          <option value="seguimiento">Seguimiento</option>
          <option value="none">Sin etapa</option>
        </FilterSelect>
        <FilterSelect label="Analista" value={analystFilter} onChange={setAnalystFilter}>
          <option value="all">Todos</option>
          {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
        </FilterSelect>
        {(clientFilter !== 'all' || stageFilter !== 'all' || analystFilter !== 'all') && (
          <button
            onClick={() => { setClientFilter('all'); setStageFilter('all'); setAnalystFilter('all'); }}
            className="ml-auto h-8 px-3 text-[12px] rounded-[7px] border transition-colors"
            style={{ background: 'var(--bg-2)', borderColor: 'var(--line)', color: 'var(--ink-3)' }}
          >
            Limpiar filtros
          </button>
        )}
      </div>

      {/* KPIs */}
      <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
        <Kpi label="Clientes" value={totalClients} />
        <Kpi label="Proyectos" value={totalProjects} />
        <Kpi label="Tareas totales" value={totalTasks} />
        <Kpi label="Activas" value={activeTasks} tone="var(--accent)" />
        <Kpi label="Completadas" value={doneTasks} tone="var(--sem-green)" sub={`${completionRate}% del total`} />
        <Kpi label="Atrasadas" value={overdueTasks} tone={overdueTasks > 0 ? 'var(--danger)' : undefined} />
      </div>

      {/* Distributions */}
      <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))' }}>
        <Card title="Proyectos por etapa">
          <div className="flex flex-col gap-2">
            {projectsByStage.map(g => {
              const pct = totalProjects ? (g.projects.length / totalProjects) * 100 : 0;
              const color = STAGE_COLORS[g.stage];
              return (
                <div key={g.stage} className="flex items-center gap-3">
                  <span className="w-[8px] h-[8px] rounded-[2px] flex-shrink-0" style={{ background: color }} />
                  <span className="text-[12.5px] w-[110px]" style={{ color: 'var(--ink-2)' }}>{STAGE_LABELS[g.stage]}</span>
                  <div className="flex-1 h-[6px] rounded-full overflow-hidden" style={{ background: 'var(--bg-3)' }}>
                    <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
                  </div>
                  <span className="text-[12px] w-[50px] text-right tabular-nums" style={{ color: 'var(--ink-3)' }}>
                    {g.projects.length}
                  </span>
                </div>
              );
            })}
          </div>
        </Card>

        <Card title="Tareas por estado">
          <div className="flex flex-col gap-2">
            {(['backlog', 'todo', 'doing', 'review', 'done'] as const).map(s => {
              const n = tasksByStatus[s] ?? 0;
              const pct = totalTasks ? (n / totalTasks) * 100 : 0;
              return (
                <div key={s} className="flex items-center gap-3">
                  <span className="w-[8px] h-[8px] rounded-full flex-shrink-0" style={{ background: STATUS_COLORS[s] }} />
                  <span className="text-[12.5px] w-[110px]" style={{ color: 'var(--ink-2)' }}>{STATUS_LABELS[s]}</span>
                  <div className="flex-1 h-[6px] rounded-full overflow-hidden" style={{ background: 'var(--bg-3)' }}>
                    <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: STATUS_COLORS[s] }} />
                  </div>
                  <span className="text-[12px] w-[50px] text-right tabular-nums" style={{ color: 'var(--ink-3)' }}>
                    {n}
                  </span>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      {/* Projects table */}
      <Card
        title="Proyectos"
        right={
          <button
            onClick={exportProjectsCSV}
            className="flex items-center gap-[6px] h-7 px-3 rounded-[6px] text-[12px] border transition-colors"
            style={{ background: 'var(--bg-2)', color: 'var(--ink-3)', borderColor: 'var(--line)' }}
          >
            <Download size={12} /> CSV
          </button>
        }
      >
        <div className="overflow-x-auto -mx-4 px-4">
          <table className="w-full text-[12.5px]" style={{ borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ color: 'var(--ink-4)' }}>
                <Th sortKey="client"      current={projectSort} onSort={toggleProjectSort}>Cliente / Proyecto</Th>
                <Th sortKey="stage"       current={projectSort} onSort={toggleProjectSort}>Etapa</Th>
                <Th sortKey="totalTasks"  current={projectSort} onSort={toggleProjectSort} align="right">Tareas</Th>
                <Th sortKey="openTasks"   current={projectSort} onSort={toggleProjectSort} align="right">Abiertas</Th>
                <Th sortKey="doneTasks"   current={projectSort} onSort={toggleProjectSort} align="right">Hechas</Th>
                <Th sortKey="overdueTasks" current={projectSort} onSort={toggleProjectSort} align="right">Atrasadas</Th>
                <Th sortKey="pct"         current={projectSort} onSort={toggleProjectSort} align="right">Avance</Th>
                <Th sortKey="ageDays"     current={projectSort} onSort={toggleProjectSort} align="right">Días</Th>
                <Th sortKey="analysts"    current={projectSort} onSort={toggleProjectSort}>Analistas</Th>
              </tr>
            </thead>
            <tbody>
              {sortedProjectRows.map(r => (
                <tr
                  key={r.project.id}
                  className="border-t transition-colors cursor-pointer"
                  style={{ borderColor: 'var(--line-2)', color: 'var(--ink-2)' }}
                  onClick={() => onOpenProject(r.project.id)}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-2)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <td className="py-2 pr-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-[8px] h-[8px] rounded-[2px] flex-shrink-0" style={{ background: r.project.color }} />
                      <span className="truncate">
                        {r.project.client && <span style={{ color: 'var(--ink-4)' }}>{r.project.client} · </span>}
                        <span style={{ color: 'var(--ink)' }}>{r.project.name}</span>
                      </span>
                    </div>
                  </td>
                  <td className="py-2 pr-3">
                    <span className="inline-flex items-center h-5 px-2 rounded-[4px] text-[11px] font-medium" style={{ background: 'transparent', color: STAGE_COLORS[r.currentStage], border: `1px solid ${STAGE_COLORS[r.currentStage]}` }}>
                      {STAGE_LABELS[r.currentStage]}
                    </span>
                  </td>
                  <td className="py-2 pr-3 text-right tabular-nums">{r.totalTasks}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{r.openTasks}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{r.doneTasks}</td>
                  <td className="py-2 pr-3 text-right tabular-nums" style={{ color: r.overdueTasks > 0 ? 'var(--danger)' : undefined }}>{r.overdueTasks || '—'}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{Math.round(r.pct * 100)}%</td>
                  <td className="py-2 pr-3 text-right tabular-nums" style={{ color: 'var(--ink-3)' }}>{r.ageDays ?? '—'}</td>
                  <td className="py-2 pr-3">
                    <div className="flex items-center">
                      {r.analystIds.slice(0, 4).map((id, i) => {
                        const u = users.find(x => x.id === id);
                        if (!u) return null;
                        return (
                          <span
                            key={id}
                            className="w-5 h-5 rounded-full inline-flex items-center justify-center font-semibold text-white text-[9px] border-[1.5px] border-[var(--surface)]"
                            style={{ background: avatarBg(u.hue), marginLeft: i > 0 ? -6 : 0 }}
                            title={u.name}
                          >
                            {u.initials}
                          </span>
                        );
                      })}
                      {r.analystIds.length > 4 && <span className="ml-1 text-[11px]" style={{ color: 'var(--ink-4)' }}>+{r.analystIds.length - 4}</span>}
                    </div>
                  </td>
                </tr>
              ))}
              {sortedProjectRows.length === 0 && (
                <tr key="empty">
                  <td colSpan={9}>
                    <EmptyState
                      icon={<Filter size={24} />}
                      title="Ningún proyecto coincide"
                      hint="Ajustá o limpiá los filtros de arriba para ver resultados."
                      compact
                    />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Analysts table */}
      <Card title="Carga por analista">
        <div className="overflow-x-auto -mx-4 px-4">
          <table className="w-full text-[12.5px]" style={{ borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ color: 'var(--ink-4)' }}>
                <Th sortKey="name"     current={analystSort} onSort={toggleAnalystSort}>Analista</Th>
                <Th sortKey="active"   current={analystSort} onSort={toggleAnalystSort} align="right">Activas</Th>
                <Th sortKey="doing"    current={analystSort} onSort={toggleAnalystSort} align="right">En curso</Th>
                <Th sortKey="review"   current={analystSort} onSort={toggleAnalystSort} align="right">Revisión</Th>
                <Th sortKey="overdue"  current={analystSort} onSort={toggleAnalystSort} align="right">Atrasadas</Th>
                <Th sortKey="done"     current={analystSort} onSort={toggleAnalystSort} align="right">Hechas</Th>
                <Th sortKey="projects" current={analystSort} onSort={toggleAnalystSort} align="right">Proyectos</Th>
              </tr>
            </thead>
            <tbody>
              {sortedAnalystRows.map(r => (
                <tr key={r.user.id} className="border-t" style={{ borderColor: 'var(--line-2)', color: 'var(--ink-2)' }}>
                  <td className="py-2 pr-3">
                    <div className="flex items-center gap-2">
                      <span
                        className="w-6 h-6 rounded-full inline-flex items-center justify-center font-semibold text-white text-[10px] flex-shrink-0"
                        style={{ background: avatarBg(r.user.hue) }}
                      >{r.user.initials}</span>
                      <div className="min-w-0">
                        <div className="text-[13px] truncate" style={{ color: 'var(--ink)' }}>{r.user.name}</div>
                        <div className="text-[11px] truncate" style={{ color: 'var(--ink-4)' }}>{r.user.role}</div>
                      </div>
                    </div>
                  </td>
                  <td className="py-2 pr-3 text-right tabular-nums">{r.active}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{r.doing}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{r.review}</td>
                  <td className="py-2 pr-3 text-right tabular-nums" style={{ color: r.overdue > 0 ? 'var(--danger)' : undefined }}>{r.overdue || '—'}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{r.done}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{r.projects}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Priority breakdown */}
      <Card title="Tareas activas por prioridad">
        <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))' }}>
          {(['urgent', 'high', 'med', 'low'] as const).map(p => {
            const n = filteredTasks.filter(t => t.priority === p && t.status !== 'done').length;
            const colors: Record<string, string> = {
              urgent: 'var(--sem-red-2)',
              high:   'var(--sem-orange)',
              med:    'var(--sem-blue-gray-med)',
              low:    'var(--sem-blue-gray-low)',
            };
            return (
              <div key={p} className="p-3 rounded-[10px]" style={{ background: 'var(--bg-2)', border: '1px solid var(--line-2)' }}>
                <div className="flex items-center gap-2 mb-1">
                  <span className="w-2 h-2 rounded-full" style={{ background: colors[p] }} />
                  <span className="text-[11px] uppercase tracking-wider font-semibold" style={{ color: 'var(--ink-3)' }}>{PRIORITY_LABELS[p]}</span>
                </div>
                <div className="text-[22px] font-bold tabular-nums" style={{ color: 'var(--ink)' }}>{n}</div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}

// ── helpers ────────────────────────────────────────────────────────
type ProjectRow = {
  project: Project;
  currentStage: string;
  totalTasks: number;
  openTasks: number;
  doneTasks: number;
  overdueTasks: number;
  pct: number;
  analystIds: string[];
  ageDays: number | null;
};

function getProjectVal(r: ProjectRow, key: string): string | number | null {
  switch (key) {
    case 'client':       return `${r.project.client ?? ''} ${r.project.name}`.toLowerCase();
    case 'stage':        return r.currentStage;
    case 'totalTasks':   return r.totalTasks;
    case 'openTasks':    return r.openTasks;
    case 'doneTasks':    return r.doneTasks;
    case 'overdueTasks': return r.overdueTasks;
    case 'pct':          return r.pct;
    case 'ageDays':      return r.ageDays;
    case 'analysts':     return r.analystIds.length;
    default:             return null;
  }
}

type AnalystRow = {
  user: User;
  active: number;
  done: number;
  overdue: number;
  doing: number;
  review: number;
  projects: number;
};

function getAnalystVal(r: AnalystRow, key: string): string | number {
  switch (key) {
    case 'name':     return r.user.name.toLowerCase();
    case 'active':   return r.active;
    case 'done':     return r.done;
    case 'overdue':  return r.overdue;
    case 'doing':    return r.doing;
    case 'review':   return r.review;
    case 'projects': return r.projects;
    default:         return 0;
  }
}

function Card({ title, right, children }: { title: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="p-4 rounded-[12px]" style={{ background: 'var(--surface)', border: '1px solid var(--line)', boxShadow: 'var(--shadow-1)' }}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-[13px] font-semibold" style={{ color: 'var(--ink)' }}>{title}</h3>
        {right}
      </div>
      {children}
    </div>
  );
}

function Kpi({ label, value, tone, sub }: { label: string; value: number; tone?: string; sub?: string }) {
  return (
    <div className="p-3 rounded-[10px]" style={{ background: 'var(--surface)', border: '1px solid var(--line)' }}>
      <div className="text-[11px] uppercase tracking-wider font-semibold" style={{ color: 'var(--ink-4)' }}>{label}</div>
      <div className="text-[24px] font-bold tabular-nums mt-1" style={{ color: tone ?? 'var(--ink)' }}>{value}</div>
      {sub && <div className="text-[11px] mt-[2px]" style={{ color: 'var(--ink-4)' }}>{sub}</div>}
    </div>
  );
}

function FilterSelect({ label, value, onChange, children }: { label: string; value: string; onChange: (v: string) => void; children: React.ReactNode }) {
  return (
    <label className="flex items-center gap-2 text-[12px]" style={{ color: 'var(--ink-3)' }}>
      <span className="font-medium">{label}:</span>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="h-8 px-2 rounded-[7px] border text-[12px] outline-none"
        style={{ background: 'var(--bg-2)', borderColor: 'var(--line)', color: 'var(--ink)', fontFamily: 'var(--font)' }}
      >
        {children}
      </select>
    </label>
  );
}

function Th({ children, sortKey, current, onSort, align = 'left' }: { children: React.ReactNode; sortKey: string; current: { key: string; dir: SortDir }; onSort: (k: string) => void; align?: 'left' | 'right' }) {
  const active = current.key === sortKey;
  return (
    <th
      onClick={() => onSort(sortKey)}
      className={`py-2 pr-3 text-[11px] font-semibold uppercase tracking-wider cursor-pointer select-none ${align === 'right' ? 'text-right' : 'text-left'}`}
      style={{ color: active ? 'var(--ink-2)' : 'var(--ink-4)' }}
    >
      <span className={`inline-flex items-center gap-1 ${align === 'right' ? 'flex-row-reverse' : ''}`}>
        {children}
        {active && (current.dir === 'asc' ? <ArrowUp size={11} /> : <ArrowDown size={11} />)}
      </span>
    </th>
  );
}
