'use client';
import { useState, useEffect, useRef } from 'react';
import { X, Check, Plus, Trash2, ListChecks } from 'lucide-react';
import { STATUSES, PRIORITIES } from '@/lib/data';
import { insertTask, insertSubtasksBatch, type NewSubtaskInput } from '@/lib/db';
import { Avatar } from './Avatar';
import { ProjectPicker } from './ProjectPicker';
import { PROJECT_STAGES } from './StageBoard';
import type { Task, Project, User } from '@/lib/types';

interface Props {
  open: boolean;
  defaultStatus?: Task['status'];
  defaultProjectId?: string;
  /** Proyectos ofrecidos: sólo los de clientes abiertos. */
  projects: Project[];
  users: User[];
  onClose: () => void;
  onCreated: (task: Task) => void;
}

/** Fila de subtarea en el borrador, antes de existir en la base. */
interface DraftSubtask {
  key: number;
  title: string;
  due_date: string;
  assignee: string;
}

export function CreateTaskModal({
  open,
  defaultStatus = 'todo',
  defaultProjectId,
  projects,
  users,
  onClose,
  onCreated,
}: Props) {
  const [title, setTitle]         = useState('');
  const [projectId, setProjectId] = useState(defaultProjectId ?? projects[0]?.id ?? '');
  const [stage, setStage]         = useState<string>('');
  const [status, setStatus]       = useState<Task['status']>(defaultStatus);
  const [priority, setPriority]   = useState<Task['priority']>('med');
  const [assignees, setAssignees] = useState<string[]>([]);
  const [startDate, setStartDate] = useState('');
  const [dueDate, setDueDate]     = useState('');
  const [estimate, setEstimate]   = useState('');
  const [description, setDescription] = useState('');
  const [subtasks, setSubtasks]   = useState<DraftSubtask[]>([]);
  const [saving, setSaving]       = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const seq = useRef(0);

  useEffect(() => {
    if (open) {
      setTitle('');
      setProjectId(defaultProjectId ?? projects[0]?.id ?? '');
      setStage('');
      setStatus(defaultStatus);
      setPriority('med');
      setAssignees([]);
      setStartDate('');
      setDueDate('');
      setEstimate('');
      setDescription('');
      setSubtasks([]);
      setError(null);
      setTimeout(() => titleRef.current?.focus(), 30);
    }
  }, [open, defaultStatus, defaultProjectId, projects]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (open) window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  // Fechas incoherentes: se avisa, no se bloquea el botón (la regla es dejar
  // enviar y explicar, no deshabilitar sin decir por qué).
  const dateWarning = startDate && dueDate && dueDate < startDate
    ? 'La fecha límite es anterior a la de inicio.'
    : null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const task = await insertTask({
        title:      title.trim(),
        project_id: projectId,
        status,
        priority,
        assignees,
        start_date: startDate || undefined,
        due_date:   dueDate || undefined,
        description: description.trim() || undefined,
        project_stage: (stage || undefined) as Task['project_stage'],
        estimate:   estimate ? Number(estimate) : undefined,
      });

      const rows: NewSubtaskInput[] = subtasks
        .filter(s => s.title.trim())
        .map(s => ({
          title:    s.title.trim(),
          due_date: s.due_date || null,
          assignee: s.assignee || null,
        }));
      if (rows.length) {
        await insertSubtasksBatch(task.id, rows);
        task.subtasks = { done: 0, total: rows.length };
      }

      onCreated(task);
      onClose();
    } catch (err) {
      setError((err as Error).message ?? 'Error al guardar');
    } finally {
      setSaving(false);
    }
  }

  function toggleAssignee(id: string) {
    setAssignees(prev =>
      prev.includes(id) ? prev.filter(a => a !== id) : [...prev, id]
    );
  }

  function addSubtask() {
    seq.current += 1;
    setSubtasks(prev => [...prev, { key: seq.current, title: '', due_date: '', assignee: '' }]);
  }

  function patchSubtask(key: number, patch: Partial<DraftSubtask>) {
    setSubtasks(prev => prev.map(s => s.key === key ? { ...s, ...patch } : s));
  }

  if (!open) return null;

  const inputStyle = {
    border: '1px solid var(--line)',
    background: 'var(--bg-2)',
    color: 'var(--ink)',
    fontFamily: 'var(--font)',
  };

  const filledSubtasks = subtasks.filter(s => s.title.trim()).length;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-6"
      style={{ background: 'rgba(20,18,12,.38)', backdropFilter: 'blur(2px)' }}
      onClick={onClose}
    >
      <div
        className="flex flex-col overflow-hidden w-full"
        style={{
          maxWidth: 760,
          maxHeight: '92vh',
          background: 'var(--surface)',
          border: '1px solid var(--line)',
          borderRadius: 14,
          boxShadow: 'var(--shadow-pop)',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4 border-b flex-shrink-0"
          style={{ borderColor: 'var(--line)' }}
        >
          <span className="text-[14px] font-semibold" style={{ color: 'var(--ink)' }}>
            Nueva tarea
          </span>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-[6px] border-0 bg-transparent"
            style={{ color: 'var(--ink-3)' }}
          >
            <X size={15} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col min-h-0 flex-1">
          <div className="flex flex-col gap-4 p-5 overflow-y-auto flex-1">
            {/* Título */}
            <input
              ref={titleRef}
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Nombre de la tarea"
              required
              className="w-full h-10 px-3 rounded-[8px] text-[14px] outline-none"
              style={inputStyle}
            />

            {/* Proyecto + hito */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Proyecto">
                <ProjectPicker projects={projects} value={projectId} onChange={setProjectId} height={36} />
              </Field>
              <Field label="Hito / etapa ERA">
                <select
                  value={stage}
                  onChange={e => setStage(e.target.value)}
                  className="w-full h-9 px-2 rounded-[7px] text-[13px] outline-none"
                  style={inputStyle}
                >
                  <option value="">Sin hito</option>
                  {PROJECT_STAGES.map(s => (
                    <option key={s.id} value={s.id}>{s.label}</option>
                  ))}
                </select>
              </Field>
            </div>

            {/* Estado + prioridad + estimación */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Field label="Estado">
                <select
                  value={status}
                  onChange={e => setStatus(e.target.value as Task['status'])}
                  className="w-full h-9 px-2 rounded-[7px] text-[13px] outline-none"
                  style={inputStyle}
                >
                  {STATUSES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                </select>
              </Field>
              <Field label="Prioridad">
                <select
                  value={priority}
                  onChange={e => setPriority(e.target.value as Task['priority'])}
                  className="w-full h-9 px-2 rounded-[7px] text-[13px] outline-none"
                  style={inputStyle}
                >
                  {PRIORITIES.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
                </select>
              </Field>
              <Field label="Horas estimadas (opcional)">
                <input
                  type="number"
                  min={0}
                  value={estimate}
                  onChange={e => setEstimate(e.target.value)}
                  placeholder="0"
                  className="w-full h-9 px-3 rounded-[7px] text-[13px] outline-none"
                  style={inputStyle}
                />
              </Field>
            </div>

            {/* Fechas */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Fecha de inicio (opcional)">
                <input
                  type="date"
                  value={startDate}
                  onChange={e => setStartDate(e.target.value)}
                  className="w-full h-9 px-3 rounded-[7px] text-[13px] outline-none"
                  style={inputStyle}
                />
              </Field>
              <Field label="Fecha límite (opcional)">
                <input
                  type="date"
                  value={dueDate}
                  onChange={e => setDueDate(e.target.value)}
                  className="w-full h-9 px-3 rounded-[7px] text-[13px] outline-none"
                  style={inputStyle}
                />
              </Field>
            </div>
            {dateWarning && (
              <div className="text-[12px] -mt-2" style={{ color: 'var(--danger)' }}>{dateWarning}</div>
            )}

            {/* Asignados */}
            <Field label="Asignados">
              <div className="flex flex-wrap gap-2">
                {users.map(u => {
                  const selected = assignees.includes(u.id);
                  return (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => toggleAssignee(u.id)}
                      className="flex items-center gap-[6px] h-8 px-[10px] rounded-full text-[12px] border transition-colors"
                      style={{
                        border: selected ? '1.5px solid var(--accent)' : '1px solid var(--line)',
                        background: selected ? 'var(--accent-bg)' : 'var(--bg-2)',
                        color: selected ? 'var(--accent)' : 'var(--ink-2)',
                      }}
                    >
                      <Avatar userId={u.id} size="sm" />
                      {u.name.split(' ')[0]}
                      {selected && <Check size={11} />}
                    </button>
                  );
                })}
              </div>
            </Field>

            {/* Descripción */}
            <Field label="Descripción (opcional)">
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Contexto, alcance, entregable esperado…"
                rows={2}
                className="w-full px-3 py-2 rounded-[7px] text-[13px] outline-none resize-none"
                style={inputStyle}
              />
            </Field>

            {/* Subtareas */}
            <div className="rounded-[10px] p-3" style={{ background: 'var(--bg-2)', border: '1px solid var(--line)' }}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <ListChecks size={14} style={{ color: 'var(--ink-3)' }} />
                  <span className="text-[12.5px] font-semibold" style={{ color: 'var(--ink)' }}>
                    Subtareas
                  </span>
                  {filledSubtasks > 0 && (
                    <span className="text-[11.5px]" style={{ color: 'var(--ink-4)' }}>
                      {filledSubtasks}
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={addSubtask}
                  className="h-7 px-2.5 rounded-[6px] text-[12px] font-medium flex items-center gap-1 border-0"
                  style={{ background: 'var(--accent)', color: 'var(--on-accent)' }}
                >
                  <Plus size={12} /> Agregar
                </button>
              </div>

              {subtasks.length === 0 ? (
                <p className="text-[12px]" style={{ color: 'var(--ink-4)' }}>
                  Desglosá la tarea en pasos. Cada subtarea puede tener su propia fecha y responsable,
                  y aparece en los calendarios del equipo.
                </p>
              ) : (
                <div className="flex flex-col gap-2">
                  {subtasks.map((s, i) => (
                    <div key={s.key} className="flex gap-2 items-center">
                      <span className="text-[11px] tabular-nums w-[14px] flex-shrink-0" style={{ color: 'var(--ink-4)' }}>
                        {i + 1}
                      </span>
                      <input
                        value={s.title}
                        onChange={e => patchSubtask(s.key, { title: e.target.value })}
                        placeholder="¿Qué hay que hacer?"
                        className="flex-1 min-w-0 h-8 px-2 rounded-[6px] text-[13px] outline-none"
                        style={{ ...inputStyle, background: 'var(--surface)' }}
                      />
                      <input
                        type="date"
                        value={s.due_date}
                        onChange={e => patchSubtask(s.key, { due_date: e.target.value })}
                        title="Fecha de la subtarea"
                        className="h-8 px-2 rounded-[6px] text-[12px] outline-none flex-shrink-0"
                        style={{ ...inputStyle, background: 'var(--surface)', width: 130 }}
                      />
                      <select
                        value={s.assignee}
                        onChange={e => patchSubtask(s.key, { assignee: e.target.value })}
                        title="Responsable de la subtarea"
                        className="h-8 px-2 rounded-[6px] text-[12px] outline-none flex-shrink-0"
                        style={{ ...inputStyle, background: 'var(--surface)', width: 118 }}
                      >
                        <option value="">Sin asignar</option>
                        {users.map(u => (
                          <option key={u.id} value={u.id}>{u.name.split(' ')[0]}</option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => setSubtasks(prev => prev.filter(x => x.key !== s.key))}
                        className="w-7 h-7 flex items-center justify-center rounded-[6px] border-0 bg-transparent flex-shrink-0"
                        style={{ color: 'var(--ink-4)' }}
                        aria-label={`Quitar subtarea ${i + 1}`}
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {error && (
              <div
                className="px-3 py-2 rounded-[7px] text-[12px]"
                style={{ background: 'var(--danger-bg)', color: 'var(--danger)', border: '1px solid var(--danger)' }}
              >
                {error}
              </div>
            )}
          </div>

          {/* Footer */}
          <div
            className="flex items-center justify-end gap-2 px-5 py-3 border-t flex-shrink-0"
            style={{ borderColor: 'var(--line)', background: 'var(--surface)' }}
          >
            <button
              type="button"
              onClick={onClose}
              className="h-9 px-4 rounded-[8px] text-[13px] font-medium border"
              style={{ border: '1px solid var(--line)', background: 'var(--surface-2)', color: 'var(--ink-2)' }}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="h-9 px-4 rounded-[8px] text-[13px] font-medium border-0 transition-opacity"
              style={{
                background: 'var(--accent)',
                color: 'var(--on-accent)',
                opacity: saving ? 0.5 : 1,
              }}
            >
              {saving
                ? 'Guardando…'
                : filledSubtasks > 0
                  ? `Crear tarea y ${filledSubtasks} subtarea${filledSubtasks > 1 ? 's' : ''}`
                  : 'Crear tarea'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1 min-w-0">
      <label className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--ink-4)' }}>
        {label}
      </label>
      {children}
    </div>
  );
}
