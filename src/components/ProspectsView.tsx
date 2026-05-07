'use client';
import { useState } from 'react';
import { Search, Upload, ChevronUp, ChevronDown, X, Check } from 'lucide-react';
import { updateProspect } from '@/lib/db';
import type { Prospect, CrmInteraction, CrmTask, CrmTrigger, User, ProspectStatus, ProspectStage } from '@/lib/types';

interface Props {
  prospects: Prospect[];
  interactions: CrmInteraction[];
  crmTasks: CrmTask[];
  triggers: CrmTrigger[];
  users?: User[];
  onOpenProspect: (p: Prospect) => void;
  onCreateProspect: () => void;
  onImport: () => void;
}

const STATUS_TABS = ['Todos', 'Active', 'Warm', 'Nurture', 'Paused', 'Closed Won', 'Closed Lost', 'Dormant'];

export const PRIORITY_STYLE: Record<string, { bg: string; fg: string }> = {
  'High':       { bg: 'oklch(0.96 0.05 25)',  fg: 'oklch(0.45 0.18 25)'  },
  'Medium':     { bg: 'oklch(0.96 0.05 85)',  fg: 'oklch(0.45 0.12 85)'  },
  'Low':        { bg: 'oklch(0.94 0.01 0)',   fg: 'oklch(0.50 0.01 0)'   },
  'Strategic':  { bg: 'oklch(0.95 0.06 300)', fg: 'oklch(0.40 0.18 300)' },
  'Watchlist':  { bg: 'oklch(0.95 0.05 245)', fg: 'oklch(0.40 0.14 245)' },
};

export const STATUS_STYLE: Record<string, { bg: string; fg: string; dot: string }> = {
  'Active':      { bg: 'oklch(0.95 0.06 160)', fg: 'oklch(0.38 0.12 160)', dot: 'oklch(0.55 0.14 160)' },
  'Warm':        { bg: 'oklch(0.96 0.06 55)',  fg: 'oklch(0.42 0.14 55)',  dot: 'oklch(0.65 0.16 55)'  },
  'Paused':      { bg: 'oklch(0.94 0.01 0)',   fg: 'oklch(0.50 0.01 0)',   dot: 'oklch(0.60 0.01 0)'   },
  'Nurture':     { bg: 'oklch(0.95 0.05 245)', fg: 'oklch(0.40 0.14 245)', dot: 'oklch(0.55 0.14 245)' },
  'Closed Won':  { bg: 'oklch(0.95 0.06 160)', fg: 'oklch(0.32 0.14 160)', dot: 'oklch(0.45 0.18 160)' },
  'Closed Lost': { bg: 'oklch(0.96 0.04 25)',  fg: 'oklch(0.45 0.18 25)',  dot: 'oklch(0.55 0.18 25)'  },
  'Dormant':     { bg: 'oklch(0.92 0.01 0)',   fg: 'oklch(0.55 0.01 0)',   dot: 'oklch(0.65 0.01 0)'   },
};

export const STAGE_STYLE: Record<string, string> = {
  'New':               'oklch(0.60 0.00 0)',
  'Contacted':         'oklch(0.55 0.14 245)',
  'Meeting Requested': 'oklch(0.70 0.14 85)',
  'Meeting Held':      'oklch(0.65 0.16 55)',
  'Proposal':          'oklch(0.58 0.18 300)',
  'Negotiation':       'oklch(0.55 0.18 275)',
  'Won':               'oklch(0.55 0.14 160)',
};

const STAGE_ORDER = ['New', 'Contacted', 'Meeting Requested', 'Meeting Held', 'Proposal', 'Negotiation', 'Won'];

// ── Warmth Score ──────────────────────────────────────────────────

export function calcWarmthScore(
  prospect: Prospect,
  allInteractions: CrmInteraction[],
  allTriggers: CrmTrigger[]
): number {
  if (prospect.status === 'Closed Won') return 100;
  if (prospect.status === 'Closed Lost' || prospect.status === 'Dormant') return 0;

  const pInts = allInteractions.filter(i => i.prospect_id === prospect.id);
  const pTrigs = allTriggers.filter(t => t.prospect_id === prospect.id && t.status === 'Open');

  let score = 45;

  // Last contact
  if (pInts.length > 0) {
    const lastDate = pInts.reduce((max, i) => i.date > max ? i.date : max, pInts[0].date);
    const today = new Date().toISOString().slice(0, 10);
    const daysSince = Math.round((new Date(today).getTime() - new Date(lastDate + 'T00:00:00').getTime()) / 86400000);
    score -= Math.min(daysSince * 1.5, 45);
  } else {
    score -= 30;
  }

  // Recent positive outcomes (last 60 days)
  const cutoff = new Date(Date.now() - 60 * 86400000).toISOString().slice(0, 10);
  const positives = pInts.filter(i => i.date >= cutoff && (i.outcome === 'Positive' || i.outcome === 'Interested' || i.outcome === 'Meeting booked'));
  score += positives.length * 12;

  // Active triggers
  score += pTrigs.length * 8;

  // Status modifier
  if (prospect.status === 'Warm') score += 12;
  if (prospect.status === 'Nurture') score -= 5;
  if (prospect.status === 'Paused') score -= 15;

  return Math.max(0, Math.min(100, Math.round(score)));
}

