'use client';
import { useState, useEffect } from 'react';
import { X, Trash2, CornerDownRight, ExternalLink, Check } from 'lucide-react';
import { toggleSubtask, updateSubtask, deleteSubtask } from '@/lib/db';
import { useToast } from '@/lib/toast-context';
import { shortName } from '@/lib/data';
import type { SubtaskLite, Task, Project, User } from '@/lib/types';

interface Props {
  subtask: SubtaskLite | null;
  /** Tarea padre — da el contexto (cliente · proyecto) y el link para abrirla. */
  task: Task | null;
  project?: Project;
  users: User[];
  onClose: () => void;
  /** Refresca los datos de la app tras un cambio. */
  onChanged: () => void;
  onOpenParent: (task: Task) => void;
}

/**
 * Panel de una subtarea, para poder gestionarla desde el calendario sin tener
 * que abrir la tarea padre y buscarla en su lista. Da el mismo control que una
 * tarea (estado, fecha, responsable, título, borrado); lo único que la
 * distingue es que siempre cuelga de una tarea, que queda visible arriba y a
 * un clic de distancia.
 */
export function SubtaskDetail({ subtask, task, project, users, onClose, onChanged, onOpenParent }: Props) {
  const { deleteWithUndo } = useToast();
  const [draft, setDraft] = useState<SubtaskLite | null>(subtask);
  const [savingTitle, setSavingTitle] = useState(false);

  useEffect(() => { setDraft(subtask); }, [subtask]); // eslint-disable-line react-hooks/set-state-in-effect

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    if (subtask) window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [subtask, onClose]);

  if (!subtask || !draft || !task) return null;

  async function patch(fields: Partial<{ title: string; due_date: string | null; assignee: string | null }>) {
    if (!draft || !task) return;
    setDraft({ ...draft, ...fields });
    await updateSubtask(draft.id, task.id, fields);
    onChanged();
  }

  async function toggleDone() {
    if (!draft || !task) return;
    const next = !draft.done;
    setDraft({ ...draft, done: next });
    await toggleSubtask(draft.id, next, task.id);
    onChanged();
  }

  function handleDelete() {
    if (!draft || !task) return;
    const id = draft.id, taskId = task.id;
    onClose();
    deleteWithUndo({
      message: `Subtarea "${draft.title}" eliminada`,
      onCommit: () => { deleteSubtask(id, taskId).then(onChanged).catch(console.error); },
      onUndo: onChanged,
    });
  }

  const inputStyle = {
    border: '1px solid var(--line)',
    background: 'var(--bg-2)',
    color: 'var(--ink)',
    fontFamily: 'var(--font)',
  };

  const todayISO = new Date().toISOString().slice(0, 10);
  const isOverdue = !draft.done && !!draft.due_date && draft.due_date < todayISO;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      style={{ background: 'rgba(20,18,12,.35)', backdropFilter: 'blur(2px)' }}
      onClick={onClose}
    >
      <div
        className="flex flex-col overflow-hidden w-full"
        style={{
          maxWidth: 520, background: 'var(--surface)', border: '1px solid var(--line)',
          borderRadius: 14, boxShadow: 'var(--shadow-pop)',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header: de qué tarea cuelga */}
        <div className="flex items-center justify-between px-5 py-3 border-b flex-shrink-0" style={{ borderColor: 'var(--line)' }}>
          <div className="flex items-center gap-2 min-w-0">
            <CornerDownRight size={13} className="flex-shrink-0" style={{ color: 'var(--ink-4)' }} />
            <span className="text-[12px] flex-shrink-0" style={{ color: 'var(--ink-4)' }}>Subtarea de</span>
            <button
              onClick={() => { onClose(); onOpenParent(task); }}
              className="flex items-center gap-1 min-w-0 text-[12px] font-medium border-0 bg-transparent truncate"
              style={{ color: 'var(--accent)' }}
              title={`Abrir ${task.title}`}
            >
              <span className="truncate">{task.title}</span>
              <ExternalLink size={11} className="flex-shrink-0" />
            </button>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-[6px] border-0 bg-transparent flex-shrink-0"
            style={{ color: 'var(--ink-3)' }}
            aria-label="Cerrar"
          >
            <X size={15} />
          </button>
        </div>

        <div className="flex flex-col gap-4 p-5">
          {project && (
            <div className="flex items-center gap-2 text-[12px] -mb-1" style={{ color: 'var(--ink-4)' }}>
              <span className="w-[8px] h-[8px] rounded-[2px] flex-shrink-0" style={{ background: project.color }} />
              {project.client && `${project.client} · `}{project.name}
            </div>
          )}

          {/* Título + estado */}
          <div className="flex items-start gap-3">
            <button
              onClick={toggleDone}
              className="w-5 h-5 rounded-[4px] border flex items-center justify-center flex-shrink-0 mt-[3px]"
              style={{
                borderColor: draft.done ? 'var(--sem-green)' : 'var(--line)',
                background: draft.done ? 'var(--sem-green)' : 'transparent',
                color: 'white',
              }}
              aria-label={draft.done ? 'Marcar como pendiente' : 'Marcar como hecha'}
            >
              {draft.done && <Check size={13} />}
            </button>
            <input
              value={draft.title}
              onChange={e => setDraft({ ...draft, title: e.target.value })}
              onBlur={e => { if (e.target.value.trim() && e.target.value !== subtask.title) { setSavingTitle(true); patch({ title: e.target.value.trim() }).finally(() => setSavingTitle(false)); } }}
              className="flex-1 min-w-0 text-[15px] font-semibold bg-transparent border-0 outline-none rounded-[6px] px-1 -mx-1"
              style={{
                color: 'var(--ink)',
                textDecoration: draft.done ? 'line-through' : 'none',
                opacity: draft.done ? 0.6 : 1,
              }}
            />
            {savingTitle && <span className="text-[11px] flex-shrink-0 mt-[5px]" style={{ color: 'var(--ink-4)' }}>Guardando…</span>}
          </div>

          {/* Estado en texto, no sólo por el tachado */}
          <div className="flex items-center gap-2 -mt-2">
            <span
              className="text-[11px] font-medium px-[8px] py-[2px] rounded-full"
              style={
                draft.done
                  ? { background: 'var(--sem-green-bg)', color: 'var(--sem-green-dark)' }
                  : isOverdue
                    ? { background: 'var(--danger-bg)', color: 'var(--danger)' }
                    : { background: 'var(--bg-3)', color: 'var(--ink-3)' }
              }
            >
              {draft.done ? 'Completada' : isOverdue ? 'Atrasada' : 'Pendiente'}
            </span>
          </div>

          {/* Fecha + responsable */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--ink-4)' }}>
                Fecha
              </label>
              <input
                type="date"
                value={draft.due_date ?? ''}
                onChange={e => patch({ due_date: e.target.value || null })}
                className="h-9 px-3 rounded-[6px] text-[13px] outline-none"
                style={inputStyle}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--ink-4)' }}>
                Responsable
              </label>
              <select
                value={draft.assignee ?? ''}
                onChange={e => patch({ assignee: e.target.value || null })}
                className="h-9 px-2 rounded-[6px] text-[13px] outline-none"
                style={inputStyle}
              >
                <option value="">Sin asignar</option>
                {users.map(u => (
                  <option key={u.id} value={u.id}>{shortName(u, users)}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between px-5 py-3 border-t flex-shrink-0" style={{ borderColor: 'var(--line)' }}>
          <button
            onClick={handleDelete}
            className="h-8 px-3 rounded-[6px] text-[12px] font-medium border-0 flex items-center gap-[6px]"
            style={{ background: 'transparent', color: 'var(--danger)' }}
          >
            <Trash2 size={13} /> Eliminar
          </button>
          <button
            onClick={onClose}
            className="h-8 px-4 rounded-[6px] text-[12px] font-medium border"
            style={{ border: '1px solid var(--line)', background: 'var(--surface-2)', color: 'var(--ink-2)' }}
          >
            Listo
          </button>
        </div>
      </div>
    </div>
  );
}
