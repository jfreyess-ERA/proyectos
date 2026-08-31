'use client';
import { useState } from 'react';
import { Plus, Copy, Edit2, Trash2, X, Check, Mail } from 'lucide-react';
import { insertEmailTemplate, updateEmailTemplate, deleteEmailTemplate } from '@/lib/db';
import { EmptyState } from './EmptyState';
import type { EmailTemplate } from '@/lib/types';

import type { Prospect } from '@/lib/types';

interface Props {
  templates: EmailTemplate[];
  prospects?: Prospect[];
  onTemplatesChanged: () => void;
}

function fillTemplate(text: string, prospect?: Prospect): string {
  if (!prospect) return text;
  return text
    .replace(/\[Nombre\]/g, prospect.contact_name ?? '[Nombre]')
    .replace(/\[nombre\]/g, prospect.contact_name ?? '[nombre]')
    .replace(/\[empresa\]/g, prospect.company)
    .replace(/\[Empresa\]/g, prospect.company)
    .replace(/\[company\]/gi, prospect.company)
    .replace(/\[cargo\]/gi, prospect.role ?? '[cargo]')
    .replace(/\[industria\]/gi, prospect.industry ?? '[industria]');
}

export function EmailTemplatesView({ templates, prospects = [], onTemplatesChanged }: Props) {
  const [selected, setSelected] = useState<EmailTemplate | null>(null);
  const [editing, setEditing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [previewProspectId, setPreviewProspectId] = useState<string>('');
  const [previewTab, setPreviewTab] = useState<'template' | 'preview'>('template');

  const [draft, setDraft] = useState<Partial<EmailTemplate>>({});

  function openCreate() {
    setDraft({ name: '', use_case: '', subject: '', body: '' });
    setCreating(true);
    setEditing(false);
    setSelected(null);
  }

  function openEdit(t: EmailTemplate) {
    setDraft({ ...t });
    setEditing(true);
    setCreating(false);
  }

  async function handleSave() {
    if (!draft.name?.trim()) return;
    setSaving(true);
    try {
      if (creating) {
        await insertEmailTemplate({ name: draft.name, use_case: draft.use_case, subject: draft.subject, body: draft.body });
        setCreating(false);
      } else if (editing && selected) {
        await updateEmailTemplate(selected.id, { name: draft.name, use_case: draft.use_case, subject: draft.subject, body: draft.body });
        setEditing(false);
      }
      onTemplatesChanged();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(t: EmailTemplate) {
    if (!confirm(`¿Eliminar la plantilla "${t.name}"?`)) return;
    await deleteEmailTemplate(t.id);
    if (selected?.id === t.id) setSelected(null);
    onTemplatesChanged();
  }

  const previewProspect = prospects.find(p => p.id === previewProspectId);

  async function copyToClipboard(t: EmailTemplate) {
    const filledSubject = fillTemplate(t.subject ?? '', previewProspect);
    const filledBody = fillTemplate(t.body ?? '', previewProspect);
    const text = `Asunto: ${filledSubject}\n\n${filledBody}`;
    await navigator.clipboard.writeText(text);
    setCopied(t.id);
    setTimeout(() => setCopied(null), 2000);
  }

  const inp = "w-full h-8 px-3 rounded-[7px] text-[13px] outline-none";
  const inpStyle = { border: '1px solid var(--line)', background: 'var(--surface)', color: 'var(--ink)', fontFamily: 'var(--font)' };

  return (
    <div className="flex h-full">
      {/* Left: template list */}
      <div
        className="flex flex-col border-r flex-shrink-0"
        style={{ width: 280, borderColor: 'var(--line)', background: 'var(--bg-2)' }}
      >
        <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid var(--line)' }}>
          <div className="text-[13px] font-semibold" style={{ color: 'var(--ink)' }}>
            Plantillas ({templates.length})
          </div>
          <button
            onClick={openCreate}
            className="w-7 h-7 flex items-center justify-center rounded-[6px] border-0"
            style={{ background: 'var(--accent)', color: 'var(--on-accent)' }}
          >
            <Plus size={14} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto py-2">
          {templates.length === 0 && (
            <EmptyState
              icon={<Mail size={24} />}
              title="Todavía no hay plantillas"
              hint="Guardá tus mensajes de contacto para reutilizarlos y personalizarlos por prospecto."
              action={{ label: 'Nueva plantilla', onClick: openCreate }}
              compact
            />
          )}
          {templates.map(t => (
            <button
              key={t.id}
              onClick={() => { setSelected(t); setEditing(false); setCreating(false); }}
              className="w-full text-left px-4 py-3 transition-colors"
              style={{
                background: selected?.id === t.id ? 'var(--surface)' : 'transparent',
                borderLeft: selected?.id === t.id ? '3px solid var(--accent)' : '3px solid transparent',
              }}
            >
              <div className="text-[13px] font-medium truncate" style={{ color: 'var(--ink)' }}>{t.name}</div>
              {t.use_case && <div className="text-[11px] truncate mt-[2px]" style={{ color: 'var(--ink-4)' }}>{t.use_case}</div>}
            </button>
          ))}
        </div>
      </div>

      {/* Right: detail / form */}
      <div className="flex-1 min-w-0 overflow-y-auto">
        {/* Create form */}
        {creating && (
          <TemplateForm
            title="Nueva plantilla"
            draft={draft}
            setDraft={setDraft}
            saving={saving}
            onSave={handleSave}
            onCancel={() => setCreating(false)}
          />
        )}

        {/* Edit form */}
        {editing && selected && (
          <TemplateForm
            title="Editar plantilla"
            draft={draft}
            setDraft={setDraft}
            saving={saving}
            onSave={handleSave}
            onCancel={() => setEditing(false)}
          />
        )}

        {/* View */}
        {!creating && !editing && selected && (
          <div className="p-6 max-w-[700px]">
            <div className="flex items-start justify-between mb-3 gap-3">
              <div>
                <h2 className="text-[18px] font-bold" style={{ color: 'var(--ink)' }}>{selected.name}</h2>
                {selected.use_case && <p className="text-[13px] mt-1" style={{ color: 'var(--ink-3)' }}>{selected.use_case}</p>}
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button onClick={() => copyToClipboard(selected)}
                  className="h-8 px-3 rounded-[7px] text-[12px] flex items-center gap-1 border-0 font-medium"
                  style={{ background: copied === selected.id ? 'var(--sem-green-bg)' : 'var(--bg-3)', color: copied === selected.id ? 'var(--sem-green-dark)' : 'var(--ink-2)' }}>
                  {copied === selected.id ? <><Check size={13} /> Copiado</> : <><Copy size={13} /> Copiar</>}
                </button>
                <button onClick={() => openEdit(selected)}
                  className="h-8 px-3 rounded-[7px] text-[12px] flex items-center gap-1 border-0"
                  style={{ background: 'var(--bg-3)', color: 'var(--ink-2)' }}>
                  <Edit2 size={13} /> Editar
                </button>
                <button onClick={() => handleDelete(selected)}
                  className="h-8 px-3 rounded-[7px] text-[12px] flex items-center gap-1 border-0"
                  style={{ background: 'var(--bg-3)', color: 'var(--sem-red)' }}>
                  <Trash2 size={13} />
                </button>
              </div>
            </div>

            {/* Prospect selector for preview */}
            {prospects.length > 0 && (
              <div className="flex items-center gap-2 mb-4 p-3 rounded-[8px]" style={{ background: 'var(--bg-2)', border: '1px solid var(--line)' }}>
                <span className="text-[12px]" style={{ color: 'var(--ink-3)' }}>Previsualizar con:</span>
                <select value={previewProspectId} onChange={e => { setPreviewProspectId(e.target.value); setPreviewTab('preview'); }}
                  className="flex-1 h-7 px-2 rounded-[5px] text-[12px] outline-none"
                  style={{ border: '1px solid var(--line)', background: 'var(--surface)', color: 'var(--ink)', fontFamily: 'var(--font)' }}>
                  <option value="">— Variables sin reemplazar —</option>
                  {prospects.map(p => <option key={p.id} value={p.id}>{p.company}{p.contact_name ? ` · ${p.contact_name}` : ''}</option>)}
                </select>
                {previewProspectId && (
                  <button onClick={() => { setPreviewProspectId(''); setPreviewTab('template'); }}
                    className="text-[11px] border-0 bg-transparent" style={{ color: 'var(--ink-4)' }}>✕ limpiar</button>
                )}
              </div>
            )}

            {/* Tabs */}
            <div className="flex gap-0 mb-4" style={{ borderBottom: '1px solid var(--line)' }}>
              {([['template', 'Plantilla'], ['preview', 'Vista previa']] as ['template' | 'preview', string][]).map(([id, label]) => (
                <button key={id} onClick={() => setPreviewTab(id)}
                  className="px-4 py-2 text-[13px] border-0 bg-transparent"
                  style={{ color: previewTab === id ? 'var(--ink)' : 'var(--ink-3)', borderBottom: previewTab === id ? '2px solid var(--accent)' : '2px solid transparent', fontWeight: previewTab === id ? 600 : 400, marginBottom: -1 }}>
                  {label}
                </button>
              ))}
            </div>

            {selected.subject && (
              <div className="mb-4 p-3 rounded-[8px]" style={{ background: 'var(--bg-2)', border: '1px solid var(--line)' }}>
                <div className="text-[11px] font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--ink-4)' }}>Asunto</div>
                <div className="text-[14px] font-medium" style={{ color: 'var(--ink)' }}>
                  {previewTab === 'preview' ? fillTemplate(selected.subject, previewProspect) : selected.subject}
                </div>
              </div>
            )}

            {selected.body && (
              <div className="p-4 rounded-[8px] whitespace-pre-wrap text-[13.5px] leading-relaxed" style={{ background: 'var(--surface)', border: '1px solid var(--line)', color: 'var(--ink-2)' }}>
                {previewTab === 'preview' ? fillTemplate(selected.body, previewProspect) : selected.body}
              </div>
            )}
          </div>
        )}

        {/* Empty state */}
        {!creating && !editing && !selected && (
          <div className="flex flex-col items-center justify-center h-full text-center px-8">
            <div className="text-[40px] mb-3">📧</div>
            <div className="text-[15px] font-medium mb-1" style={{ color: 'var(--ink)' }}>Plantillas de email</div>
            <div className="text-[13px] max-w-[280px]" style={{ color: 'var(--ink-3)' }}>
              Selecciona una plantilla de la lista o crea una nueva para tus campañas de prospección.
            </div>
            <button
              onClick={openCreate}
              className="mt-4 h-8 px-4 rounded-[8px] text-[13px] font-medium border-0"
              style={{ background: 'var(--accent)', color: 'var(--on-accent)' }}
            >
              + Nueva plantilla
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function TemplateForm({
  title, draft, setDraft, saving, onSave, onCancel,
}: {
  title: string;
  draft: Partial<EmailTemplate>;
  setDraft: React.Dispatch<React.SetStateAction<Partial<EmailTemplate>>>;
  saving: boolean;
  onSave: () => void;
  onCancel: () => void;
}) {
  const inp = "w-full h-8 px-3 rounded-[7px] text-[13px] outline-none";
  const inpStyle = { border: '1px solid var(--line)', background: 'var(--surface)', color: 'var(--ink)', fontFamily: 'var(--font)' };

  return (
    <div className="p-6 max-w-[700px]">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-[16px] font-semibold" style={{ color: 'var(--ink)' }}>{title}</h2>
        <button onClick={onCancel} className="border-0 bg-transparent" style={{ color: 'var(--ink-4)' }}><X size={16} /></button>
      </div>
      <div className="flex flex-col gap-4">
        <div>
          <label className="text-[12px] font-medium mb-1 block" style={{ color: 'var(--ink-2)' }}>Nombre *</label>
          <input value={draft.name ?? ''} onChange={e => setDraft(d => ({ ...d, name: e.target.value }))}
            placeholder="Ej: Intro Frío" className={inp} style={inpStyle} />
        </div>
        <div>
          <label className="text-[12px] font-medium mb-1 block" style={{ color: 'var(--ink-2)' }}>Caso de uso</label>
          <input value={draft.use_case ?? ''} onChange={e => setDraft(d => ({ ...d, use_case: e.target.value }))}
            placeholder="Ej: Primer contacto sin relación previa" className={inp} style={inpStyle} />
        </div>
        <div>
          <label className="text-[12px] font-medium mb-1 block" style={{ color: 'var(--ink-2)' }}>Asunto / Hook</label>
          <input value={draft.subject ?? ''} onChange={e => setDraft(d => ({ ...d, subject: e.target.value }))}
            placeholder="Línea de asunto del email" className={inp} style={inpStyle} />
        </div>
        <div>
          <label className="text-[12px] font-medium mb-1 block" style={{ color: 'var(--ink-2)' }}>Cuerpo del email</label>
          <textarea
            value={draft.body ?? ''}
            onChange={e => setDraft(d => ({ ...d, body: e.target.value }))}
            placeholder="Escribe el cuerpo del email. Usa [Nombre], [empresa], etc. para personalizar."
            rows={12}
            className="w-full px-3 py-2 rounded-[7px] text-[13px] outline-none resize-y"
            style={{ ...inpStyle, height: 240 }}
          />
        </div>
        <div className="flex gap-2">
          <button
            onClick={onSave}
            disabled={saving || !draft.name?.trim()}
            className="h-8 px-4 rounded-[7px] text-[13px] font-medium border-0"
            style={{ background: 'var(--accent)', color: 'var(--on-accent)', opacity: saving || !draft.name?.trim() ? 0.5 : 1 }}
          >
            {saving ? 'Guardando…' : 'Guardar'}
          </button>
          <button onClick={onCancel}
            className="h-8 px-3 rounded-[7px] text-[13px] border-0"
            style={{ background: 'var(--bg-3)', color: 'var(--ink-2)' }}>
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
