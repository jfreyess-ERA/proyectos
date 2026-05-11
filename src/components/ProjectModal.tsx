'use client';
import { useState, useEffect } from 'react';
import { X, Trash2 } from 'lucide-react';
import { insertProject, updateProject, deleteProject } from '@/lib/db';
import type { Project } from '@/lib/types';

const COLOR_PALETTE = [
  'oklch(0.55 0.18 265)',
  'oklch(0.52 0.18 160)',
  'oklch(0.55 0.18 25)',
  'oklch(0.58 0.16 50)',
  'oklch(0.52 0.18 300)',
  'oklch(0.52 0.16 220)',
  'oklch(0.55 0.16 340)',
  'oklch(0.56 0.14 90)',
  'oklch(0.45 0.06 250)',
  'oklch(0.52 0.12 30)',
  'oklch(0.52 0.16 190)',
  'oklch(0.50 0.18 285)',
];

interface Props {
  open: boolean;
  project?: Project;
  existingClients?: string[];
  onClose: () => void;
  onSaved: () => void;
}

export function ProjectModal({ open, project, existingClients = [], onClose, onSaved }: Props) {
  const isEdit = !!project;
  const [name, setName]     = useState('');
  const [key, setKey]       = useState('');
  const [color, setColor]   = useState(COLOR_PALETTE[0]);
  const [client, setClient] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState('');

  useEffect(() => {
    if (!open) return;
    if (project) {
      setName(project.name);
      setKey(project.key);
      setColor(project.color);
      setClient(project.client ?? '');
    } else {
      setName('');
      setKey('');
      setColor(COLOR_PALETTE[0]);
      setClient('');
    }
    setError('');
  }, [open, project]);

  function handleNameChange(v: string) {
    setName(v);
    if (!isEdit) {
      setKey(v.replace(/[^a-zA-Z0-9]/g, '').slice(0, 4).toUpperCase());
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !key.trim()) { setError('Nombre y clave son requeridos'); return; }
    setSaving(true);
    setError('');
    try {
      const clientVal = client.trim() || null;
      if (isEdit && project) {
        await updateProject(project.id, { name, color, client: clientVal });
      } else {
        await insertProject({ name, key: key.toUpperCase(), color, client: clientVal ?? undefined });
      }
      onSaved();
      onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al guardar');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!project) return;
    if (!confirm(`¿Eliminar el proyecto "${project.name}"? Se eliminarán todas sus tareas.`)) return;
    setSaving(true);
    try {
      await deleteProject(project.id);
      onSaved();
      onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al eliminar');
      setSaving(false);
    }
  }

  if (!open) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-50"
        style={{ background: 'rgba(0,0,0,.3)' }}
        onClick={onClose}
      />
      <div
        className="fixed z-50 flex flex-col rounded-[14px] overflow-hidden"
        style={{
          top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 440,
          background: 'var(--surface)',
          border: '1px solid var(--line)',
          boxShadow: 'var(--shadow-pop)',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'var(--line)' }}>
          <span className="text-[14px] font-semibold" style={{ color: 'var(--ink)' }}>
            {isEdit ? 'Editar proyecto' : 'Nuevo proyecto'}
          </span>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-[6px] border-0 bg-transparent" style={{ color: 'var(--ink-3)' }}>
            <X size={15} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 px-5 py-5">
          {error && (
            <div className="px-3 py-2 rounded-[8px] text-[12px]" style={{ background: 'var(--danger-bg)', color: 'var(--danger)', border: '1px solid var(--danger)' }}>
              {error}
            </div>
          )}

          {/* Preview */}
          <div className="flex items-center gap-3 px-3 py-[10px] rounded-[10px]" style={{ background: 'var(--bg-2)', border: '1px solid var(--line)' }}>
            <span className="w-[28px] h-[28px] rounded-[7px] flex-shrink-0" style={{ background: color }} />
            <div className="min-w-0">
              {client && (
                <div className="text-[10px] font-medium mb-[1px] truncate" style={{ color: 'var(--ink-4)' }}>{client}</div>
              )}
              <div className="text-[13px] font-semibold truncate" style={{ color: 'var(--ink)' }}>{name || 'Nombre del proyecto'}</div>
              <div className="text-[11px]" style={{ color: 'var(--ink-4)', fontFamily: 'var(--font-mono)' }}>{key || 'CLAVE'}</div>
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[12px] font-medium" style={{ color: 'var(--ink-2)' }}>Cliente</label>
            <input
              list="client-suggestions"
              type="text"
              value={client}
              onChange={e => setClient(e.target.value)}
              placeholder="Nombre de la empresa cliente"
              autoFocus
              className="h-9 px-3 rounded-[8px] text-[13px] outline-none"
              style={{ border: '1px solid var(--line)', background: 'var(--bg-2)', color: 'var(--ink)', fontFamily: 'var(--font)' }}
            />
            <datalist id="client-suggestions">
              {existingClients.map(c => <option key={c} value={c} />)}
            </datalist>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[12px] font-medium" style={{ color: 'var(--ink-2)' }}>Nombre del proyecto</label>
            <input
              type="text"
              value={name}
              onChange={e => handleNameChange(e.target.value)}
              required
              placeholder="Rediseño de marca"
              className="h-9 px-3 rounded-[8px] text-[13px] outline-none"
              style={{ border: '1px solid var(--line)', background: 'var(--bg-2)', color: 'var(--ink)', fontFamily: 'var(--font)' }}
            />
          </div>

          {!isEdit && (
            <div className="flex flex-col gap-1">
              <label className="text-[12px] font-medium" style={{ color: 'var(--ink-2)' }}>Clave (máx. 5 letras)</label>
              <input
                type="text"
                value={key}
                onChange={e => setKey(e.target.value.replace(/[^a-zA-Z0-9]/g, '').slice(0, 5).toUpperCase())}
                required
                placeholder="MARCA"
                className="h-9 px-3 rounded-[8px] text-[13px] outline-none uppercase"
                style={{ border: '1px solid var(--line)', background: 'var(--bg-2)', color: 'var(--ink)', fontFamily: 'var(--font-mono)' }}
              />
            </div>
          )}

          <div className="flex flex-col gap-2">
            <label className="text-[12px] font-medium" style={{ color: 'var(--ink-2)' }}>Color</label>
            <div className="flex flex-wrap gap-2">
              {COLOR_PALETTE.map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className="w-6 h-6 rounded-full transition-transform"
                  style={{
                    background: c,
                    outline: color === c ? `2px solid ${c}` : 'none',
                    outlineOffset: 2,
                    transform: color === c ? 'scale(1.2)' : 'scale(1)',
                    border: 'none',
                    cursor: 'pointer',
                  }}
                />
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2 mt-1">
            {isEdit && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={saving}
                className="h-9 px-3 rounded-[8px] text-[13px] font-medium flex items-center gap-2 border-0 transition-opacity"
                style={{ background: 'var(--danger-bg)', color: 'var(--danger)', opacity: saving ? 0.5 : 1 }}
              >
                <Trash2 size={13} /> Eliminar
              </button>
            )}
            <button
              type="submit"
              disabled={saving}
              className="flex-1 h-9 rounded-[8px] text-[13px] font-semibold border-0 transition-opacity"
              style={{ background: 'var(--accent)', color: 'var(--on-accent)', opacity: saving ? 0.6 : 1 }}
            >
              {saving ? 'Guardando…' : isEdit ? 'Guardar cambios' : 'Crear proyecto'}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
