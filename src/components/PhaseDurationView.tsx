'use client';
import { useState, useMemo } from 'react';
import { ArrowUp, ArrowDown, Download, Filter } from 'lucide-react';
import type { Task, Project } from '@/lib/types';
import { EmptyState } from './EmptyState';

interface Props {
  tasks: Task[];
  projects: Project[];
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

// phase segments (between consecutive milestones)
const SEGMENTS = [
  { key: 'diag', label: 'Diagnóstico', sub: 'Kick off → Situación', from: 'kickoff_date', to: 'situacion_date', color: 'var(--sem-indigo)' },
  { key: 'eval', label: 'Evaluación', sub: 'Situación → Opciones', from: 'situacion_date', to: 'opciones_date', color: 'var(--sem-amber)' },
  { key: 'impl', label: 'Implementación', sub: 'Opciones → Implementación', from: 'opciones_date', to: 'implementacion_date', color: 'var(--sem-pink)' },
  { key: 'seg', label: 'Seguimiento', sub: 'Implementación → 1er seguimiento', from: 'implementacion_date', to: 'seguimiento_date', color: 'var(--sem-green-2)' },
] as const;

const ORDERED_MS: (keyof Project)[] = ['kickoff_date', 'situacion_date', 'opciones_date', 'implementacion_date', 'seguimiento_date'];

function daysBetween(a: string, b: string): number {
  return Math.round((new Date(b + 'T00:00:00').getTime() - new Date(a + 'T00:00:00').getTime()) / 86_400_000);
}
function seg(a?: string | null, b?: string | null): number | null {
  if (!a || !b) return null;
  return Math.max(0, daysBetween(a, b));
}
function fmtDays(d: number | null): string {
  if (d === null) return '—';
  if (d < 31) return `${d}d`;
  const months = d / 30.44;
  return `${months.toFixed(1).replace(/\.0$/, '')} m`;
}
function fmtDate(s?: string | null): string {
  if (!s) return '—';
  return new Date(s + 'T00:00:00').toLocaleDateString('es', { day: '2-digit', month: 'short', year: '2-digit' });
}

type SortDir = 'asc' | 'desc';

export function PhaseDurationView({ tasks, projects, onOpenProject }: Props) {
  const [clientFilter, setClientFilter] = useState<string>('all');
  const [scope, setScope] = useState<'advanced' | 'all'>('advanced');
  const [measurableOnly, setMeasurableOnly] = useState(true);
  const [sort, setSort] = useState<{ key: string; dir: SortDir }>({ key: 'total', dir: 'desc' });

  const clients = useMemo(() => [...new Set(projects.map(p => p.client).filter(Boolean) as string[])].sort(), [projects]);

  const allRows = useMemo(() => {
    return projects.map(p => {
      const pt = tasks.filter(t => t.project === p.id);
      const stagesSeen = new Set(pt.map(t => t.project_stage ?? 'none'));
      const order = ['seguimiento', 'implementacion', 'opciones', 'situacion', 'none'];
      const currentStage = order.find(s => stagesSeen.has(s as never)) ?? 'none';
      const isClosed = pt.length > 0 && pt.every(t => t.status === 'done');
      const advanced = isClosed || currentStage === 'implementacion' || currentStage === 'seguimiento' || !!p.implementacion_date || !!p.seguimiento_date;

      const segments: Record<string, number | null> = {};
      for (const s of SEGMENTS) segments[s.key] = seg(p[s.from] as string | undefined, p[s.to] as string | undefined);

      // total: kickoff → last available milestone
      let lastMs: string | null = null;
      for (const col of ORDERED_MS) { const v = p[col] as string | undefined; if (v) lastMs = v; }
      const total = p.kickoff_date && lastMs && lastMs !== p.kickoff_date ? Math.max(0, daysBetween(p.kickoff_date, lastMs)) : null;
      const milestoneCount = ORDERED_MS.filter(c => p[c]).length;

      return { project: p, currentStage, isClosed, advanced, segments, total, milestoneCount };
    });
  }, [projects, tasks]);

  const rows = useMemo(() => {
    let r = allRows.filter(x => {
      if (clientFilter !== 'all' && x.project.client !== clientFilter) return false;
      if (scope === 'advanced' && !x.advanced) return false;
      if (measurableOnly && x.total === null) return false;
      return true;
    });
    const { key, dir } = sort;
    r = [...r].sort((a, b) => {
      const av = getVal(a, key), bv = getVal(b, key);
      if (av === null && bv === null) return 0;
      if (av === null) return 1;
      if (bv === null) return -1;
      const cmp = av < bv ? -1 : av > bv ? 1 : 0;
      return dir === 'asc' ? cmp : -cmp;
    });
    return r;
  }, [allRows, clientFilter, scope, measurableOnly, sort]);

  // averages over measurable rows currently shown
  const measurable = rows.filter(r => r.total !== null);
  function avgSeg(key: string): number | null {
    const vals = rows.map(r => r.segments[key]).filter((v): v is number => v !== null);
    return vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null;
  }
  const avgTotal = measurable.length ? Math.round(measurable.reduce((a, r) => a + (r.total as number), 0) / measurable.length) : null;
  const closedCount = rows.filter(r => r.isClosed).length;

  const maxTotal = Math.max(...allRows.map(r => r.total ?? 0), 1);

  function toggleSort(key: string) {
    setSort(s => s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'desc' });
  }

