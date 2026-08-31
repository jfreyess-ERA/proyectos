'use client';
import { useState, useMemo } from 'react';
import { ArrowUp, ArrowDown, Download, ListChecks } from 'lucide-react';
import { avatarBg } from '@/lib/data';
import { groupByClient } from './TaskFilterBar';
import type { Task, Project, User, SubtaskLite } from '@/lib/types';

interface Props {
  subtasks: SubtaskLite[];
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
const STAGE_ORDER = ['situacion', 'opciones', 'implementacion', 'seguimiento', 'none'];

/** Una subtarea con el contexto de su tarea/proyecto ya resuelto. */
interface Enriched {
  id: string;
  done: boolean;
  overdue: boolean;
  assignee: string | null;
  projectId: string | undefined;
  stage: string;
}

interface Tally { total: number; done: number; overdue: number; unassigned: number; }
const emptyTally = (): Tally => ({ total: 0, done: 0, overdue: 0, unassigned: 0 });
function add(t: Tally, e: Enriched) {
  t.total++;
  if (e.done) t.done++;
  if (e.overdue) t.overdue++;
  if (!e.assignee) t.unassigned++;
}
const pct = (t: Tally) => (t.total ? Math.round((t.done / t.total) * 100) : 0);

type SortDir = 'asc' | 'desc';

export function SubtaskStatsView({ subtasks, tasks, projects, users, onOpenProject }: Props) {
  const [clientFilter, setClientFilter] = useState<string>('all');
  const [projectFilter, setProjectFilter] = useState<string>('all');
  const [sort, setSort] = useState<{ key: string; dir: SortDir }>({ key: 'total', dir: 'desc' });

  const clients = useMemo(() => [...new Set(projects.map(p => p.client).filter(Boolean) as string[])].sort(), [projects]);
  const projectById = useMemo(() => new Map(projects.map(p => [p.id, p])), [projects]);
  const taskById = useMemo(() => new Map(tasks.map(t => [t.id, t])), [tasks]);

  const projectOptions = useMemo(() => (clientFilter === 'all'
    ? projects
    : projects.filter(p => p.client === clientFilter)
  ).slice().sort((a, b) => (a.client ?? '').localeCompare(b.client ?? '') || a.name.localeCompare(b.name)),
  [projects, clientFilter]);

  // Enriquecer + filtrar
  const enriched = useMemo<Enriched[]>(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const todayISO = today.toISOString().slice(0, 10);
    const out: Enriched[] = [];
    for (const s of subtasks) {
      const task = taskById.get(s.task_id);
      const projectId = task?.project;
      const project = projectId ? projectById.get(projectId) : undefined;
      if (clientFilter !== 'all' && project?.client !== clientFilter) continue;
      if (projectFilter !== 'all' && projectId !== projectFilter) continue;
      out.push({
        id: s.id,
        done: s.done,
        overdue: !s.done && !!s.due_date && s.due_date < todayISO,
        assignee: s.assignee,
        projectId,
        stage: task?.project_stage ?? 'none',
      });
    }
    return out;
  }, [subtasks, taskById, projectById, clientFilter, projectFilter]);

  // Totales globales
  const overall = useMemo(() => {
    const t = emptyTally();
    let dated = 0;
    for (const e of enriched) { add(t, e); }
    for (const s of subtasks) if (s.due_date) dated++;
    return { ...t, dated };
  }, [enriched, subtasks]);

  // Por responsable
  const byPerson = useMemo(() => {
    const map = new Map<string, Tally>();
    for (const e of enriched) {
      if (!e.assignee) continue;
      if (!map.has(e.assignee)) map.set(e.assignee, emptyTally());
      add(map.get(e.assignee)!, e);
    }
    return [...map.entries()]
      .map(([id, tally]) => ({ user: users.find(u => u.id === id), tally }))
      .filter(r => r.user)
      .sort((a, b) => b.tally.total - a.tally.total);
  }, [enriched, users]);

  // Por etapa
  const byStage = useMemo(() => {
    const map = new Map<string, Tally>();
    for (const e of enriched) {
      if (!map.has(e.stage)) map.set(e.stage, emptyTally());
      add(map.get(e.stage)!, e);
    }
    return STAGE_ORDER.filter(s => map.has(s)).map(s => ({ stage: s, tally: map.get(s)! }));
  }, [enriched]);

