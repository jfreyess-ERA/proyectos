'use client';
import { useState } from 'react';
import { X } from 'lucide-react';
import { insertProspect } from '@/lib/db';
import { priorityEs, statusEs, stageEs } from '@/lib/crm-labels';
import type { Prospect, ProspectPriority, ProspectStatus, ProspectStage } from '@/lib/types';

const ES_BY_FIELD: Record<string, (v: string) => string> = {
  priority: priorityEs, status: statusEs, stage: stageEs,
};

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: (p: Prospect) => void;
  existingProspects?: Prospect[];
}

export function CreateProspectModal({ open, onClose, onCreated, existingProspects = [] }: Props) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    company: '',
    contact_name: '',
    role: '',
    email: '',
    phone: '',
    linkedin: '',
    industry: '',
    country: 'Chile',
    priority: 'Medium' as ProspectPriority,
    status: 'Active' as ProspectStatus,
    stage: 'New' as ProspectStage,
    source: '',
    pain_points: '',
    notes: '',
  });

  if (!open) return null;

  // Duplicate detection
  const duplicates = form.company.trim().length > 2
    ? existingProspects.filter(p =>
        p.company.toLowerCase().includes(form.company.toLowerCase().trim()) ||
        form.company.toLowerCase().trim().includes(p.company.toLowerCase())
      )
    : [];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.company.trim()) return;
    setSaving(true);
    try {
      const p = await insertProspect(form);
      onCreated(p);
      onClose();
      setForm({
        company: '', contact_name: '', role: '', email: '', phone: '',
        linkedin: '', industry: '', country: 'Chile', priority: 'Medium',
        status: 'Active', stage: 'New', source: '', pain_points: '', notes: '',
      });
    } finally {
      setSaving(false);
    }
  }

  const inp = "w-full h-8 px-3 rounded-[6px] text-[13px] outline-none";
  const inpStyle = { border: '1px solid var(--line)', background: 'var(--surface)', color: 'var(--ink)', fontFamily: 'var(--font)' };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.35)' }}>
        <div
          className="relative w-full max-w-[560px] rounded-[12px] overflow-hidden shadow-2xl flex flex-col"
          style={{ background: 'var(--bg)', border: '1px solid var(--line)', maxHeight: '90vh' }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 flex-shrink-0" style={{ borderBottom: '1px solid var(--line)' }}>
            <div className="text-[16px] font-semibold" style={{ color: 'var(--ink)' }}>Nuevo prospecto</div>
            <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-[6px] border-0 bg-transparent" style={{ color: 'var(--ink-4)' }}>
              <X size={16} />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="overflow-y-auto">
            <div className="px-5 py-4 flex flex-col gap-4">
              <div>
                <label className="text-[12px] font-medium mb-1 block" style={{ color: 'var(--ink-2)' }}>Empresa *</label>
                <input
                  value={form.company}
                  onChange={e => setForm(f => ({ ...f, company: e.target.value }))}
                  placeholder="Nombre de la empresa"
                  required
                  className={inp}
                  style={inpStyle}
                />
                {duplicates.length > 0 && (
                  <div className="mt-1 flex items-start gap-1 text-[11px]" style={{ color: 'oklch(0.50 0.14 85)' }}>
                    <span>⚠️</span>
                    <span>Ya existe un prospecto similar: <strong>{duplicates.map(d => d.company).join(', ')}</strong></span>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[12px] font-medium mb-1 block" style={{ color: 'var(--ink-2)' }}>Contacto</label>
                  <input value={form.contact_name} onChange={e => setForm(f => ({ ...f, contact_name: e.target.value }))}
                    placeholder="Nombre completo" className={inp} style={inpStyle} />
                </div>
                <div>
                  <label className="text-[12px] font-medium mb-1 block" style={{ color: 'var(--ink-2)' }}>Cargo</label>
                  <input value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
                    placeholder="CEO, CFO, Gerente…" className={inp} style={inpStyle} />
                </div>
                <div>
                  <label className="text-[12px] font-medium mb-1 block" style={{ color: 'var(--ink-2)' }}>Email</label>
                  <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                    placeholder="email@empresa.com" className={inp} style={inpStyle} />
                </div>
                <div>
                  <label className="text-[12px] font-medium mb-1 block" style={{ color: 'var(--ink-2)' }}>Teléfono</label>
                  <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                    placeholder="+56 9 XXXX XXXX" className={inp} style={inpStyle} />
                </div>
                <div>
                  <label className="text-[12px] font-medium mb-1 block" style={{ color: 'var(--ink-2)' }}>LinkedIn</label>
                  <input value={form.linkedin} onChange={e => setForm(f => ({ ...f, linkedin: e.target.value }))}
                    placeholder="linkedin.com/in/…" className={inp} style={inpStyle} />
                </div>
                <div>
                  <label className="text-[12px] font-medium mb-1 block" style={{ color: 'var(--ink-2)' }}>Industria</label>
                  <input value={form.industry} onChange={e => setForm(f => ({ ...f, industry: e.target.value }))}
                    placeholder="Retail, Minería, Financiero…" className={inp} style={inpStyle} />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'Prioridad', field: 'priority', opts: ['High', 'Medium', 'Low', 'Strategic', 'Watchlist'] },
                  { label: 'Estado', field: 'status', opts: ['Active', 'Warm', 'Paused', 'Nurture', 'Closed Won', 'Closed Lost', 'Dormant'] },
                  { label: 'Etapa', field: 'stage', opts: ['New', 'Contacted', 'Meeting Requested', 'Meeting Held', 'Proposal', 'Negotiation', 'Won'] },
                ].map(({ label, field, opts }) => (
                  <div key={field}>
                    <label className="text-[12px] font-medium mb-1 block" style={{ color: 'var(--ink-2)' }}>{label}</label>
                    <select
                      value={form[field as keyof typeof form] as string}
                      onChange={e => setForm(f => ({ ...f, [field]: e.target.value }))}
                      className="w-full h-8 px-2 rounded-[6px] text-[13px] outline-none"
                      style={inpStyle}
                    >
                      {opts.map(o => <option key={o} value={o}>{ES_BY_FIELD[field]?.(o) ?? o}</option>)}
                    </select>
                  </div>
                ))}
              </div>

              <div>
                <label className="text-[12px] font-medium mb-1 block" style={{ color: 'var(--ink-2)' }}>Fuente / Origen</label>
                <input value={form.source} onChange={e => setForm(f => ({ ...f, source: e.target.value }))}
                  placeholder="Referido, LinkedIn, Evento…" className={inp} style={inpStyle} />
              </div>

              <div>
                <label className="text-[12px] font-medium mb-1 block" style={{ color: 'var(--ink-2)' }}>Dolores / Necesidades</label>
                <textarea value={form.pain_points} onChange={e => setForm(f => ({ ...f, pain_points: e.target.value }))}
                  placeholder="¿Qué problemas enfrenta esta empresa?" rows={2}
                  className="w-full px-3 py-2 rounded-[6px] text-[13px] outline-none resize-none"
                  style={inpStyle} />
              </div>

              <div>
                <label className="text-[12px] font-medium mb-1 block" style={{ color: 'var(--ink-2)' }}>Notas</label>
                <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder="Contexto adicional, observaciones…" rows={2}
                  className="w-full px-3 py-2 rounded-[6px] text-[13px] outline-none resize-none"
                  style={inpStyle} />
              </div>
            </div>

            {/* Footer */}
            <div className="flex gap-2 px-5 py-4 flex-shrink-0" style={{ borderTop: '1px solid var(--line)' }}>
              <button
                type="submit"
                disabled={saving || !form.company.trim()}
                className="flex-1 h-9 rounded-[8px] text-[13px] font-semibold border-0 transition-opacity"
                style={{ background: 'var(--accent)', color: 'var(--on-accent)', opacity: saving || !form.company.trim() ? 0.6 : 1 }}
              >
                {saving ? 'Guardando…' : 'Crear prospecto'}
              </button>
              <button type="button" onClick={onClose}
                className="h-9 px-4 rounded-[8px] text-[13px] border-0"
                style={{ background: 'var(--bg-3)', color: 'var(--ink-2)' }}>
                Cancelar
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
