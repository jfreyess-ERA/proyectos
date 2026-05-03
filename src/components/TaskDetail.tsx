'use client';
import { useState } from 'react';
import { X, Paperclip, Archive, MoreHorizontal, Plus } from 'lucide-react';
import {
  getProject, getLabel, getUser, getPriority, getStatus,
  fmtDate, PEOPLE, STATUSES, PRIORITIES,
} from '@/lib/data';
import { Avatar } from './Avatar';
import type { Task } from '@/lib/types';

interface Props {
  task: Task | null;
  onClose: () => void;
}

const SAMPLE_SUBTASK_TITLES = [
  'Revisar feedback de Ana',
  'Actualizar variantes en Figma',
  'Conectar con datos reales del API',
  'Preparar deck de revisión',
  'Test con 3 usuarios internos',
  'Ajustes finales de copy',
];

export function TaskDetail({ task, onClose }: Props) {
  const [comment, setComment] = useState('');

  if (!task) return null;

  const project = getProject(task.project);
  const labels = task.labels.map(id => getLabel(id)).filter(Boolean);
  const priority = getPriority(task.priority);
  const status = getStatus(task.status);
  const me = PEOPLE[0];
  const spentPct = Math.min(100, (task.spent / task.estimate) * 100);
  const overBudget = task.spent > task.estimate;

  const priorityColors: Record<string, string> = {
    urgent: 'oklch(0.58 0.18 25)',
    high:   'oklch(0.65 0.14 50)',
    med:    'oklch(0.62 0.05 250)',
    low:    'oklch(0.62 0.02 250)',
  };

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center"
      style={{ background: 'rgba(20,18,12,.32)', backdropFilter: 'blur(2px)' }}
      onClick={onClose}
    >
      <div
        className="flex flex-col overflow-hidden"
        style={{
          width: 'min(880px, 92vw)',
          maxHeight: '88vh',
          background: 'var(--surface)',
          border: '1px solid var(--line)',
          borderRadius: 14,
          boxShadow: 'var(--shadow-pop)',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Modal header */}
        <div
          className="flex items-center justify-between px-5 py-3 border-b flex-shrink-0"
          style={{ borderColor: 'var(--line)' }}
        >
          <div className="flex items-center gap-[10px]">
            <span className="w-2 h-2 rounded-[2px]" style={{ background: project?.color }} />
            <span className="text-[12.5px]" style={{ color: 'var(--ink-3)' }}>
              {project?.name} · {task.ref}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <IconBtn><Paperclip size={15} /></IconBtn>
            <IconBtn><Archive size={15} /></IconBtn>
            <IconBtn><MoreHorizontal size={15} /></IconBtn>
            <IconBtn onClick={onClose}><X size={15} /></IconBtn>
          </div>
        </div>

        {/* Body */}
        <div className="flex flex-1 min-h-0 overflow-hidden">
          {/* Main (left 60%) */}
          <div className="flex-1 min-w-0 overflow-y-auto p-6 flex flex-col gap-6">
            <h2
              className="text-[20px] font-semibold leading-tight tracking-tight"
              style={{ color: 'var(--ink)' }}
            >
              {task.title}
            </h2>

            {/* Description */}
            <Section title="Descripción">
              <p className="text-[13.5px] leading-relaxed" style={{ color: 'var(--ink-2)' }}>
                Trabajamos sobre la versión actualizada del componente, integrando los hallazgos del
                último round de research. La métrica principal pasa al cuadrante superior izquierdo
                y los KPIs secundarios se agrupan en una fila horizontal compacta.
              </p>
              <ul className="list-disc list-inside mt-2 flex flex-col gap-1">
                {[
                  'Considerar variante con tarjetas vs. tabla para movimientos.',
                  'Validar accesibilidad con lector de pantalla.',
                  'Documentar tokens nuevos en el sistema.',
                ].map((item, i) => (
                  <li key={i} className="text-[13px]" style={{ color: 'var(--ink-2)' }}>{item}</li>
                ))}
              </ul>
            </Section>

            {/* Subtasks */}
            <Section
              title="Subtareas"
              right={
                <span className="text-[11px]" style={{ color: 'var(--ink-3)' }}>
                  {task.subtasks.done}/{task.subtasks.total}
                </span>
              }
            >
              <div className="flex flex-col gap-[6px]">
                {Array.from({ length: task.subtasks.total }).map((_, i) => {
                  const done = i < task.subtasks.done;
                  return (
                    <div key={i} className="flex items-center gap-3">
                      <span
                        className="w-4 h-4 rounded-[4px] border flex items-center justify-center flex-shrink-0 text-[10px]"
                        style={{
                          background: done ? 'var(--accent)' : 'transparent',
                          borderColor: done ? 'var(--accent)' : 'var(--line)',
                          color: 'white',
                        }}
                      >
                        {done && '✓'}
                      </span>
                      <span
                        className="text-[13px]"
                        style={{
                          color: done ? 'var(--ink-3)' : 'var(--ink)',
                          textDecoration: done ? 'line-through' : 'none',
                        }}
                      >
                        {SAMPLE_SUBTASK_TITLES[i] ?? `Subtarea ${i + 1}`}
                      </span>
                    </div>
                  );
                })}
                <button
                  className="flex items-center gap-1 text-[12px] border-0 bg-transparent mt-1"
                  style={{ color: 'var(--ink-4)' }}
                >
                  <Plus size={12} /> Agregar subtarea
                </button>
              </div>
            </Section>

            {/* Comments */}
            <Section title="Comentarios">
              <div className="flex flex-col gap-4">
                <div
                  className="text-[12px] py-2"
                  style={{ color: 'var(--ink-4)' }}
                >
                  Aún no hay comentarios. Sé el primero en aportar contexto.
                </div>

                {/* Comment input */}
                <div className="flex gap-3">
                  <Avatar userId={me.id} size="md" />
                  <div
                    className="flex-1 rounded-[8px] border overflow-hidden"
                    style={{ borderColor: 'var(--line)', background: 'var(--surface-2)' }}
                  >
                    <textarea
                      value={comment}
                      onChange={e => setComment(e.target.value)}
                      placeholder="Escribe un comentario… usa @ para mencionar"
                      rows={2}
                      className="w-full px-3 pt-2 text-[13px] resize-none border-0 bg-transparent outline-none"
                      style={{ color: 'var(--ink)', fontFamily: 'var(--font)' }}
                    />
                    <div
                      className="flex items-center justify-between px-2 py-[6px] border-t"
                      style={{ borderColor: 'var(--line-2)' }}
                    >
                      <div className="flex gap-[2px]">
                        <IconBtn><Paperclip size={13} /></IconBtn>
                        <button
                          className="w-6 h-6 flex items-center justify-center rounded-[5px] border-0 bg-transparent text-[12px] font-bold"
                          style={{ color: 'var(--ink-3)' }}
                        >
                          @
                        </button>
                      </div>
                      <button
                        className="h-[26px] px-3 rounded-[6px] text-[12px] font-medium border-0"
                        style={{
                          background: 'var(--accent)',
                          color: 'var(--on-accent)',
                          opacity: comment.trim() ? 1 : 0.5,
                        }}
                        disabled={!comment.trim()}
                      >
                        Comentar
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </Section>
          </div>

          {/* Sidebar (right 40%) */}
          <aside
            className="w-[280px] flex-shrink-0 border-l overflow-y-auto p-5 flex flex-col gap-4"
            style={{ borderColor: 'var(--line)', background: 'var(--surface-2)' }}
          >
            <Field label="Estado">
              <span
                className="inline-flex items-center gap-[6px] h-[22px] px-2 rounded-[5px] text-[11.5px] font-medium border"
                style={{ background: 'var(--bg-2)', borderColor: 'var(--line)', color: 'var(--ink-2)' }}
              >
                <span className="w-[7px] h-[7px] rounded-full" style={{ background: STATUSES.find(s => s.id === task.status)?.tone }} />
                {status?.label}
              </span>
            </Field>

            <Field label="Prioridad">
              <div className="flex items-center gap-[6px] text-[13px]" style={{ color: 'var(--ink)' }}>
                <span className="w-2 h-2 rounded-full" style={{ background: priorityColors[task.priority] }} />
                {priority?.label}
              </div>
            </Field>

            <Field label="Asignado">
              <div className="flex flex-wrap gap-2">
                {task.assignees.length > 0 ? task.assignees.map(id => {
                  const u = getUser(id);
                  return u ? (
                    <div key={id} className="flex items-center gap-[6px]">
                      <Avatar userId={id} size="sm" />
                      <span className="text-[12px]" style={{ color: 'var(--ink)' }}>
                        {u.name.split(' ')[0]}
                      </span>
                    </div>
                  ) : null;
                }) : (
                  <span className="text-[12px]" style={{ color: 'var(--ink-4)' }}>Sin asignar</span>
                )}
              </div>
            </Field>

            <Field label="Fechas">
              <span className="text-[12px]" style={{ color: 'var(--ink-2)' }}>
                {fmtDate(task.start)} → {fmtDate(task.due)}
              </span>
            </Field>

            <Field label="Estimado">
              <span className="text-[12px]" style={{ color: 'var(--ink-2)' }}>
                <strong style={{ color: 'var(--ink)' }}>{task.spent}h</strong> de {task.estimate}h
              </span>
              <div
                className="h-[4px] rounded-full overflow-hidden mt-1"
                style={{ background: 'var(--bg-3)' }}
              >
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${spentPct}%`,
                    background: overBudget ? 'var(--danger)' : 'var(--accent)',
                  }}
                />
              </div>
            </Field>

            <Field label="Etiquetas">
              <div className="flex flex-wrap gap-[6px]">
                {labels.map(l => l && (
                  <span
                    key={l.id}
                    className="inline-flex items-center h-5 px-2 rounded-[4px] text-[11px] font-medium"
                    style={{ background: l.bg, color: l.fg }}
                  >
                    {l.text}
                  </span>
                ))}
                <button
                  className="inline-flex items-center h-5 px-2 rounded-[4px] text-[11px] border-0 bg-transparent"
                  style={{ color: 'var(--ink-4)' }}
                >
                  + Etiqueta
                </button>
              </div>
            </Field>

            <Field label="Dependencias">
              <span className="text-[12px]" style={{ color: 'var(--ink-4)' }}>Ninguna</span>
            </Field>

            <hr style={{ border: 0, borderTop: '1px solid var(--line)', margin: '4px 0' }} />

            <div className="text-[11px]" style={{ color: 'var(--ink-4)' }}>
              Creado por {getUser('u1')?.name.split(' ')[0]} · {fmtDate(task.start)}
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

/* ── Helpers ─────────────────────────────────────────────────── */

function IconBtn({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-8 h-8 flex items-center justify-center rounded-[7px] border-0 bg-transparent transition-colors"
      style={{ color: 'var(--ink-2)' }}
    >
      {children}
    </button>
  );
}

function Section({
  title,
  right,
  children,
}: {
  title: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h4 className="text-[13px] font-semibold" style={{ color: 'var(--ink)' }}>{title}</h4>
        {right}
      </div>
      {children}
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-[6px]">
      <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--ink-4)' }}>
        {label}
      </span>
      <div>{children}</div>
    </div>
  );
}