  function exportCSV() {
    const headers = ['Cliente', 'Proyecto', 'Etapa actual', 'Cerrado', 'Kick off', 'Diagnóstico (d)', 'Evaluación (d)', 'Implementación (d)', 'Seguimiento (d)', 'Duración total (d)'];
    const data = rows.map(r => [
      r.project.client ?? '', r.project.name, STAGE_LABELS[r.currentStage] ?? r.currentStage, r.isClosed ? 'Sí' : 'No',
      r.project.kickoff_date ?? '',
      r.segments.diag ?? '', r.segments.eval ?? '', r.segments.impl ?? '', r.segments.seg ?? '', r.total ?? '',
    ]);
    const csv = [headers, ...data].map(row => row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `tiempos-fase-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="p-6 max-w-[1200px] flex flex-col gap-6">
      <div>
        <h1 className="text-[24px] font-bold tracking-tight" style={{ color: 'var(--ink)' }}>Tiempos por fase</h1>
        <p className="text-[14px] mt-1" style={{ color: 'var(--ink-3)' }}>
          Duración real entre hitos de cada proyecto, especialmente útil para proyectos avanzados y cerrados.
        </p>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap p-4 rounded-[12px]" style={{ background: 'var(--surface)', border: '1px solid var(--line)' }}>
        <label className="flex items-center gap-2 text-[12px]" style={{ color: 'var(--ink-3)' }}>
          <span className="font-medium">Cliente:</span>
          <select value={clientFilter} onChange={e => setClientFilter(e.target.value)}
            className="h-8 px-2 rounded-[6px] border text-[12px] outline-none"
            style={{ background: 'var(--bg-2)', borderColor: 'var(--line)', color: 'var(--ink)', fontFamily: 'var(--font)' }}>
            <option value="all">Todos ({clients.length})</option>
            {clients.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
        <div className="inline-flex rounded-[8px] border overflow-hidden" style={{ borderColor: 'var(--line)' }}>
          <button onClick={() => setScope('advanced')} className="h-8 px-3 text-[12px] font-medium border-0 transition-colors"
            style={{ background: scope === 'advanced' ? 'var(--bg-2)' : 'transparent', color: scope === 'advanced' ? 'var(--ink)' : 'var(--ink-3)' }}>
            Avanzados y cerrados
          </button>
          <button onClick={() => setScope('all')} className="h-8 px-3 text-[12px] font-medium border-0 transition-colors"
            style={{ background: scope === 'all' ? 'var(--bg-2)' : 'transparent', color: scope === 'all' ? 'var(--ink)' : 'var(--ink-3)', borderLeft: '1px solid var(--line)' }}>
            Todos
          </button>
        </div>
        <label className="flex items-center gap-2 text-[12px]" style={{ color: 'var(--ink-3)' }}>
          <input type="checkbox" checked={measurableOnly} onChange={e => setMeasurableOnly(e.target.checked)} />
          Solo con duración medible
        </label>
        <button onClick={exportCSV} className="ml-auto flex items-center gap-[6px] h-8 px-3 rounded-[6px] border text-[12px] transition-colors"
          style={{ background: 'var(--bg-2)', color: 'var(--ink-3)', borderColor: 'var(--line)' }}>
          <Download size={12} /> CSV
        </button>
      </div>

      {/* KPIs */}
      <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))' }}>
        <Kpi label="Proyectos mostrados" value={String(rows.length)} sub={`${closedCount} cerrados`} />
        <Kpi label="Duración total prom." value={fmtDays(avgTotal)} sub={avgTotal !== null ? `${avgTotal} días` : 'sin datos'} tone="var(--ink)" />
        <Kpi label="Diagnóstico prom." value={fmtDays(avgSeg('diag'))} sub="Kick off → Situación" tone={SEGMENTS[0].color} />
        <Kpi label="Implementación prom." value={fmtDays(avgSeg('impl'))} sub="Opciones → Implement." tone={SEGMENTS[2].color} />
      </div>

      {/* Average per segment */}
      <Card title="Duración promedio por tramo">
        <div className="flex flex-col gap-2">
          {SEGMENTS.map(s => {
            const v = avgSeg(s.key);
            const max = Math.max(...SEGMENTS.map(x => avgSeg(x.key) ?? 0), 1);
            return (
              <div key={s.key} className="flex items-center gap-3">
                <span className="w-[8px] h-[8px] rounded-[2px] flex-shrink-0" style={{ background: s.color }} />
                <div className="w-[170px]">
                  <div className="text-[12px]" style={{ color: 'var(--ink-2)' }}>{s.label}</div>
                  <div className="text-[10px]" style={{ color: 'var(--ink-4)' }}>{s.sub}</div>
                </div>
                <div className="flex-1 h-[7px] rounded-full overflow-hidden" style={{ background: 'var(--bg-3)' }}>
                  <div className="h-full rounded-full" style={{ width: `${((v ?? 0) / max) * 100}%`, background: s.color }} />
                </div>
                <span className="text-[12px] w-[64px] text-right tabular-nums font-medium" style={{ color: 'var(--ink)' }}>{fmtDays(v)}</span>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Table */}
      <Card title="Detalle por proyecto">
        <div className="overflow-x-auto -mx-4 px-4">
          <table className="w-full text-[12px]" style={{ borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ color: 'var(--ink-4)' }}>
                <Th sortKey="client" current={sort} onSort={toggleSort}>Cliente / Proyecto</Th>
                <Th sortKey="stage" current={sort} onSort={toggleSort}>Etapa</Th>
                <Th sortKey="kickoff" current={sort} onSort={toggleSort}>Kick off</Th>
                <Th sortKey="diag" current={sort} onSort={toggleSort} align="right">Diagn.</Th>
                <Th sortKey="eval" current={sort} onSort={toggleSort} align="right">Eval.</Th>
                <Th sortKey="impl" current={sort} onSort={toggleSort} align="right">Implem.</Th>
                <Th sortKey="total" current={sort} onSort={toggleSort} align="right">Total</Th>
                <th className="py-2 text-[11px] font-semibold uppercase tracking-wider text-left" style={{ color: 'var(--ink-4)', minWidth: 140 }}>Línea de tiempo</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.project.id}
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
                      {r.isClosed && <span className="text-[10px] px-[6px] py-px rounded-full flex-shrink-0" style={{ background: 'var(--bg-3)', color: 'var(--ink-4)' }}>cerrado</span>}
                    </div>
                  </td>
                  <td className="py-2 pr-3">
                    <span className="inline-flex items-center h-5 px-2 rounded-[4px] text-[11px] font-medium" style={{ color: STAGE_COLORS[r.currentStage], border: `1px solid ${STAGE_COLORS[r.currentStage]}` }}>
                      {STAGE_LABELS[r.currentStage]}
                    </span>
                  </td>
                  <td className="py-2 pr-3 tabular-nums" style={{ color: 'var(--ink-3)' }}>{fmtDate(r.project.kickoff_date)}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{fmtDays(r.segments.diag)}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{fmtDays(r.segments.eval)}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{fmtDays(r.segments.impl)}</td>
                  <td className="py-2 pr-3 text-right tabular-nums font-semibold" style={{ color: 'var(--ink)' }}>{fmtDays(r.total)}</td>
                  <td className="py-2">
                    <TimelineBar segments={r.segments} total={r.total} maxTotal={maxTotal} />
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr key="empty"><td colSpan={8}>
                  <EmptyState icon={<Filter size={24} />} title="Ningún proyecto coincide" hint="Ajustá o limpiá los filtros de arriba para ver resultados." compact />
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function TimelineBar({ segments, total, maxTotal }: { segments: Record<string, number | null>; total: number | null; maxTotal: number }) {
  if (total === null || total === 0) return <span className="text-[11px]" style={{ color: 'var(--ink-4)' }}>—</span>;
  const widthPct = (total / maxTotal) * 100;
  return (
    <div className="flex h-[8px] rounded-full overflow-hidden" style={{ width: `${widthPct}%`, minWidth: 30, background: 'var(--bg-3)' }} title={`${total} días`}>
      {SEGMENTS.map(s => {
        const v = segments[s.key];
        if (!v) return null;
        return <div key={s.key} style={{ flex: v, background: s.color }} title={`${s.label}: ${v}d`} />;
      })}
    </div>
  );
}

function getVal(r: { project: Project; currentStage: string; segments: Record<string, number | null>; total: number | null }, key: string): string | number | null {
  switch (key) {
    case 'client': return `${r.project.client ?? ''} ${r.project.name}`.toLowerCase();
    case 'stage': return r.currentStage;
    case 'kickoff': return r.project.kickoff_date ?? null;
    case 'diag': return r.segments.diag;
    case 'eval': return r.segments.eval;
    case 'impl': return r.segments.impl;
    case 'total': return r.total;
    default: return null;
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
