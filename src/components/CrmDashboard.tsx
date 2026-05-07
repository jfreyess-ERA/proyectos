'use client';
import type { Prospect, CrmInteraction, CrmTask, CrmTrigger } from '@/lib/types';

interface Props {
  prospects: Prospect[];
  interactions: CrmInteraction[];
  crmTasks: CrmTask[];
  triggers: CrmTrigger[];
  onViewProspects: (filter?: string) => void;
}

const STAGE_ORDER = ['New', 'Contacted', 'Meeting Requested', 'Meeting Held', 'Proposal', 'Negotiation', 'Won'];
const STAGE_COLOR: Record<string, string> = {
  'New': 'oklch(0.60 0.00 0)',
  'Contacted': 'oklch(0.55 0.14 245)',
  'Meeting Requested': 'oklch(0.70 0.14 85)',
  'Meeting Held': 'oklch(0.65 0.16 55)',
  'Proposal': 'oklch(0.58 0.18 300)',
  'Negotiation': 'oklch(0.55 0.18 275)',
  'Won': 'oklch(0.55 0.14 160)',
};

export function CrmDashboard({ prospects, interactions, crmTasks, triggers, onViewProspects }: Props) {
  const today = new Date().toISOString().slice(0, 10);
  const in7days = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
  const days30ago = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
  const thisMonth = new Date().toISOString().slice(0, 7);

  // KPI calcs
  const active = prospects.filter(p => p.status === 'Active').length;
  const warm = prospects.filter(p => p.status === 'Warm').length;
  const nurture = prospects.filter(p => p.status === 'Nurture').length;

  const pendingTasks = crmTasks.filter(t => t.status === 'Pending' || t.status === 'In Progress' || t.status === 'Waiting');
  const overdueTasks = pendingTasks.filter(t => t.due_date && t.due_date < today);
  const followupsToday = pendingTasks.filter(t => t.due_date === today);
  const followups7 = pendingTasks.filter(t => t.due_date && t.due_date >= today && t.due_date <= in7days);
  const openTriggers = triggers.filter(t => t.status === 'Open').length;

  const thisMonthInteractions = interactions.filter(i => i.date.startsWith(thisMonth)).length;

  // Prospects with no interaction in 30+ days
  const prospectLastContact: Record<string, string> = {};
  for (const i of interactions) {
    if (!prospectLastContact[i.prospect_id] || i.date > prospectLastContact[i.prospect_id]) {
      prospectLastContact[i.prospect_id] = i.date;
    }
  }
  const stale30 = prospects.filter(p =>
    p.status !== 'Closed Won' && p.status !== 'Closed Lost' &&
    (!prospectLastContact[p.id] || prospectLastContact[p.id] < days30ago)
  ).length;

  // By stage
  const byStage = STAGE_ORDER.map(s => ({
    stage: s,
    count: prospects.filter(p => p.stage === s && p.status !== 'Closed Lost').length,
  }));
  const maxStage = Math.max(...byStage.map(s => s.count), 1);

  // Recent interactions
  const recentInteractions = [...interactions]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 5);

  // Upcoming tasks
  const upcomingTasks = [...pendingTasks]
    .filter(t => t.due_date)
    .sort((a, b) => (a.due_date ?? '').localeCompare(b.due_date ?? ''))
    .slice(0, 6);

  const prospectMap = Object.fromEntries(prospects.map(p => [p.id, p]));

  return (
    <div className="p-6 max-w-[1200px]">
      <div className="mb-6">
        <h1 className="text-[24px] font-bold tracking-tight" style={{ color: 'var(--ink)' }}>
          Dashboard CRM
        </h1>
        <p className="text-[14px] mt-1" style={{ color: 'var(--ink-3)' }}>
          {prospects.length} prospectos · {thisMonthInteractions} interacciones este mes
        </p>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Activos', value: active, color: 'oklch(0.55 0.14 245)', sub: 'status Active' },
          { label: 'Warm', value: warm, color: 'oklch(0.65 0.16 55)', sub: 'status Warm' },
          { label: 'Nurture', value: nurture, color: 'oklch(0.58 0.18 300)', sub: 'status Nurture' },
          { label: 'Triggers abiertos', value: openTriggers, color: 'oklch(0.62 0.16 25)', sub: '' },
        ].map(kpi => (
          <button
            key={kpi.label}
            onClick={() => kpi.sub && onViewProspects(kpi.sub)}
            className="rounded-[12px] p-4 text-left transition-all"
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--line)',
              boxShadow: 'var(--shadow-1)',
              cursor: kpi.sub ? 'pointer' : 'default',
            }}
          >
            <div className="text-[32px] font-bold tabular-nums leading-none mb-1" style={{ color: kpi.color }}>
              {kpi.value}
            </div>
            <div className="text-[12px]" style={{ color: 'var(--ink-3)' }}>{kpi.label}</div>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Tareas pendientes', value: pendingTasks.length, color: 'var(--ink)', warn: false },
          { label: 'Tareas vencidas', value: overdueTasks.length, color: overdueTasks.length > 0 ? 'oklch(0.55 0.18 25)' : 'var(--ink)', warn: overdueTasks.length > 0 },
          { label: 'Seguimientos hoy', value: followupsToday.length, color: followupsToday.length > 0 ? 'oklch(0.55 0.14 245)' : 'var(--ink)', warn: false },
          { label: 'Sin contacto 30d+', value: stale30, color: stale30 > 0 ? 'oklch(0.60 0.14 85)' : 'var(--ink)', warn: stale30 > 0 },
        ].map(kpi => (
          <div
            key={kpi.label}
            className="rounded-[12px] p-4"
            style={{
              background: kpi.warn ? 'color-mix(in oklch, var(--surface) 96%, oklch(0.55 0.18 25) 4%)' : 'var(--surface)',
              border: `1px solid ${kpi.warn ? 'oklch(0.80 0.08 25)' : 'var(--line)'}`,
              boxShadow: 'var(--shadow-1)',
            }}
          >
            <div className="text-[32px] font-bold tabular-nums leading-none mb-1" style={{ color: kpi.color }}>
              {kpi.value}
            </div>
            <div className="text-[12px]" style={{ color: 'var(--ink-3)' }}>{kpi.label}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-4 mb-4">
        {/* Pipeline por etapa */}
        <div className="col-span-1 rounded-[12px] p-5" style={{ background: 'var(--surface)', border: '1px solid var(--line)', boxShadow: 'var(--shadow-1)' }}>
          <div className="text-[13px] font-semibold mb-4" style={{ color: 'var(--ink)' }}>Pipeline por etapa</div>
          <div className="flex flex-col gap-3">
            {byStage.map(({ stage, count }) => (
              <div key={stage} className="flex items-center gap-3">
                <span className="text-[12px] w-[120px] truncate" style={{ color: 'var(--ink-2)' }}>{stage}</span>
                <div className="flex-1 h-[6px] rounded-full overflow-hidden" style={{ background: 'var(--bg-3)' }}>
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${(count / maxStage) * 100}%`, background: STAGE_COLOR[stage] }}
                  />
                </div>
                <span className="text-[12px] font-semibold tabular-nums w-5 text-right" style={{ color: 'var(--ink)' }}>
                  {count}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Próximas tareas */}
        <div className="col-span-1 rounded-[12px] p-5" style={{ background: 'var(--surface)', border: '1px solid var(--line)', boxShadow: 'var(--shadow-1)' }}>
          <div className="text-[13px] font-semibold mb-4" style={{ color: 'var(--ink)' }}>
            Próximas tareas · {followups7.length} esta semana
          </div>
          <div className="flex flex-col gap-2">
            {upcomingTasks.length === 0 && (
              <div className="text-[12px]" style={{ color: 'var(--ink-4)' }}>Sin tareas pendientes</div>
            )}
            {upcomingTasks.map(task => {
              const prospect = prospectMap[task.prospect_id];
              const isOverdue = task.due_date && task.due_date < today;
              const isToday = task.due_date === today;
              return (
                <div key={task.id} className="flex items-start gap-2">
                  <div
                    className="w-[6px] h-[6px] rounded-full mt-[5px] flex-shrink-0"
                    style={{ background: isOverdue ? 'oklch(0.55 0.18 25)' : isToday ? 'oklch(0.55 0.14 245)' : 'var(--ink-4)' }}
                  />
                  <div className="min-w-0">
                    <div className="text-[12px] truncate" style={{ color: 'var(--ink)' }}>
                      {task.task_type ?? 'Tarea'} — {prospect?.company ?? '…'}
                    </div>
                    <div className="text-[11px]" style={{ color: isOverdue ? 'oklch(0.55 0.18 25)' : 'var(--ink-4)' }}>
                      {task.due_date ? fmtDate(task.due_date) : 'Sin fecha'}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Últimas interacciones */}
        <div className="col-span-1 rounded-[12px] p-5" style={{ background: 'var(--surface)', border: '1px solid var(--line)', boxShadow: 'var(--shadow-1)' }}>
          <div className="text-[13px] font-semibold mb-4" style={{ color: 'var(--ink)' }}>Últimas interacciones</div>
          <div className="flex flex-col gap-3">
            {recentInteractions.length === 0 && (
              <div className="text-[12px]" style={{ color: 'var(--ink-4)' }}>Sin interacciones</div>
            )}
            {recentInteractions.map(i => {
              const prospect = prospectMap[i.prospect_id];
              return (
                <div key={i.id} className="flex items-start gap-2">
                  <span className="text-[14px] mt-[-1px]">{channelEmoji(i.channel)}</span>
                  <div className="min-w-0">
                    <div className="text-[12px] font-medium truncate" style={{ color: 'var(--ink)' }}>
                      {prospect?.company ?? '…'}
                    </div>
                    <div className="text-[11px] truncate" style={{ color: 'var(--ink-3)' }}>
                      {i.type ?? i.channel ?? 'Interacción'} · {fmtDate(i.date)}
                    </div>
                  </div>
                  {i.outcome && (
                    <span
                      className="ml-auto text-[10px] px-[6px] py-[2px] rounded-full flex-shrink-0"
                      style={{ background: outcomeBg(i.outcome), color: outcomeFg(i.outcome) }}
                    >
                      {i.outcome}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function fmtDate(d: string): string {
  const date = new Date(d + 'T12:00:00');
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const diff = Math.round((date.getTime() - today.getTime()) / 86400000);
  if (diff === 0) return 'Hoy';
  if (diff === 1) return 'Mañana';
  if (diff === -1) return 'Ayer';
  if (diff < 0) return `Hace ${-diff}d`;
  return date.toLocaleDateString('es-CL', { day: 'numeric', month: 'short' });
}

function channelEmoji(channel?: string): string {
  const map: Record<string, string> = {
    Email: '📧', LinkedIn: '💼', Phone: '📞', WhatsApp: '💬',
    Meeting: '🤝', Event: '🎪', Referral: '👥',
  };
  return map[channel ?? ''] ?? '📋';
}

function outcomeBg(outcome: string): string {
  if (outcome === 'Positive' || outcome === 'Interested' || outcome === 'Meeting booked')
    return 'oklch(0.95 0.06 160)';
  if (outcome === 'Not now' || outcome === 'No response') return 'oklch(0.94 0.02 85)';
  if (outcome === 'Lost') return 'oklch(0.95 0.06 25)';
  return 'var(--bg-3)';
}

function outcomeFg(outcome: string): string {
  if (outcome === 'Positive' || outcome === 'Interested' || outcome === 'Meeting booked')
    return 'oklch(0.38 0.12 160)';
  if (outcome === 'Not now' || outcome === 'No response') return 'oklch(0.45 0.05 85)';
  if (outcome === 'Lost') return 'oklch(0.45 0.18 25)';
  return 'var(--ink-3)';
}