  // Por proyecto (tabla)
  const byProject = useMemo(() => {
    const map = new Map<string, Tally>();
    for (const e of enriched) {
      if (!e.projectId) continue;
      if (!map.has(e.projectId)) map.set(e.projectId, emptyTally());
      add(map.get(e.projectId)!, e);
    }
    const rows = [...map.entries()]
      .map(([id, tally]) => ({ project: projectById.get(id), tally }))
      .filter(r => r.project);
    const { key, dir } = sort;
    rows.sort((a, b) => {
      const av = projVal(a, key), bv = projVal(b, key);
      const cmp = av < bv ? -1 : av > bv ? 1 : 0;
      return dir === 'asc' ? cmp : -cmp;
    });
    return rows;
  }, [enriched, projectById, sort]);

  function toggleSort(key: string) {
    setSort(s => s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'desc' });
  }

  function exportCSV() {
    const headers = ['Cliente', 'Proyecto', 'Subtareas', 'Hechas', 'Pendientes', 'Atrasadas', 'Sin responsable', '% cumplimiento'];
    const data = byProject.map(r => [
      r.project!.client ?? '', r.project!.name,
      r.tally.total, r.tally.done, r.tally.total - r.tally.done, r.tally.overdue, r.tally.unassigned, pct(r.tally),
    ]);
    const csv = [headers, ...data].map(row => row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `subtareas-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  const hasData = overall.total > 0;

  return (
    <div className="p-6 max-w-[1200px] flex flex-col gap-6">
      <div>
        <h1 className="text-[24px] font-bold tracking-tight" style={{ color: 'var(--ink)' }}>Estadísticas de subtareas</h1>
        <p className="text-[14px] mt-1" style={{ color: 'var(--ink-3)' }}>
          Cumplimiento y atrasos de subtareas por responsable, proyecto y etapa.
        </p>
      </div>

      {/* Filtros */}
      <div className="flex items-center gap-3 flex-wrap p-4 rounded-[12px]" style={{ background: 'var(--surface)', border: '1px solid var(--line)' }}>
        <label className="flex items-center gap-2 text-[12px]" style={{ color: 'var(--ink-3)' }}>
          <span className="font-medium">Cliente:</span>
          <select value={clientFilter} onChange={e => { setClientFilter(e.target.value); setProjectFilter('all'); }}
            className="h-8 px-2 rounded-[7px] border text-[12px] outline-none"
            style={{ background: 'var(--bg-2)', borderColor: 'var(--line)', color: 'var(--ink)', fontFamily: 'var(--font)' }}>
            <option value="all">Todos ({clients.length})</option>
            {clients.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
        <label className="flex items-center gap-2 text-[12px]" style={{ color: 'var(--ink-3)' }}>
          <span className="font-medium">Proyecto:</span>
          <select value={projectFilter} onChange={e => setProjectFilter(e.target.value)}
            className="h-8 px-2 rounded-[7px] border text-[12px] outline-none max-w-[220px]"
            style={{ background: 'var(--bg-2)', borderColor: 'var(--line)', color: 'var(--ink)', fontFamily: 'var(--font)' }}>
            <option value="all">Todos</option>
            {clientFilter !== 'all'
              ? projectOptions.map(p => <option key={p.id} value={p.id}>{p.name}</option>)
              : groupByClient(projectOptions).map(([client, ps]) => (
                  <optgroup key={client} label={client}>
                    {ps.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </optgroup>
                ))}
          </select>
        </label>
        <button onClick={exportCSV} disabled={!hasData}
          className="ml-auto flex items-center gap-[6px] h-8 px-3 rounded-[7px] border text-[12px] transition-colors disabled:opacity-40"
          style={{ background: 'var(--bg-2)', color: 'var(--ink-3)', borderColor: 'var(--line)' }}>
          <Download size={12} /> CSV
        </button>
      </div>

      {!hasData ? (
        <div className="py-16 text-center rounded-[12px]" style={{ background: 'var(--surface)', border: '1px solid var(--line)', color: 'var(--ink-4)' }}>
          <ListChecks size={28} className="mx-auto mb-2" />
          <div className="text-[14px]" style={{ color: 'var(--ink-3)' }}>Todavía no hay subtareas para medir.</div>
          <div className="text-[12.5px] mt-1">
            Las estadísticas se llenan a medida que las subtareas reciban fecha y responsable en el detalle de cada tarea.
          </div>
        </div>
      ) : (
        <>
          {/* KPIs */}
          <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}>
            <Kpi label="Subtareas" value={String(overall.total)} sub={`${overall.dated} con fecha`} />
            <Kpi label="Cumplimiento" value={`${pct(overall)}%`} sub={`${overall.done} hechas`} tone="var(--sem-green-2)" />
            <Kpi label="Atrasadas" value={String(overall.overdue)} sub="pendientes y vencidas" tone={overall.overdue > 0 ? 'var(--danger)' : 'var(--ink)'} />
            <Kpi label="Sin responsable" value={String(overall.unassigned)} sub="no monitoreables" tone={overall.unassigned > 0 ? 'var(--sem-amber)' : 'var(--ink)'} />
          </div>

          {/* Por responsable */}
          <Card title="Cumplimiento por responsable">
            {byPerson.length === 0 ? (
              <p className="text-[12.5px]" style={{ color: 'var(--ink-4)' }}>Ninguna subtarea tiene responsable asignado todavía.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {byPerson.map(({ user, tally }) => (
                  <div key={user!.id} className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-full flex items-center justify-center text-white font-semibold flex-shrink-0" style={{ background: avatarBg(user!.hue), fontSize: 10 }}>
                      {user!.initials}
                    </span>
                    <div className="w-[150px] min-w-0">
                      <div className="text-[12.5px] truncate" style={{ color: 'var(--ink-2)' }}>{user!.name}</div>
                      <div className="text-[10.5px]" style={{ color: 'var(--ink-4)' }}>
                        {tally.done}/{tally.total} hechas
                        {tally.overdue > 0 && <span style={{ color: 'var(--danger)' }}> · {tally.overdue} atrasada{tally.overdue > 1 ? 's' : ''}</span>}
                      </div>
                    </div>
                    <div className="flex-1 h-[7px] rounded-full overflow-hidden" style={{ background: 'var(--bg-3)' }}>
                      <div className="h-full rounded-full" style={{ width: `${pct(tally)}%`, background: 'var(--sem-green-2)' }} />
                    </div>
                    <span className="text-[12.5px] w-[42px] text-right tabular-nums font-medium" style={{ color: 'var(--ink)' }}>{pct(tally)}%</span>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Por etapa */}
          <Card title="Por etapa ERA">
            <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}>
              {byStage.map(({ stage, tally }) => (
                <div key={stage} className="p-3 rounded-[10px]" style={{ background: 'var(--bg-2)', border: '1px solid var(--line)' }}>
                  <div className="flex items-center gap-[6px] mb-1">
                    <span className="w-[8px] h-[8px] rounded-[2px]" style={{ background: STAGE_COLORS[stage] }} />
                    <span className="text-[12px] font-medium" style={{ color: 'var(--ink-2)' }}>{STAGE_LABELS[stage]}</span>
                  </div>
                  <div className="text-[20px] font-bold tabular-nums" style={{ color: 'var(--ink)' }}>{pct(tally)}%</div>
                  <div className="text-[11px]" style={{ color: 'var(--ink-4)' }}>
                    {tally.done}/{tally.total}
                    {tally.overdue > 0 && <span style={{ color: 'var(--danger)' }}> · {tally.overdue} atras.</span>}
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Tabla por proyecto */}
          <Card title="Detalle por proyecto">
            <div className="overflow-x-auto -mx-4 px-4">
              <table className="w-full text-[12.5px]" style={{ borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <Th sortKey="name" current={sort} onSort={toggleSort}>Cliente / Proyecto</Th>
                    <Th sortKey="total" current={sort} onSort={toggleSort} align="right">Subtareas</Th>
                    <Th sortKey="done" current={sort} onSort={toggleSort} align="right">Hechas</Th>
                    <Th sortKey="overdue" current={sort} onSort={toggleSort} align="right">Atrasadas</Th>
                    <Th sortKey="pct" current={sort} onSort={toggleSort} align="right">Cumpl.</Th>
                    <th className="py-2 text-[11px] font-semibold uppercase tracking-wider text-left" style={{ color: 'var(--ink-4)', minWidth: 120 }}>Avance</th>
                  </tr>
                </thead>
                <tbody>
                  {byProject.map(r => (
                    <tr key={r.project!.id}
                      className="border-t transition-colors cursor-pointer"
                      style={{ borderColor: 'var(--line-2)', color: 'var(--ink-2)' }}
                      onClick={() => onOpenProject(r.project!.id)}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-2)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                      <td className="py-2 pr-3">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="w-[8px] h-[8px] rounded-[2px] flex-shrink-0" style={{ background: r.project!.color }} />
                          <span className="truncate">
                            {r.project!.client && <span style={{ color: 'var(--ink-4)' }}>{r.project!.client} · </span>}
                            <span style={{ color: 'var(--ink)' }}>{r.project!.name}</span>
                          </span>
                        </div>
                      </td>
                      <td className="py-2 pr-3 text-right tabular-nums">{r.tally.total}</td>
                      <td className="py-2 pr-3 text-right tabular-nums">{r.tally.done}</td>
                      <td className="py-2 pr-3 text-right tabular-nums" style={{ color: r.tally.overdue > 0 ? 'var(--danger)' : 'var(--ink-3)' }}>
                        {r.tally.overdue || '—'}
                      </td>
                      <td className="py-2 pr-3 text-right tabular-nums font-semibold" style={{ color: 'var(--ink)' }}>{pct(r.tally)}%</td>
                      <td className="py-2">
                        <div className="h-[7px] rounded-full overflow-hidden" style={{ background: 'var(--bg-3)', maxWidth: 140 }}>
                          <div className="h-full rounded-full" style={{ width: `${pct(r.tally)}%`, background: 'var(--sem-green-2)' }} />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}

function projVal(r: { project?: Project; tally: Tally }, key: string): string | number {
  switch (key) {
    case 'name': return `${r.project?.client ?? ''} ${r.project?.name ?? ''}`.toLowerCase();
    case 'total': return r.tally.total;
    case 'done': return r.tally.done;
    case 'overdue': return r.tally.overdue;
    case 'pct': return pct(r.tally);
    default: return 0;
  }
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="p-4 rounded-[12px]" style={{ background: 'var(--surface)', border: '1px solid var(--line)', boxShadow: 'var(--shadow-1)' }}>
      <h3 className="text-[13px] font-semibold mb-3" style={{ color: 'var(--ink)' }}>{title}</h3>
      {children}
    </div>
  );
}

function Kpi({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: string }) {
  return (
    <div className="p-3 rounded-[10px]" style={{ background: 'var(--surface)', border: '1px solid var(--line)' }}>
      <div className="text-[11px] uppercase tracking-wider font-semibold" style={{ color: 'var(--ink-4)' }}>{label}</div>
      <div className="text-[24px] font-bold tabular-nums mt-1" style={{ color: tone ?? 'var(--ink)' }}>{value}</div>
      {sub && <div className="text-[11px] mt-[2px]" style={{ color: 'var(--ink-4)' }}>{sub}</div>}
    </div>
  );
}

function Th({ children, sortKey, current, onSort, align = 'left' }: { children: React.ReactNode; sortKey: string; current: { key: string; dir: SortDir }; onSort: (k: string) => void; align?: 'left' | 'right' }) {
  const active = current.key === sortKey;
  return (
    <th onClick={() => onSort(sortKey)}
      className={`py-2 pr-3 text-[11px] font-semibold uppercase tracking-wider cursor-pointer select-none ${align === 'right' ? 'text-right' : 'text-left'}`}
      style={{ color: active ? 'var(--ink-2)' : 'var(--ink-4)' }}>
      <span className={`inline-flex items-center gap-1 ${align === 'right' ? 'flex-row-reverse' : ''}`}>
        {children}
        {active && (current.dir === 'asc' ? <ArrowUp size={11} /> : <ArrowDown size={11} />)}
      </span>
    </th>
  );
}
