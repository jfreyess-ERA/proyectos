'use client';
import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { insertCrmTask } from '@/lib/db';
import { useAuth } from '@/lib/auth-context';
import type { Prospect, CrmTaskType, CrmTaskStatus } from '@/lib/types';

const TASK_TYPES: CrmTaskType[] = [
  'Follow-up', 'Research', 'Send case study', 'Call', 'Meeting', 'Reconnect', 'Proposal',
];

interface Props {
  open: boolean;
  prospects: Prospect[];
  defaultProspectId?: string;
  onClose: () => void;
  onCreated: () => void;
}

export function CreateCrmTaskModal({ open, prospects, defaultProspectId, onClose, onCreated }: Props) {
  const { profile } = useAuth();
  const [prospectId, setProspectId] = useState(defaultProspectId ?? '');
  const [taskType, setTaskType]     = useState<CrmTaskType | ''>('');
  const [priority, setPriority]     = useState<'High' | 'Medium' | 'Low'>('Medium');
  const [dueDate, setDueDate]       = useState('');
  const [notes, setNotes]           = useState('');
  const [saving, setSaving]         = useState(false);
  const [error, setError]           = useState('');

  useEffect(() => {
    if (open) {
      setProspectId(defaultProspectId ?? '');
      setTaskType('');
      setPriority('Medium');
      setDueDate('');
      setNotes('');
      setError('');
    }
  }, [open, defaultProspectId]);

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!prospectId || !taskType) { setError('Prospecto y tipo de tarea son obligatorios'); return; }
    setSaving(true);
    setError('');
    try {
      await insertCrmTask({
        prospect_id: prospectId,
        task_type: taskType as CrmTaskType,
        priority,
        status: 'Pending' as CrmTaskStatus,
        due_date: dueDate || undefined,
        notes: notes || undefined,
        owner_id: profile?.id,
      });
      onCreated();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al guardar');
    } finally {
      setSaving(false);
    }
  }

  const sortedProspects = [...prospects].sort((a, b) => a.company.localeCompare(b.company));

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,.45)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full max-w-[440px] rounded-[16px] flex flex-col"
        style={{ background: 'var(--surface)', border: '1px solid var(--line)', boxShadow: '0 24px 64px rgba(0,0,0,.18)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'var(--line)' }}>
          <h2 className="text-[15px] font-bold" style={{ color: 'var(--ink)' }}>Nueva tarea CRM</h2>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-[6px] border-0 bg-transparent" style={{ color: 'var(--ink-3)', cursor: 'pointer' }}>
            <X size={15} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 p-5">

          {/* Prospect */}
          <div className="flex flex-col gap-1">
            <label className="text-[12px] font-medium" style={{ color: 'var(--ink-2)' }}>
              Prospecto <span style={{ color: 'var(--sem-red)' }}>*</span>
            </label>
            <select
              value={prospectId}
              onChange={e => setProspectId(e.target.value)}
              required
              className="h-9 px-3 rounded-[8px] text-[13px] outline-none"
              style={{ border: '1px solid var(--line)', background: 'var(--bg-2)', color: 'var(--ink)', fontFamily: 'var(--font)' }}
            >
              <option value="">— Seleccionar prospecto —</option>
              {sortedProspects.map(p => (
                <option key={p.id} value={p.id}>
                  {p.company}{p.contact_name ? ` · ${p.contact_name}` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Task type */}
          <div className="flex flex-col gap-1">
            <label className="text-[12px] font-medium" style={{ color: 'var(--ink-2)' }}>
              Tipo de tarea <span style={{ color: 'var(--sem-red)' }}>*</span>
            </label>
            <select
              value={taskType}
              onChange={e => setTaskType(e.target.value as CrmTaskType)}
              required
              className="h-9 px-3 rounded-[8px] text-[13px] outline-none"
              style={{ border: '1px solid var(--line)', background: 'var(--bg-2)', color: 'var(--ink)', fontFamily: 'var(--font)' }}
            >
              <option value="">— Tipo —</option>
              {TASK_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          {/* Priority + Due date */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-[12px] font-medium" style={{ color: 'var(--ink-2)' }}>Prioridad</label>
              <select
                value={priority}
                onChange={e => setPriority(e.target.value as 'High' | 'Medium' | 'Low')}
                className="h-9 px-3 rounded-[8px] text-[13px] outline-none"
                style={{ border: '1px solid var(--line)', background: 'var(--bg-2)', color: 'var(--ink)', fontFamily: 'var(--font)' }}
              >
                <option value="High">Alta</option>
                <option value="Medium">Media</option>
                <option value="Low">Baja</option>
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[12px] font-medium" style={{ color: 'var(--ink-2)' }}>Fecha límite</label>
              <input
                type="date"
                value={dueDate}
                onChange={e => setDueDate(e.target.value)}
                className="h-9 px-3 rounded-[8px] text-[13px] outline-none"
                style={{ border: '1px solid var(--line)', background: 'var(--bg-2)', color: 'var(--ink)', fontFamily: 'var(--font)' }}
              />
            </div>
          </div>

          {/* Notes */}
          <div className="flex flex-col gap-1">
            <label className="text-[12px] font-medium" style={{ color: 'var(--ink-2)' }}>Notas</label>
            <input
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Descripción o contexto de la tarea"
              className="h-9 px-3 rounded-[8px] text-[13px] outline-none"
              style={{ border: '1px solid var(--line)', background: 'var(--bg-2)', color: 'var(--ink)', fontFamily: 'var(--font)' }}
            />
          </div>

          {error && (
            <div className="text-[12px] px-3 py-2 rounded-[7px]" style={{ background: 'var(--danger-bg)', color: 'var(--danger)', border: '1px solid var(--danger)' }}>
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="h-8 px-4 rounded-[8px] text-[13px] border-0"
              style={{ background: 'var(--bg-3)', color: 'var(--ink-2)', cursor: 'pointer' }}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving || !prospectId || !taskType}
              className="h-8 px-4 rounded-[8px] text-[13px] font-semibold border-0"
              style={{
                background: 'var(--accent)',
                color: 'var(--on-accent)',
                opacity: saving || !prospectId || !taskType ? 0.5 : 1,
                cursor: saving || !prospectId || !taskType ? 'not-allowed' : 'pointer',
              }}
            >
              {saving ? 'Guardando…' : 'Crear tarea'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
