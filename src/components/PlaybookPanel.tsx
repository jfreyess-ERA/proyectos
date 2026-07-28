'use client';
import { useState } from 'react';
import { ChevronDown, ChevronRight, CornerDownRight, Flag, CheckCircle2 } from 'lucide-react';
import { RESPONSE_LABELS, INITIAL_RESPONSES } from '@/lib/types';
import type { Prospect, PlaybookNode, PlaybookEdge, ResponseType } from '@/lib/types';

/**
 * Resuelve qué respuestas puede registrar el usuario ahora mismo.
 * Las del nodo actual son las del guion; las iniciales quedan siempre disponibles
 * porque el cliente puede salirse del guion (el motor arranca esa rama de cero).
 */
export function validResponses(
  prospect: Prospect | null,
  edges: PlaybookEdge[],
): { contextual: { response: ResponseType; to: string }[]; initial: ResponseType[] } {
  const from = prospect?.playbook_node ?? '_root';
  const contextual = edges
    .filter(e => e.from_node === from)
    .sort((a, b) => a.sort_order - b.sort_order)
    .map(e => ({ response: e.response, to: e.to_node }));
  const taken = new Set(contextual.map(c => c.response));
  return { contextual, initial: INITIAL_RESPONSES.filter(r => !taken.has(r)) };
}

interface Props {
  prospect: Prospect;
  nodes: PlaybookNode[];
  edges: PlaybookEdge[];
}

export function PlaybookPanel({ prospect, nodes, edges }: Props) {
  const [expanded, setExpanded] = useState(false);

  const current = prospect.playbook_node
    ? nodes.find(n => n.node_key === prospect.playbook_node)
    : undefined;

  // Sin cadencia activa: mostramos el arranque disponible en vez de un panel vacío.
  if (!current) {
    return (
      <Card>
        <div className="flex items-center gap-2 mb-1">
          <Flag size={13} style={{ color: 'var(--ink-4)' }} />
          <span className="text-[12px] font-semibold" style={{ color: 'var(--ink-2)' }}>Cadencia</span>
        </div>
        <p className="text-[12px]" style={{ color: 'var(--ink-3)' }}>
          Sin cadencia activa. Registrá una interacción con tipo de respuesta para arrancar el seguimiento.
        </p>
      </Card>
    );
  }

  const branchNodes = nodes
    .filter(n => n.branch === current.branch)
    .sort((a, b) => a.position - b.position);
  const total = branchNodes.length;
  const next = validResponses(prospect, edges).contextual;
  const nodeByKey = new Map(nodes.map(n => [n.node_key, n]));

  return (
    <Card>
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <Flag size={13} style={{ color: 'var(--accent)' }} />
          <span className="text-[12px] font-semibold" style={{ color: 'var(--ink-2)' }}>Cadencia</span>
          <span className="text-[11px] px-[7px] py-px rounded-full" style={{ background: 'var(--bg-3)', color: 'var(--ink-4)' }}>
            {RESPONSE_LABELS[current.branch]}
          </span>
        </div>
        <span className="text-[11px] tabular-nums flex-shrink-0" style={{ color: 'var(--ink-4)' }}>
          paso {current.position} de {total}
        </span>
      </div>

      {/* Estado actual */}
      <div className="flex items-start gap-2 mb-2">
        {current.is_terminal
          ? <CheckCircle2 size={14} className="flex-shrink-0 mt-px" style={{ color: 'var(--ok, oklch(0.60 0.14 160))' }} />
          : <CornerDownRight size={14} className="flex-shrink-0 mt-px" style={{ color: 'var(--accent)' }} />}
        <div className="min-w-0">
          <div className="text-[13px] font-medium" style={{ color: 'var(--ink)' }}>{current.label}</div>
          {current.alert_label && (
            <div className="text-[11px] mt-px" style={{ color: 'var(--danger)' }}>⚠ {current.alert_label}</div>
          )}
          <div className="text-[11.5px] mt-1 flex flex-col gap-px" style={{ color: 'var(--ink-3)' }}>
            {current.tasks.map((t, i) => (
              <span key={i}>· {t.detail}</span>
            ))}
          </div>
        </div>
      </div>

      {/* A dónde lleva cada respuesta posible */}
      {current.is_terminal ? (
        <div className="text-[11.5px] pt-2" style={{ color: 'var(--ink-3)', borderTop: '1px solid var(--line)' }}>
          Fin de la rama. La próxima respuesta que registres arranca una cadencia nueva.
        </div>
      ) : next.length > 0 && (
        <div className="pt-2" style={{ borderTop: '1px solid var(--line)' }}>
          <div className="text-[11px] font-medium mb-1" style={{ color: 'var(--ink-4)' }}>Según lo que responda:</div>
          <div className="flex flex-col gap-px">
            {next.map(({ response, to }) => (
              <div key={response} className="text-[11.5px] flex items-center gap-1.5 min-w-0">
                <span className="font-medium flex-shrink-0" style={{ color: 'var(--ink-2)' }}>
                  {RESPONSE_LABELS[response]}
                </span>
                <span style={{ color: 'var(--ink-4)' }}>→</span>
                <span className="truncate" style={{ color: 'var(--ink-3)' }}>
                  {nodeByKey.get(to)?.label ?? to}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Mapa completo de la rama */}
      <button
        onClick={() => setExpanded(e => !e)}
        className="mt-2 flex items-center gap-1 text-[11px] border-0 bg-transparent p-0"
        style={{ color: 'var(--ink-4)' }}
      >
        {expanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
        {expanded ? 'Ocultar' : 'Ver'} la rama completa
      </button>

      {expanded && (
        <div className="mt-2 flex flex-col gap-1">
          {branchNodes.map(n => {
            const isCurrent = n.node_key === current.node_key;
            return (
              <div
                key={n.node_key}
                className="flex items-start gap-2 rounded-[6px] px-2 py-1"
                style={{ background: isCurrent ? 'var(--accent-bg)' : 'transparent' }}
              >
                <span
                  className="text-[10px] tabular-nums w-[14px] flex-shrink-0 text-right mt-px"
                  style={{ color: isCurrent ? 'var(--accent)' : 'var(--ink-4)' }}
                >
                  {n.position}
                </span>
                <div className="min-w-0">
                  <div className="text-[11.5px] font-medium" style={{ color: isCurrent ? 'var(--accent)' : 'var(--ink-2)' }}>
                    {n.label}
                    {n.is_terminal && <span className="ml-1 font-normal" style={{ color: 'var(--ink-4)' }}>· fin</span>}
                  </div>
                  <div className="text-[11px]" style={{ color: 'var(--ink-4)' }}>
                    {n.tasks.map(t => t.detail).join(' · ')}
                    {n.alert_label && ` — ⚠ ${n.alert_label}`}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="rounded-[9px] p-3"
      style={{ background: 'var(--bg-2)', border: '1px solid var(--line)' }}
    >
      {children}
    </div>
  );
}