function warmthColor(score: number): { bar: string; label: string } {
  if (score >= 70) return { bar: 'oklch(0.55 0.18 160)', label: '🔥' };
  if (score >= 45) return { bar: 'oklch(0.65 0.16 55)',  label: '🌡' };
  if (score >= 20) return { bar: 'oklch(0.65 0.14 25)',  label: '❄' };
  return { bar: 'oklch(0.65 0.01 0)', label: '⬜' };
}

function fmtDate(d?: string): string {
  if (!d) return '—';
  const date = new Date(d + 'T12:00:00');
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const diff = Math.round((date.getTime() - today.getTime()) / 86400000);
  if (diff === 0) return 'Hoy';
  if (diff < 0) return `${-diff}d atrás`;
  return date.toLocaleDateString('es-CL', { day: 'numeric', month: 'short' });
}

type SortKey = 'company' | 'stage' | 'status' | 'priority' | 'warmth' | 'lastContact' | 'nextFollowUp' | 'interactions';
type SortDir = 'asc' | 'desc';

const STAGE_IDX = Object.fromEntries(STAGE_ORDER.map((s, i) => [s, i]));
const PRIORITY_IDX: Record<string, number> = { Strategic: 0, High: 1, Medium: 2, Low: 3, Watchlist: 4 };

