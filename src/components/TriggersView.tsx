'use client';
import { useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { updateCrmTrigger } from '@/lib/db';
import type { CrmTrigger, Prospect } from '@/lib/types';

interface Props {
  triggers: CrmTrigger[];
  prospects: Prospect[];
  onOpenProspect: (p: Prospect) => void;
  onTriggersChanged: () => void;
}

const TRIGGER_ICONS: Record<string, string> = {
  'News': '📰', 'Hiring': '🧑‍💼', 'Expansion': '🌍', 'Regulation': '⚖️',
  'Leadership change': '👤', 'Earnings': '💰', 'Results': '📈',
};

const STATUS_STYLE: Record<string, { bg: string; fg: string }> = {
  'Open':       { bg: 'oklch(0.95 0.06 25)',  fg: 'oklch(0.45 0.18 25)'  },
  'Monitoring': { bg: 'oklch(0.96 0.05 85)',  fg: 'oklch(0.42 0.14 85)'  },
  'Closed':     { bg: 'oklch(0.94 0.01 0)',   fg: 'oklch(0.50 0.01 0)'   },
};

function fmtDate(d: string): string {
  const date = new Date(d + 'T12:00:00');
  return date.toLocaleDateString('es-CL', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function TriggersView({ triggers, prospects, onOpenProspect, onTriggersChanged }: Props) {
  const [statusFilter, setStatusFilter] = useState('Open');

  const prospectMap = Object.fromEntries(prospects.map(p => [p.id, p]));

  const filtered = triggers
    .filter(t => statusFilter === 'Todos' ? true : t.status === statusFilter)
    .sort((a, b) => b.date_detected.localeCompare(a.date_detected));

  async function cycleStatus(trigger: CrmTrigger) {
    const order: ('Open' | 'Monitoring' | 'Closed')[] = ['Open', 'Monitoring', 'Closed'];
    const next = order[(order.indexOf(trigger.status as 'Open' | 'Monitoring' | 'Closed') + 1) % 3];
    await updateCrmTrigger(trigger.id, { status: next });
    onTriggersChanged();
  }

  const openCount = triggers.filter(t => t.status === 'Open').length;
  const monitorCount = triggers.filter(t => t.status === 'Monitoring').length;

  return (
    <div className="p-6 max-w-[900px]">
      <div className="mb-4">
        <h1 className="text-[22px] font-bold tracking-tight" style={{ color: 'var(--ink)' }}>Triggers</h1>
        <p className="text-[13px] mt-1" style={{ color: 'var(--ink-3)' }}>
          {openCount} abiertos · {monitorCount} en seguimiento · {triggers.length} total
        </p>
      </div>

      <div className="flex gap-[3px] mb-5">
        {['Open', 'Monitoring', 'Closed', 'Todos'].map(tab => (
          <button
            key={tab}
            onClick={() => setStatusFilter(tab)}
            className="h-7 px-3 rounded-[6px] text-[12px] border-0 transition-colors"
            style={{
              background: statusFilter === tab ? 'var(--accent)' : 'var(--bg-3)',
              color: statusFilter === tab ? 'var(--on-accent)' : 'var(--ink-2)',
              fontWeight: statusFilter === tab ? 600 : 400,
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-3">
        {filtered.length === 0 && (
          <div className="text-center py-10 text-[13px]" style={{ color: 'var(--ink-4)' }}>
            Sin triggers en esta categoría
          </div>
        )}
        {filtered.map(trigger => {
          const prospect = prospectMap[trigger.prospect_id];
          const sc = STATUS_STYLE[trigger.status] ?? STATUS_STYLE['Open'];
          const icon = TRIGGER_ICONS[trigger.trigger_type ?? ''] ?? '⚡';

          return (
            <div
              key={trigger.id}
              className="rounded-[12px] p-4"
              style={{ background: 'var(--surface)', border: '1px solid var(--line)', boxShadow: 'var(--shadow-1)' }}
            >
              <div className="flex items-start gap-3">
                <span className="text-[22px] mt-[-2px] flex-shrink-0">{icon}</span>

                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[14px] font-semibold" style={{ color: 'var(--ink)' }}>
                        {trigger.trigger_type ?? 'Trigger'}
                      </span>
                      {prospect && (
                        <button
                          onClick={() => onOpenProspect(prospect)}
                          className="text-[12px] px-2 py-[1px] rounded-[4px] border-0 font-medium"
                          style={{ background: 'var(--bg-3)', color: 'var(--accent)' }}
                        >
                          {prospect.company}
                        </button>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-[11px]" style={{ color: 'var(--ink-4)' }}>{fmtDate(trigger.date_detected)}</span>
                      <button
                        onClick={() => cycleStatus(trigger)}
                        className="text-[11px] px-[8px] py-[3px] rounded-full font-medium border-0 cursor-pointer transition-opacity hover:opacity-80"
                        style={{ background: sc.bg, color: sc.fg }}
                        title="Clic para cambiar estado"
                      >
                        {trigger.status}
                      </button>
                    </div>
                  </div>

                  {trigger.description && (
                    <p className="text-[13px] mb-2" style={{ color: 'var(--ink-2)' }}>{trigger.description}</p>
                  )}

                  <div className="flex items-center gap-4 flex-wrap">
                    {trigger.action_suggested && (
                      <div className="flex items-center gap-1 text-[12px]" style={{ color: 'var(--ink-3)' }}>
                        <span>💡</span>
                        <span>{trigger.action_suggested}</span>
                      </div>
                    )}
                    {trigger.source_url && (
                      <a
                        href={trigger.source_url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-[12px]"
                        style={{ color: 'var(--accent)' }}
                      >
                        <ExternalLink size={11} />
                        Ver fuente
                      </a>
                    )}
                    {trigger.priority && trigger.priority !== 'Medium' && (
                      <span
                        className="text-[10px] px-[6px] py-[2px] rounded-full"
                        style={{
                          background: trigger.priority === 'High' ? 'oklch(0.95 0.06 25)' : 'oklch(0.95 0.05 245)',
                          color: trigger.priority === 'High' ? 'oklch(0.45 0.18 25)' : 'oklch(0.40 0.14 245)',
                        }}
                      >
                        {trigger.priority}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
