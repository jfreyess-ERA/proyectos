'use client';
import type { Prospect, CrmInteraction, CrmTask, CrmTrigger, User } from '@/lib/types';
import { calcWarmthScore } from './ProspectsView';

interface Props {
  prospects: Prospect[];
  interactions: CrmInteraction[];
  crmTasks: CrmTask[];
  triggers: CrmTrigger[];
  users?: User[];
}

const STAGES = ['New', 'Contacted', 'Meeting Requested', 'Meeting Held', 'Proposal', 'Negotiation', 'Won'];
const STAGE_COLOR: Record<string, string> = {
  'New': 'oklch(0.60 0.00 0)', 'Contacted': 'oklch(0.55 0.14 245)',
  'Meeting Requested': 'oklch(0.70 0.14 85)', 'Meeting Held': 'oklch(0.65 0.16 55)',
  'Proposal': 'oklch(0.58 0.18 300)', 'Negotiation': 'oklch(0.55 0.18 275)',
  'Won': 'oklch(0.55 0.14 160)',
};
const CHANNELS = ['Email', 'LinkedIn', 'Phone', 'WhatsApp', 'Meeting', 'Event', 'Referral'];
const CHANNEL_EMOJI: Record<string, string> = {
  Email: '📧', LinkedIn: '💼', Phone: '📞', WhatsApp: '💬', Meeting: '🤝', Event: '🎪', Referral: '👥',
};

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-[12px] p-5 ${className}`}
      style={{ background: 'var(--surface)', border: '1px solid var(--line)', boxShadow: 'var(--shadow-1)' }}>
      {children}
    </div>
  );
}
function Title({ children }: { children: React.ReactNode }) {
  return <div className="text-[13px] font-semibold mb-4" style={{ color: 'var(--ink)' }}>{children}</div>;
}

// Last 6 months labels
function last6Months(): string[] {
  const months: string[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(); d.setMonth(d.getMonth() - i); d.setDate(1);
    months.push(d.toISOString().slice(0, 7));
  }
  return months;
}

export function CrmReports({ prospects, interactions, crmTasks, triggers, users = [] }: Props) {
  const today = new Date().toISOString().slice(0, 10);
  const activeProspects = prospects.filter(p => p.status !== 'Closed Won' && p.status !== 'Closed Lost');

  // ── Pipeline funnel ──────────────────────────────────────────────
  const stageCounts = STAGES.map((s, i) => {
    const n = activeProspects.filter(p => {
      const stageIdx = STAGES.indexOf(p.stage);
      return stageIdx >= i;
    }).length;
    return { stage: s, n };
  });
  const maxStage = stageCounts[0]?.n || 1;

  const convRates = stageCounts.map((s, i) => {
    if (i === 0) return 100;
    const prev = stageCounts[i - 1].n;
    return prev > 0 ? Math.round((s.n / prev) * 100) : 0;
  });

  // ── Won this month ───────────────────────────────────────────────
  const thisMonth = today.slice(0, 7);
  const wonThisMonth = prospects.filter(p => p.status === 'Closed Won' && p.updated_at?.startsWith(thisMonth)).length;
  const lostThisMonth = prospects.filter(p => p.status === 'Closed Lost' && p.updated_at?.startsWith(thisMonth)).length;

  // ── Interactions by channel ──────────────────────────────────────
  const byChannel = CHANNELS.map(ch => ({
    channel: ch,
    n: interactions.filter(i => i.channel === ch).length,
  })).filter(c => c.n > 0).sort((a, b) => b.n - a.n);
  const maxChannel = Math.max(...byChannel.map(c => c.n), 1);

  // ── Outcomes distribution ────────────────────────────────────────
  const OUTCOMES = ['Meeting booked', 'Interested', 'Positive', 'Not now', 'No response', 'Lost'];
  const outcomeColors: Record<string, string> = {
    'Meeting booked': 'oklch(0.45 0.18 160)', 'Interested': 'oklch(0.55 0.14 160)',
    'Positive': 'oklch(0.60 0.12 160)', 'Not now': 'oklch(0.65 0.08 85)',
    'No response': 'oklch(0.65 0.01 0)', 'Lost': 'oklch(0.55 0.18 25)',
  };
  const byOutcome = OUTCOMES.map(o => ({
    outcome: o,
    n: interactions.filter(i => i.outcome === o).length,
  })).filter(o => o.n > 0);
  const totalOutcomes = byOutcome.reduce((s, o) => s + o.n, 0);

  // ── Monthly activity ─────────────────────────────────────────────
  const months = last6Months();
  const monthLabels = months.map(m => {
    const d = new Date(m + '-15');
    return d.toLocaleString('es-CL', { month: 'short' });
  });
  const monthCounts = months.map(m => interactions.filter(i => i.date.startsWith(m)).length);
  const maxMonth = Math.max(...monthCounts, 1);

  // ── Warmth distribution ──────────────────────────────────────────
  const warmthBuckets = { hot: 0, warm: 0, cool: 0, cold: 0 };
  for (const p of activeProspects) {
    const score = calcWarmthScore(p, interactions, triggers);
    if (score >= 70) warmthBuckets.hot++;
    else if (score >= 45) warmthBuckets.warm++;
    else if (score >= 20) warmthBuckets.cool++;
    else warmthBuckets.cold++;
  }

  // ── By owner ────────────────────────────────────────────────────
  const userMap = Object.fromEntries(users.map(u => [u.id, u]));
  const ownerIds = [...new Set(prospects.map(p => p.owner_id).filter(Boolean))] as string[];
  const byOwner = ownerIds.map(id => ({
    name: userMap[id]?.name ?? id,
    total: prospects.filter(p => p.owner_id === id).length,
    active: prospects.filter(p => p.owner_id === id && p.status !== 'Closed Won' && p.status !== 'Closed Lost').length,
    won: prospects.filter(p => p.owner_id === id && p.status === 'Closed Won').length,
  })).sort((a, b) => b.total - a.total);

  // ── Task completion rate ─────────────────────────────────────────
  const doneTasks = crmTasks.filter(t => t.status === 'Done').length;
  const taskPct = crmTasks.length > 0 ? Math.round(doneTasks / crmTasks.length * 100) : 0;
  const overdueTasks = crmTasks.filter(t => (t.status === 'Pending' || t.status === 'In Progress') && t.due_date && t.due_date < today).length;

  return (
    <div className="p-6 max-w-[1100px]">
      <div className="mb-6">
        <h1 className="text-[24px] font-bold tracking-tight" style={{ color: 'var(--ink)' }}>Reportes CRM</h1>
        <p className="text-[14px] mt-1" style={{ color: 'var(--ink-3)' }}>
          {prospects.length} prospectos · {interactions.length} interacciones · {triggers.filter(t => t.status === 'Open').length} triggers abiertos
        </p>
      </div>

      {/* Top KPI row */}
      <div className="grid grid-cols-4 gap-3 mb-5">
        {[
          { label: 'Cerrados ganados', value: prospects.filter(p => p.status === 'Closed Won').length, color: 'oklch(0.45 0.18 160)', sub: `${wonThisMonth} este mes` },
          { label: 'Cerrados perdidos', value: prospects.filter(p => p.status === 'Closed Lost').length, color: 'oklch(0.45 0.18 25)', sub: `${lostThisMonth} este mes` },
          { label: 'Tasa completación tareas', value: `${taskPct}%`, color: 'var(--ink)', sub: `${overdueTasks} vencidas` },
          { label: 'Triggers activos', value: triggers.filter(t => t.status === 'Open').length, color: 'oklch(0.55 0.14 85)', sub: `${triggers.length} total` },
        ].map(kpi => (
          <Card key={kpi.label}>
            <div className="text-[28px] font-bold tabular-nums leading-none mb-1" style={{ color: kpi.color }}>{kpi.value}</div>
            <div className="text-[12px] font-medium" style={{ color: 'var(--ink)' }}>{kpi.label}</div>
            <div className="text-[11px] mt-[2px]" style={{ color: 'var(--ink-4)' }}>{kpi.sub}</div>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        {/* Funnel de conversión */}
        <Card>
          <Title>Funnel de conversión</Title>
          <div className="flex flex-col gap-2">
            {stageCounts.map((s, i) => (
              <div key={s.stage} className="flex items-center gap-3">
                <div className="w-[130px] text-[11.5px] truncate flex-shrink-0" style={{ color: 'var(--ink-2)' }}>{s.stage}</div>
                <div className="flex-1 h-[20px] rounded-[4px] overflow-hidden" style={{ background: 'var(--bg-3)' }}>
                  <div className="h-full rounded-[4px] flex items-center pl-2 transition-all"
                    style={{ width: `${(s.n / maxStage) * 100}%`, background: STAGE_COLOR[s.stage], minWidth: s.n > 0 ? 20 : 0 }}>
                    {s.n > 0 && <span className="text-[10px] font-semibold text-white">{s.n}</span>}
                  </div>
                </div>
                {i > 0 && (
                  <div className="w-[40px] text-[11px] text-right flex-shrink-0" style={{ color: convRates[i] >= 50 ? 'oklch(0.45 0.14 160)' : convRates[i] >= 25 ? 'oklch(0.55 0.12 85)' : 'oklch(0.55 0.18 25)' }}>
                    {convRates[i]}%
                  </div>
                )}
                {i === 0 && <div className="w-[40px]" />}
              </div>
            ))}
          </div>
          <div className="mt-3 pt-3 text-[11px]" style={{ borderTop: '1px solid var(--line)', color: 'var(--ink-4)' }}>
            Conversión total New→Won: {prospects.length > 0 ? Math.round(prospects.filter(p => p.status === 'Closed Won').length / prospects.length * 100) : 0}%
          </div>
        </Card>

        {/* Actividad mensual */}
        <Card>
          <Title>Interacciones por mes</Title>
          <div className="flex items-end gap-2 h-[120px]">
            {monthCounts.map((n, i) => (
              <div key={months[i]} className="flex-1 flex flex-col items-center gap-1">
                <div className="text-[11px] font-semibold tabular-nums" style={{ color: 'var(--ink-3)' }}>{n}</div>
                <div className="w-full rounded-t-[4px] transition-all"
                  style={{ height: `${(n / maxMonth) * 80}px`, minHeight: n > 0 ? 4 : 0, background: i === 5 ? 'var(--accent)' : 'oklch(0.70 0.08 245)' }} />
                <div className="text-[10px]" style={{ color: 'var(--ink-4)' }}>{monthLabels[i]}</div>
              </div>
            ))}
          </div>
        </Card>

        {/* Interacciones por canal */}
        <Card>
          <Title>Interacciones por canal</Title>
          <div className="flex flex-col gap-3">
            {byChannel.length === 0 && <div className="text-[12px]" style={{ color: 'var(--ink-4)' }}>Sin datos aún</div>}
            {byChannel.map(c => (
              <div key={c.channel} className="flex items-center gap-3">
                <span className="text-[16px] flex-shrink-0">{CHANNEL_EMOJI[c.channel] ?? '📋'}</span>
                <span className="text-[12.5px] w-[80px]" style={{ color: 'var(--ink-2)' }}>{c.channel}</span>
                <div className="flex-1 h-[8px] rounded-full overflow-hidden" style={{ background: 'var(--bg-3)' }}>
                  <div className="h-full rounded-full" style={{ width: `${(c.n / maxChannel) * 100}%`, background: 'var(--accent)' }} />
                </div>
                <span className="text-[12px] font-semibold tabular-nums w-6 text-right" style={{ color: 'var(--ink)' }}>{c.n}</span>
              </div>
            ))}
          </div>
        </Card>

        {/* Outcomes */}
        <Card>
          <Title>Resultados de interacciones</Title>
          <div className="flex flex-col gap-3">
            {byOutcome.length === 0 && <div className="text-[12px]" style={{ color: 'var(--ink-4)' }}>Sin datos aún</div>}
            {byOutcome.map(o => (
              <div key={o.outcome} className="flex items-center gap-3">
                <span className="text-[12.5px] w-[120px]" style={{ color: 'var(--ink-2)' }}>{o.outcome}</span>
                <div className="flex-1 h-[8px] rounded-full overflow-hidden" style={{ background: 'var(--bg-3)' }}>
                  <div className="h-full rounded-full" style={{ width: `${(o.n / totalOutcomes) * 100}%`, background: outcomeColors[o.outcome] ?? 'var(--ink-4)' }} />
                </div>
                <span className="text-[12px] font-semibold tabular-nums w-6 text-right" style={{ color: 'var(--ink)' }}>{o.n}</span>
                <span className="text-[11px] w-8 text-right" style={{ color: 'var(--ink-4)' }}>{Math.round(o.n / totalOutcomes * 100)}%</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Warmth distribution */}
        <Card>
          <Title>Distribución warmth</Title>
          <div className="flex items-end gap-3 h-[100px] mb-2">
            {[
              { label: '🔥 Hot', value: warmthBuckets.hot, color: 'oklch(0.55 0.18 160)' },
              { label: '🌡 Warm', value: warmthBuckets.warm, color: 'oklch(0.65 0.16 55)' },
              { label: '❄ Cool', value: warmthBuckets.cool, color: 'oklch(0.65 0.14 25)' },
              { label: '⬜ Cold', value: warmthBuckets.cold, color: 'oklch(0.65 0.01 0)' },
            ].map(b => {
              const max = Math.max(warmthBuckets.hot, warmthBuckets.warm, warmthBuckets.cool, warmthBuckets.cold, 1);
              return (
                <div key={b.label} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-[12px] font-semibold tabular-nums" style={{ color: 'var(--ink-3)' }}>{b.value}</span>
                  <div className="w-full rounded-t-[4px]" style={{ height: `${(b.value / max) * 70}px`, minHeight: b.value > 0 ? 4 : 0, background: b.color }} />
                  <span className="text-[10.5px] text-center" style={{ color: 'var(--ink-4)' }}>{b.label}</span>
                </div>
              );
            })}
          </div>
          <div className="text-[11px]" style={{ color: 'var(--ink-4)' }}>
            {activeProspects.length} prospectos activos analizados
          </div>
        </Card>

        {/* Por dueño */}
        <Card>
          <Title>Por responsable</Title>
          {byOwner.length === 0 && <div className="text-[12px]" style={{ color: 'var(--ink-4)' }}>Sin datos de asignación</div>}
          <div className="flex flex-col gap-2">
            {byOwner.map(o => (
              <div key={o.name} className="flex items-center gap-3 py-1">
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-semibold flex-shrink-0 text-white"
                  style={{ background: 'var(--accent)' }}
                >
                  {o.name.slice(0, 2).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-medium truncate" style={{ color: 'var(--ink)' }}>{o.name}</div>
                  <div className="text-[11px]" style={{ color: 'var(--ink-4)' }}>
                    {o.total} total · {o.active} activos · {o.won} ganados
                  </div>
                </div>
                <div className="text-[13px] font-semibold" style={{ color: o.won > 0 ? 'oklch(0.45 0.18 160)' : 'var(--ink-3)' }}>
                  {o.total > 0 ? `${Math.round(o.won / o.total * 100)}%` : '—'}
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
