'use client';
import { useState, Fragment } from 'react';
import { Search, MessageSquare } from 'lucide-react';
import { EmptyState } from './EmptyState';
import { channelEs, outcomeEs } from '@/lib/crm-labels';
import type { CrmInteraction, Prospect, InteractionChannel, InteractionOutcome } from '@/lib/types';

interface Props {
  interactions: CrmInteraction[];
  prospects: Prospect[];
  onOpenProspect: (p: Prospect) => void;
}

const CHANNELS: (InteractionChannel | 'Todos')[] = ['Todos', 'Email', 'LinkedIn', 'Phone', 'WhatsApp', 'Meeting', 'Event', 'Referral'];
const OUTCOMES: (InteractionOutcome | 'Todos')[] = ['Todos', 'No response', 'Positive', 'Interested', 'Meeting booked', 'Not now', 'Lost'];

const CHANNEL_EMOJI: Record<string, string> = {
  Email: '📧', LinkedIn: '💼', Phone: '📞', WhatsApp: '💬',
  Meeting: '🤝', Event: '🎪', Referral: '👥',
};

const OUTCOME_STYLE: Record<string, { bg: string; fg: string }> = {
  'Positive':       { bg: 'oklch(0.95 0.06 160)', fg: 'oklch(0.38 0.12 160)' },
  'Interested':     { bg: 'oklch(0.95 0.06 160)', fg: 'oklch(0.38 0.12 160)' },
  'Meeting booked': { bg: 'oklch(0.93 0.08 160)', fg: 'oklch(0.32 0.14 160)' },
  'Not now':        { bg: 'oklch(0.95 0.04 85)',  fg: 'oklch(0.42 0.08 85)'  },
  'No response':    { bg: 'oklch(0.94 0.01 0)',   fg: 'oklch(0.50 0.01 0)'   },
  'Lost':           { bg: 'oklch(0.95 0.06 25)',  fg: 'oklch(0.45 0.18 25)'  },
};

