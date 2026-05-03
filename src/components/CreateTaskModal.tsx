'use client';
import { useState, useEffect, useRef } from 'react';
import { X, Check } from 'lucide-react';
import { STATUSES, PRIORITIES } from '@/lib/data';
import { insertTask } from '@/lib/db';
import { Avatar } from './Avatar';
import type { Task, Project, User } from '@/lib/types';

interface Props {
  open: boolean;
  defaultStatus?: Task['status'];
  defaultProjectId?: string;
  projects: Project[];
  users: User[];
  onClose: () => void;
  onCreated: (task: Task) => void;
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
  const [status, setStatus]       = useState<Task['status']>(defaultStatus);
  const [priority, setPriority]   = useState<Task['priority']>('med');
  const [assignees, setAssignees] = useState<string[]>([]);
  const [dueDate, setDueDate]     = useState('');
  const [saving, setSaving]       = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setTitle('');
      setProjectId(defaultProjectId ?? projects[0]?.id ?? '');
      setStatus(defaultStatus);
      setPriority('med');
      setAssignees([]);
      setDueDate('');
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
        due_date:   dueDate || undefined,
      });
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

  if (!open) return null;

  const inputStyle = {
    border: '1px solid var(--line)',
    background: 'var(--bg-2)',
    color: 'var(--ink)',
    fontFamily: 'var(--font)',
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center"
      style={{ background: 'rgba(20,18,12,.38)', backdropFilter: 'blur(2px)' }}
      onClick={onClose}
    >
      <div
        className="flex flex-col overflow-hidden"
        style={{
          width: 'min(560px, 94vw)',
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

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 p-5">
          {/* Title */}
          <input
            ref={titleRef}
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Nombre de la tarea"
            required
            className="w-full h-10 px-3 rounded-[8px] text-[14px] outline-none"
            style={inputStyle}
          />

          {/* Row: project + status + priority */}
          <div className="flex gap-3">
            <div className="flex flex-col gap-1 flex-1">
              <label className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--ink-4)' }}>
                Proyecto
              </label>
              <select
                value={projectId}
                onChange={e => setProjectId(e.target.value)}
                className="h-9 px-2 rounded-[7px] text-[13px] outline-none"
                style={inputStyle}
              >
                {projects.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--ink-4)' }}>
                Estado
              </label>
              <select
                value={status}
                onChange={e => setStatus(e.target.value as Task['status'])}
                className="h-9 px-2 rounded-[7px] text-[13px] outline-none"
                style={inputStyle}
              >
                {STATUSES.map(s => (
                  <option key={s.id} value={s.id}>{s.label}</option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--ink-4)' }}>
                Prioridad
              </label>
              <select
                value={priority}
                onChange={e => setPriority(e.target.value as Task['priority'])}
                className="h-9 px-2 rounded-[7px] text-[13px] outline-none"
                style={inputStyle}
              >
                {PRIORITIES.map(p => (
                  <option key={p.id} value={p.id}>{p.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Due date */}
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--ink-4)' }}>
              Fecha límite
            </label>
            <input
              type="date"
              value={dueDate}
              onChange={e => setDueDate(e.target.value)}
              className="h-9 px-3 rounded-[7px] text-[13px] outline-none w-[200px]"
              style={inputStyle}
            />
          </div>

          {/* Assignees */}
          <div className="flex flex-col gap-2">
            <label className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--ink-4)' }}>
              Asignados
            </label>
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
          </div>

          {error && (
            <div
              className="px-3 py-2 rounded-[7px] text-[12px]"
              style={{ background: 'var(--danger-bg)', color: 'var(--danger)', border: '1px solid var(--danger)' }}
            >
              {error}
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center justify-end gap-2 pt-1">
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
              disabled={!title.trim() || saving}
              className="h-9 px-4 rounded-[8px] text-[13px] font-medium border-0 transition-opacity"
              style={{
                background: 'var(--accent)',
                color: 'var(--on-accent)',
                opacity: !title.trim() || saving ? 0.5 : 1,
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