export function ProspectsView({ prospects, interactions, crmTasks, triggers, users, onOpenProspect, onCreateProspect, onImport }: Props) {
  const [search, setSearch]           = useState('');
  const [statusFilter, setStatusFilter] = useState('Todos');
  const [ownerFilter, setOwnerFilter]  = useState('');
  const [sortKey, setSortKey]         = useState<SortKey>('warmth');
  const [sortDir, setSortDir]         = useState<SortDir>('desc');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkUpdating, setBulkUpdating] = useState(false);

  const today = new Date().toISOString().slice(0, 10);

  // Derived maps
  const lastContact: Record<string, string> = {};
  for (const i of interactions) {
    if (!lastContact[i.prospect_id] || i.date > lastContact[i.prospect_id]) {
      lastContact[i.prospect_id] = i.date;
    }
  }
  const interactionCount: Record<string, number> = {};
  for (const i of interactions) {
    interactionCount[i.prospect_id] = (interactionCount[i.prospect_id] ?? 0) + 1;
  }
  const nextFollowUp: Record<string, string> = {};
  for (const t of crmTasks) {
    if ((t.status === 'Pending' || t.status === 'In Progress') && t.due_date) {
      if (!nextFollowUp[t.prospect_id] || t.due_date < nextFollowUp[t.prospect_id]) {
        nextFollowUp[t.prospect_id] = t.due_date;
      }
    }
  }

  // Warmth scores
  const warmthScore: Record<string, number> = {};
  for (const p of prospects) {
    warmthScore[p.id] = calcWarmthScore(p, interactions, triggers);
  }

  // User map
  const userMap = Object.fromEntries((users ?? []).map(u => [u.id, u]));
  const ownerIds = [...new Set(prospects.map(p => p.owner_id).filter(Boolean))] as string[];

  // Filter
  const filtered = prospects.filter(p => {
    if (statusFilter !== 'Todos' && p.status !== statusFilter) return false;
    if (ownerFilter && p.owner_id !== ownerFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        p.company.toLowerCase().includes(q) ||
        (p.contact_name ?? '').toLowerCase().includes(q) ||
        (p.industry ?? '').toLowerCase().includes(q)
      );
    }
    return true;
  });

  // Sort
  const sorted = [...filtered].sort((a, b) => {
    let diff = 0;
    switch (sortKey) {
      case 'company':       diff = a.company.localeCompare(b.company); break;
      case 'stage':         diff = (STAGE_IDX[a.stage] ?? 99) - (STAGE_IDX[b.stage] ?? 99); break;
      case 'priority':      diff = (PRIORITY_IDX[a.priority] ?? 99) - (PRIORITY_IDX[b.priority] ?? 99); break;
      case 'status':        diff = a.status.localeCompare(b.status); break;
      case 'warmth':        diff = (warmthScore[a.id] ?? 0) - (warmthScore[b.id] ?? 0); break;
      case 'lastContact':   diff = (lastContact[a.id] ?? '').localeCompare(lastContact[b.id] ?? ''); break;
      case 'nextFollowUp':  diff = (nextFollowUp[a.id] ?? 'z').localeCompare(nextFollowUp[b.id] ?? 'z'); break;
      case 'interactions':  diff = (interactionCount[a.id] ?? 0) - (interactionCount[b.id] ?? 0); break;
    }
    return sortDir === 'asc' ? diff : -diff;
  });

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('desc'); }
  }

  function SortIcon({ k }: { k: SortKey }) {
    if (sortKey !== k) return <span style={{ color: 'var(--ink-4)', fontSize: 10 }}>⇅</span>;
    return sortDir === 'desc' ? <ChevronDown size={11} style={{ color: 'var(--accent)' }} /> : <ChevronUp size={11} style={{ color: 'var(--accent)' }} />;
  }

  function toggleSelect(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selectedIds.size === sorted.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(sorted.map(p => p.id)));
    }
  }

  async function bulkSetStatus(status: ProspectStatus) {
    setBulkUpdating(true);
    try {
      await Promise.all([...selectedIds].map(id => updateProspect(id, { status })));
      setSelectedIds(new Set());
    } finally {
      setBulkUpdating(false);
    }
  }

  async function bulkSetStage(stage: ProspectStage) {
    setBulkUpdating(true);
    try {
      await Promise.all([...selectedIds].map(id => updateProspect(id, { stage })));
      setSelectedIds(new Set());
    } finally {
      setBulkUpdating(false);
    }
  }

  // Stage counts for pipeline header
  const stageCounts = STAGE_ORDER.map(s => ({
    stage: s,
    count: prospects.filter(p => p.stage === s && p.status !== 'Closed Lost').length,
  }));

  return (
    <div className="flex flex-col h-full">
      {/* Pipeline mini header */}
      <div className="flex items-center gap-0 px-6 py-3 border-b overflow-x-auto flex-shrink-0"
        style={{ borderColor: 'var(--line)', background: 'var(--bg-2)' }}>
        {stageCounts.map((s, i) => (
          <div key={s.stage} className="flex items-center gap-0 flex-shrink-0">
            <button onClick={() => { setStatusFilter('Todos'); setSearch(''); }}
              className="flex flex-col items-center px-4 py-1">
              <span className="text-[18px] font-bold tabular-nums" style={{ color: STAGE_STYLE[s.stage] }}>{s.count}</span>
              <span className="text-[10.5px] whitespace-nowrap" style={{ color: 'var(--ink-3)' }}>{s.stage}</span>
            </button>
            {i < stageCounts.length - 1 && <span style={{ color: 'var(--ink-4)', fontSize: 12 }}>›</span>}
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-2 px-6 py-3 border-b flex-shrink-0 flex-wrap" style={{ borderColor: 'var(--line)' }}>
        <div className="relative">
          <Search size={13} className="absolute left-[8px] top-1/2 -translate-y-1/2" style={{ color: 'var(--ink-4)' }} />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Buscar empresa, contacto…"
            className="h-8 pl-7 pr-3 rounded-[7px] text-[13px] outline-none"
            style={{ width: 220, border: '1px solid var(--line)', background: 'var(--surface-2)', color: 'var(--ink)', fontFamily: 'var(--font)' }} />
        </div>

        {/* Status filter */}
        <div className="flex gap-[2px] flex-wrap">
          {STATUS_TABS.map(tab => (
            <button key={tab} onClick={() => setStatusFilter(tab)}
              className="h-7 px-2 rounded-[6px] text-[11.5px] border-0 transition-colors"
              style={{ background: statusFilter === tab ? 'var(--accent)' : 'var(--bg-3)', color: statusFilter === tab ? 'var(--on-accent)' : 'var(--ink-2)', fontWeight: statusFilter === tab ? 600 : 400 }}>
              {tab}
            </button>
          ))}
        </div>

        {/* Owner filter */}
        {ownerIds.length > 0 && (
          <select value={ownerFilter} onChange={e => setOwnerFilter(e.target.value)}
            className="h-8 px-2 rounded-[7px] text-[12px] outline-none"
            style={{ border: '1px solid var(--line)', background: 'var(--surface-2)', color: 'var(--ink)', fontFamily: 'var(--font)' }}>
            <option value="">Todos los dueños</option>
            {ownerIds.map(id => (
              <option key={id} value={id}>{userMap[id]?.name ?? id}</option>
            ))}
          </select>
        )}

        <div className="flex items-center gap-2 ml-auto">
          <button onClick={onImport}
            className="h-8 px-3 rounded-[7px] text-[12px] font-medium flex items-center gap-1 border-0"
            style={{ background: 'var(--bg-3)', color: 'var(--ink-2)', border: '1px solid var(--line)' }}>
            <Upload size={13} /> Importar CSV
          </button>
          <button onClick={onCreateProspect}
            className="h-8 px-3 rounded-[7px] text-[13px] font-medium flex items-center gap-[6px] border-0"
            style={{ background: 'var(--accent)', color: 'var(--on-accent)', boxShadow: '0 1px 0 rgba(255,255,255,.2) inset, var(--shadow-1)' }}>
            + Nuevo prospecto
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto relative">
        <table className="w-full border-collapse" style={{ fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--line)', background: 'var(--bg-2)', position: 'sticky', top: 0, zIndex: 1 }}>
              <th className="px-4 py-[8px] w-[36px]" style={{ background: 'var(--bg-2)' }}>
                <input type="checkbox"
                  checked={sorted.length > 0 && selectedIds.size === sorted.length}
                  onChange={toggleSelectAll}
                  className="cursor-pointer"
                  style={{ accentColor: 'var(--accent)', width: 14, height: 14 }} />
              </th>
              {([
                ['company',       'Empresa'],
                ['interactions',  'Int.'],
                ['priority',      'Prioridad'],
                ['stage',         'Etapa'],
                ['status',        'Estado'],
                ['warmth',        'Warmth'],
                ['lastContact',   'Último contacto'],
                ['nextFollowUp',  'Próx. seguimiento'],
              ] as [SortKey, string][]).map(([key, label]) => (
                <th key={key}
                  onClick={() => toggleSort(key)}
                  className="text-left px-4 py-[8px] text-[11px] font-semibold tracking-wide uppercase cursor-pointer select-none whitespace-nowrap"
                  style={{ color: sortKey === key ? 'var(--accent)' : 'var(--ink-4)', background: 'var(--bg-2)' }}>
                  <span className="flex items-center gap-1">{label} <SortIcon k={key} /></span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 && (
              <tr><td colSpan={9} className="px-4 py-10 text-center text-[13px]" style={{ color: 'var(--ink-4)' }}>
                {search ? 'No se encontraron resultados' : 'Sin prospectos. Crea el primero o importa desde CSV.'}
              </td></tr>
            )}
            {sorted.map(p => {
              const priStyle  = PRIORITY_STYLE[p.priority] ?? PRIORITY_STYLE['Medium'];
              const statStyle = STATUS_STYLE[p.status] ?? STATUS_STYLE['Active'];
              const lastC  = lastContact[p.id];
              const nextF  = nextFollowUp[p.id];
              const intCnt = interactionCount[p.id] ?? 0;
              const ws     = warmthScore[p.id] ?? 0;
              const wc     = warmthColor(ws);
              const isOverdue = nextF && nextF < today;
              const daysSince = lastC ? Math.round((new Date(today).getTime() - new Date(lastC + 'T00:00:00').getTime()) / 86400000) : null;
              const isStale = daysSince !== null && daysSince > 30;
              const isSelected = selectedIds.has(p.id);

              return (
                <tr key={p.id} onClick={() => onOpenProspect(p)}
                  className="cursor-pointer transition-colors"
                  style={{ borderBottom: '1px solid var(--line)', background: isSelected ? 'var(--accent-bg)' : '' }}
                  onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'var(--bg-2)'; }}
                  onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = ''; }}>

                  <td className="px-4 py-[10px]" onClick={e => toggleSelect(p.id, e)}>
                    <input type="checkbox" checked={isSelected} onChange={() => {}}
                      className="cursor-pointer"
                      style={{ accentColor: 'var(--accent)', width: 14, height: 14 }} />
                  </td>

                  <td className="px-4 py-[10px]">
                    <div className="font-semibold" style={{ color: 'var(--ink)' }}>{p.company}</div>
                    {p.contact_name && <div className="text-[11px]" style={{ color: 'var(--ink-4)' }}>{p.contact_name}{p.role ? ` · ${p.role}` : ''}</div>}
                  </td>

                  <td className="px-4 py-[10px] text-center">
                    <span className="text-[12px] font-semibold tabular-nums" style={{ color: intCnt > 0 ? 'var(--ink)' : 'var(--ink-4)' }}>
                      {intCnt}
                    </span>
                  </td>

                  <td className="px-4 py-[10px]">
                    <span className="inline-block text-[11px] font-medium px-[7px] py-[2px] rounded-full" style={{ background: priStyle.bg, color: priStyle.fg }}>
                      {p.priority}
                    </span>
                  </td>

                  <td className="px-4 py-[10px]">
                    <div className="flex items-center gap-[6px]">
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: STAGE_STYLE[p.stage] ?? 'var(--ink-4)' }} />
                      <span className="text-[12.5px]" style={{ color: 'var(--ink-2)' }}>{p.stage}</span>
                    </div>
                  </td>

                  <td className="px-4 py-[10px]">
                    <span className="inline-block text-[11px] font-medium px-[7px] py-[2px] rounded-full" style={{ background: statStyle.bg, color: statStyle.fg }}>
                      {p.status}
                    </span>
                  </td>

                  <td className="px-4 py-[10px]">
                    <div className="flex items-center gap-2">
                      <div className="w-[52px] h-[6px] rounded-full overflow-hidden flex-shrink-0" style={{ background: 'var(--bg-3)' }}>
                        <div className="h-full rounded-full transition-all" style={{ width: `${ws}%`, background: wc.bar }} />
                      </div>
                      <span className="text-[11px] tabular-nums w-7" style={{ color: 'var(--ink-3)' }}>{ws}</span>
                      <span className="text-[12px]">{wc.label}</span>
                    </div>
                  </td>

                  <td className="px-4 py-[10px]">
                    <span className="text-[12px]" style={{ color: isStale ? 'oklch(0.55 0.18 25)' : 'var(--ink-3)', fontWeight: isStale ? 600 : 400 }}>
                      {fmtDate(lastC)}
                    </span>
                    {daysSince !== null && (
                      <div className="text-[10.5px]" style={{ color: isStale ? 'oklch(0.55 0.18 25)' : 'var(--ink-4)' }}>
                        {daysSince}d atrás
                      </div>
                    )}
                  </td>

                  <td className="px-4 py-[10px] text-[12px]" style={{ color: isOverdue ? 'oklch(0.55 0.18 25)' : 'var(--ink-3)', fontWeight: isOverdue ? 600 : 400 }}>
                    {fmtDate(nextF)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Floating bulk action toolbar */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-4 py-[10px] rounded-[12px]"
          style={{ background: 'var(--ink)', color: 'white', boxShadow: '0 8px 32px rgba(0,0,0,.35)', minWidth: 380 }}>
          <span className="text-[13px] font-semibold mr-1">{selectedIds.size} seleccionados</span>

          <div className="w-px h-4 mx-1" style={{ background: 'rgba(255,255,255,.2)' }} />

          <span className="text-[11px] opacity-60 flex-shrink-0">Etapa:</span>
          <select
            disabled={bulkUpdating}
            onChange={e => { if (e.target.value) bulkSetStage(e.target.value as ProspectStage); e.target.value = ''; }}
            className="h-7 px-2 rounded-[6px] text-[12px] border-0 outline-none cursor-pointer"
            style={{ background: 'rgba(255,255,255,.15)', color: 'white', fontFamily: 'var(--font)' }}>
            <option value="">Cambiar…</option>
            {(['New','Contacted','Meeting Requested','Meeting Held','Proposal','Negotiation','Won'] as ProspectStage[]).map(s =>
              <option key={s} value={s}>{s}</option>
            )}
          </select>

          <span className="text-[11px] opacity-60 flex-shrink-0">Estado:</span>
          <select
            disabled={bulkUpdating}
            onChange={e => { if (e.target.value) bulkSetStatus(e.target.value as ProspectStatus); e.target.value = ''; }}
            className="h-7 px-2 rounded-[6px] text-[12px] border-0 outline-none cursor-pointer"
            style={{ background: 'rgba(255,255,255,.15)', color: 'white', fontFamily: 'var(--font)' }}>
            <option value="">Cambiar…</option>
            {(['Active','Warm','Paused','Nurture','Closed Won','Closed Lost','Dormant'] as ProspectStatus[]).map(s =>
              <option key={s} value={s}>{s}</option>
            )}
          </select>

          {bulkUpdating && <span className="text-[12px] opacity-70">Actualizando…</span>}

          <button onClick={() => setSelectedIds(new Set())}
            className="ml-auto w-6 h-6 flex items-center justify-center rounded-full border-0 opacity-60 hover:opacity-100 transition-opacity"
            style={{ background: 'rgba(255,255,255,.15)' }}>
            <X size={13} />
          </button>
        </div>
      )}
    </div>
  );
}