function fmtDate(d: string): string {
  const date = new Date(d + 'T12:00:00');
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const diff = Math.round((date.getTime() - today.getTime()) / 86400000);
  if (diff === 0) return 'Hoy';
  if (diff === -1) return 'Ayer';
  if (diff > -7 && diff < 0) return `Hace ${-diff}d`;
  return date.toLocaleDateString('es-CL', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function InteractionsView({ interactions, prospects, onOpenProspect }: Props) {
  const [search, setSearch]         = useState('');
  const [channelF, setChannelF]     = useState<string>('Todos');
  const [outcomeF, setOutcomeF]     = useState<string>('Todos');
  const [expanded, setExpanded]     = useState<string | null>(null);

  const prospectMap = Object.fromEntries(prospects.map(p => [p.id, p]));

  const filtered = interactions
    .filter(i => {
      if (channelF !== 'Todos' && i.channel !== channelF) return false;
      if (outcomeF !== 'Todos' && i.outcome !== outcomeF) return false;
      if (search) {
        const q = search.toLowerCase();
        const p = prospectMap[i.prospect_id];
        return (
          (p?.company ?? '').toLowerCase().includes(q) ||
          (p?.contact_name ?? '').toLowerCase().includes(q) ||
          (i.summary ?? '').toLowerCase().includes(q) ||
          (i.type ?? '').toLowerCase().includes(q)
        );
      }
      return true;
    })
    .sort((a, b) => b.date.localeCompare(a.date));

  // This-month count
  const thisMonth = new Date().toISOString().slice(0, 7);
  const thisMonthCount = interactions.filter(i => i.date.startsWith(thisMonth)).length;

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-6 py-3 border-b flex-shrink-0 flex-wrap" style={{ borderColor: 'var(--line)' }}>
        <div>
          <h1 className="text-[18px] font-bold leading-tight" style={{ color: 'var(--ink)' }}>Interacciones</h1>
          <p className="text-[12px]" style={{ color: 'var(--ink-4)' }}>
            {interactions.length} total · {thisMonthCount} este mes
          </p>
        </div>

        <div className="relative ml-4">
          <Search size={13} className="absolute left-[8px] top-1/2 -translate-y-1/2" style={{ color: 'var(--ink-4)' }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar empresa, contacto, resumen…"
            className="h-8 pl-7 pr-3 rounded-[7px] text-[13px] outline-none"
            style={{ width: 260, border: '1px solid var(--line)', background: 'var(--surface-2)', color: 'var(--ink)', fontFamily: 'var(--font)' }}
          />
        </div>

        <div className="flex gap-[3px] flex-wrap">
          {CHANNELS.map(ch => (
            <button key={ch} onClick={() => setChannelF(ch)}
              className="h-7 px-2 rounded-[6px] text-[11.5px] border-0 transition-colors"
              style={{ background: channelF === ch ? 'var(--accent)' : 'var(--bg-3)', color: channelF === ch ? 'var(--on-accent)' : 'var(--ink-2)', fontWeight: channelF === ch ? 600 : 400 }}>
              {ch === 'Todos' ? ch : `${CHANNEL_EMOJI[ch]} ${channelEs(ch)}`}
            </button>
          ))}
        </div>

        <div className="flex gap-[3px] flex-wrap">
          {OUTCOMES.map(o => (
            <button key={o} onClick={() => setOutcomeF(o)}
              className="h-7 px-2 rounded-[6px] text-[11.5px] border-0 transition-colors"
              style={{ background: outcomeF === o ? 'var(--accent)' : 'var(--bg-3)', color: outcomeF === o ? 'var(--on-accent)' : 'var(--ink-2)', fontWeight: outcomeF === o ? 600 : 400 }}>
              {o === 'Todos' ? o : outcomeEs(o)}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full border-collapse" style={{ fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--line)', background: 'var(--bg-2)', position: 'sticky', top: 0, zIndex: 1 }}>
              {['Fecha', 'Empresa', 'Canal', 'Tipo', 'Outcome', 'Resumen', 'Follow-up'].map(h => (
                <th key={h} className="text-left px-4 py-[8px] text-[11px] font-semibold tracking-wide uppercase whitespace-nowrap" style={{ color: 'var(--ink-4)', background: 'var(--bg-2)' }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr key="empty"><td colSpan={7}>
                {interactions.length === 0 ? (
                  <EmptyState
                    icon={<MessageSquare size={24} />}
                    title="Todavía no hay interacciones"
                    hint="Cada llamada, correo o reunión que registres en un prospecto aparece acá."
                    compact
                  />
                ) : (
                  <EmptyState
                    icon={<Search size={24} />}
                    title="Sin resultados"
                    hint="Ninguna interacción coincide con la búsqueda o los filtros."
                    compact
                  />
                )}
              </td></tr>
            )}
            {filtered.map(i => {
              const prospect = prospectMap[i.prospect_id];
              const os = i.outcome ? OUTCOME_STYLE[i.outcome] : null;
              const isExpanded = expanded === i.id;
              return (
                <Fragment key={i.id}>
                  <tr
                    onClick={() => setExpanded(isExpanded ? null : i.id)}
                    className="cursor-pointer transition-colors"
                    style={{ borderBottom: '1px solid var(--line)', background: isExpanded ? 'var(--bg-2)' : '' }}
                    onMouseEnter={e => { if (!isExpanded) e.currentTarget.style.background = 'var(--bg-2)'; }}
                    onMouseLeave={e => { if (!isExpanded) e.currentTarget.style.background = ''; }}
                  >
                    <td className="px-4 py-[9px] whitespace-nowrap text-[12px]" style={{ color: 'var(--ink-3)' }}>
                      {fmtDate(i.date)}
                    </td>
                    <td className="px-4 py-[9px]">
                      {prospect ? (
                        <button
                          onClick={e => { e.stopPropagation(); onOpenProspect(prospect); }}
                          className="font-semibold text-left border-0 bg-transparent transition-colors"
                          style={{ color: 'var(--accent)' }}
                        >
                          {prospect.company}
                        </button>
                      ) : <span style={{ color: 'var(--ink-4)' }}>—</span>}
                    </td>
                    <td className="px-4 py-[9px] whitespace-nowrap">
                      {i.channel ? (
                        <span>{CHANNEL_EMOJI[i.channel] ?? '📋'} <span style={{ color: 'var(--ink-2)' }}>{channelEs(i.channel)}</span></span>
                      ) : <span style={{ color: 'var(--ink-4)' }}>—</span>}
                    </td>
                    <td className="px-4 py-[9px]" style={{ color: 'var(--ink-2)' }}>
                      {i.type ?? '—'}
                    </td>
                    <td className="px-4 py-[9px]">
                      {i.outcome && os ? (
                        <span className="inline-block text-[11px] font-medium px-[7px] py-[2px] rounded-full whitespace-nowrap"
                          style={{ background: os.bg, color: os.fg }}>
                          {outcomeEs(i.outcome)}
                        </span>
                      ) : <span style={{ color: 'var(--ink-4)' }}>—</span>}
                    </td>
                    <td className="px-4 py-[9px] max-w-[200px]">
                      <span className="text-[12.5px] block truncate" style={{ color: 'var(--ink-3)' }}>
                        {i.summary ?? '—'}
                      </span>
                    </td>
                    <td className="px-4 py-[9px] whitespace-nowrap text-[12px]" style={{ color: i.follow_up_due && i.follow_up_due < new Date().toISOString().slice(0, 10) ? 'oklch(0.55 0.18 25)' : 'var(--ink-3)' }}>
                      {i.follow_up_due ? fmtDate(i.follow_up_due) : '—'}
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr style={{ borderBottom: '1px solid var(--line)', background: 'var(--bg-2)' }}>
                      <td colSpan={7} className="px-6 py-3">
                        <div className="flex gap-8 text-[12.5px]">
                          {i.summary && (
                            <div className="flex-1"><span style={{ color: 'var(--ink-4)' }}>Resumen: </span><span style={{ color: 'var(--ink)' }}>{i.summary}</span></div>
                          )}
                          {i.next_step && (
                            <div><span style={{ color: 'var(--ink-4)' }}>Próximo paso: </span><span style={{ color: 'var(--ink)' }}>{i.next_step}</span></div>
                          )}
                          {i.direction && (
                            <div><span style={{ color: 'var(--ink-4)' }}>Dirección: </span><span style={{ color: 'var(--ink)' }}>{i.direction}</span></div>
                          )}
                          {i.template_used && (
                            <div><span style={{ color: 'var(--ink-4)' }}>Plantilla: </span><span style={{ color: 'var(--ink)' }}>{i.template_used}</span></div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
