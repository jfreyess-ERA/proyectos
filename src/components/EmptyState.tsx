'use client';
import type { ReactNode } from 'react';

interface Props {
  /** Ícono lucide (elemento), p. ej. <Inbox size={26} />. */
  icon?: ReactNode;
  title: string;
  /** Ayuda breve: qué es esto / qué hacer ahora. */
  hint?: string;
  /** CTA opcional. */
  action?: { label: string; onClick: () => void };
  /** Menos padding para usarlo dentro de una celda de tabla. */
  compact?: boolean;
}

/**
 * Estado vacío unificado. Un vacío no es una disculpa: dice qué es la vista y qué
 * hacer ahora. Distinguir "vacío por filtro" de "vacío inicial" es responsabilidad
 * de quien lo usa (elige el título/hint correcto).
 */
export function EmptyState({ icon, title, hint, action, compact }: Props) {
  return (
    <div className={`flex flex-col items-center text-center ${compact ? 'py-8' : 'py-16'}`}>
      {icon && (
        <div className="mb-2" style={{ color: 'var(--ink-4)' }}>{icon}</div>
      )}
      <div className="text-[14px] font-medium" style={{ color: 'var(--ink-2)' }}>{title}</div>
      {hint && (
        <div className="text-[12px] mt-1 max-w-[360px]" style={{ color: 'var(--ink-4)' }}>{hint}</div>
      )}
      {action && (
        <button
          onClick={action.onClick}
          className="mt-3 h-8 px-3 rounded-[6px] text-[12px] font-medium border-0 transition-colors"
          style={{ background: 'var(--accent)', color: 'var(--on-accent)' }}
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
