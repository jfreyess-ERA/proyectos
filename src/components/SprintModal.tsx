'use client';
import { useState, useEffect } from 'react';
import { X, Trash2 } from 'lucide-react';
import { insertSprint, updateSprint, deleteSprint } from '@/lib/db';
import { ProjectPicker } from './ProjectPicker';
import type { Sprint, Project } from '@/lib/types';

interface Props {
  open: boolean;
  sprint?: Sprint;
  projects: Project[];
  defaultProjectId?: string;
  onClose: () => void;
  onSaved: (sprint: Sprint) => void;
  onDeleted?: (id: string) => void;
}

const STATUS_LABELS: Record<Sprint['status'], string> = {
  planned:   'Planificado',
  active:    'Activo',
  completed: 'Completado',
};

export function SprintModal({ open, sprint, projects, defaultProjectId, onClose, onSaved, onDeleted }: Props) {
  const [name, setName]           = useState('');
  const [goal, setGoal]           = useState('');
  const [projectId, setProjectId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate]     = useState('');
  const [status, setStatus]       = useState<Sprint['status']>('planned');
  const [saving, setSaving]       = useState(false);
  const [error, setError]         = useState('');

  useEffect(() => {
    if (!open) return;
    if (sprint) {
      setName(sprint.name);
      setGoal(sprint.goal ?? '');
      setProjectId(sprint.project_id);
      setStartDate(sprint.start_date ?? '');
      setEndDate(sprint.end_date ?? '');
      setStatus(sprint.status);
    } else {
      setName('');
      setGoal('');
      setProjectId(defaultProjectId ?? projects[0]?.id ?? '');
      setStartDate('');
      setEndDate('');
      setStatus('planned');
    }
    setError('');
  }, [open, sprint, defaultProjectId, projects]);

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !projectId) return;
    setSaving(true);
    setError('');
    try {
      if (sprint) {
        await updateSprint(sprint.id, {
          name: name.trim(), goal: goal.trim() || undefined,
          start_date: startDate || undefined, end_date: endDate || undefined, status,
        });
        onSaved({ ...sprint, name: name.trim(), goal: goal.trim() || undefined, start_date: startDate || undefined, end_date: endDate || undefined, status });
      } else {
        const created = await insertSprint({
          project_id: projectId, name: name.trim(),
          goal: goal.trim() || undefined,
          start_date: startDate || undefined, end_date: endDate || undefined, status,
        });
        onSaved(created);
      }
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!sprint || !confirm(`¿Eliminar sprint "${sprint.name}"?`)) return;
    await deleteSprint(sprint.id);
    onDeleted?.(sprint.id);
    onClose();
  }

  return (
    <>
      <div className="fixed inset-0 z-50" style={{ background: 'rgba(20,18,12,.32)', backdropFilter: 'blur(2px)' }} onClick={onClose} />
      <div
        className="fixed z-50 flex flex-col"
        style={{
          top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
          width: 'min(480px, 92vw)',
          background: 'var(--surface)', border: '1px solid var(--line)',
          borderRadius: 14, boxShadow: 'var(--shadow-pop)',
        }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'var(--line)' }}>
          <span className="text-[15px] font-semibold" style={{ color: 'var(--ink)' }}>
            {sprint ? 'Editar sprint' : 'Nuevo sprint'}
          </span>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-[6px] border-0 bg-transparent" style={{ color: 'var(--ink-3)' }}>
            <X size={15} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-5 py-4 flex flex-col gap-4">
          {error && (
            <div className="px-3 py-2 rounded-[8px] text-[12px]" style={{ background: 'var(--danger-bg)', color: 'var(--danger)', border: '1px solid var(--danger)' }}>{error}</div>
          )}

          <Field label="Nombre del sprint *">
            <input
              value={name} onChange={e => setName(e.target.value)} required autoFocus
              placeholder="Sprint 1 · Mayo"
              className="h-8 px-3 rounded-[6px] text-[13px] outline-none w-full"
              style={{ border: '1px solid var(--line)', background: 'var(--bg)', color: 'var(--ink)', fontFamily: 'var(--font)' }}
            />
          </Field>

          {!sprint && (
            <Field label="Proyecto *">
              <ProjectPicker projects={projects} value={projectId} onChange={setProjectId} height={32} />
            </Field>
          )}

          <Field label="Objetivo (opcional)">
            <textarea
              value={goal} onChange={e => setGoal(e.target.value)} rows={2}
              placeholder="¿Qué entregamos en este sprint?"
              className="px-3 py-2 rounded-[6px] text-[13px] outline-none w-full resize-none"
              style={{ border: '1px solid var(--line)', background: 'var(--bg)', color: 'var(--ink)', fontFamily: 'var(--font)' }}
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Fecha inicio">
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                className="h-8 px-2 rounded-[6px] text-[12px] outline-none w-full"
                style={{ border: '1px solid var(--line)', background: 'var(--bg)', color: 'var(--ink)', fontFamily: 'var(--font)' }}
              />
            </Field>
            <Field label="Fecha fin">
              <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
                className="h-8 px-2 rounded-[6px] text-[12px] outline-none w-full"
                style={{ border: '1px solid var(--line)', background: 'var(--bg)', color: 'var(--ink)', fontFamily: 'var(--font)' }}
              />
            </Field>
          </div>

          <Field label="Estado">
            <select value={status} onChange={e => setStatus(e.target.value as Sprint['status'])}
              className="h-8 px-2 rounded-[6px] text-[13px] outline-none w-full"
              style={{ border: '1px solid var(--line)', background: 'var(--bg)', color: 'var(--ink)', fontFamily: 'var(--font)' }}
            >
              {(Object.entries(STATUS_LABELS) as [Sprint['status'], string][]).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </Field>

          <div className="flex gap-2 pt-1">
            {sprint && (
              <button type="button" onClick={handleDelete}
                className="h-8 px-3 rounded-[6px] text-[12px] border-0 flex items-center gap-1"
                style={{ background: 'var(--danger-bg)', color: 'var(--danger)' }}
              >
                <Trash2 size={13} /> Eliminar
              </button>
            )}
            <button type="button" onClick={onClose}
              className="flex-1 h-8 rounded-[6px] text-[12px] font-medium border-0"
              style={{ background: 'var(--bg-3)', color: 'var(--ink-3)' }}
            >
              Cancelar
            </button>
            <button type="submit" disabled={saving || !name.trim()}
              className="flex-1 h-8 rounded-[6px] text-[12px] font-semibold border-0 transition-opacity"
              style={{ background: 'var(--accent)', color: 'var(--on-accent)', opacity: saving || !name.trim() ? 0.5 : 1 }}
            >
              {saving ? 'Guardando…' : sprint ? 'Guardar' : 'Crear sprint'}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[11px] font-medium" style={{ color: 'var(--ink-3)' }}>{label}</label>
      {children}
    </div>
  );
}
