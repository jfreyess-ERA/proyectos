'use client';
import { useState, useEffect, useCallback } from 'react';
import { X, Plus, Trash2, ExternalLink, Mail, Phone, ChevronDown, Pencil } from 'lucide-react';
import {
  updateProspect, fetchProspect,
  fetchInteractions, insertInteraction, updateInteraction, deleteInteractionWithPendingTasks,
  fetchCrmTasks, insertCrmTask, updateCrmTask, deleteCrmTask,
  fetchCrmTriggers, insertCrmTrigger, updateCrmTrigger,
} from '@/lib/db';
import type {
  Prospect, ProspectStatus, ProspectStage, ProspectPriority,
  CrmInteraction, CrmTask, CrmTrigger, InteractionChannel,
  CrmTaskType, CrmTaskStatus, TriggerType, ResponseType,
  PlaybookNode, PlaybookEdge,
} from '@/lib/types';
import { RESPONSE_LABELS } from '@/lib/types';
import { useToast } from '@/lib/toast-context';
import { PlaybookPanel, validResponses, edgeTarget, anchorHint } from './PlaybookPanel';
import { PRIORITY_STYLE, STATUS_STYLE, STAGE_STYLE } from './ProspectsView';
import {
  channelEs, outcomeEs, stageEs, statusEs, priorityEs, taskTypeEs, taskStatusEs, triggerTypeEs,
  OUTCOME_FROM_RESPONSE, STAGE_FROM_RESPONSE,
} from '@/lib/crm-labels';

const STAGES: ProspectStage[] = ['New', 'Contacted', 'Meeting Requested', 'Meeting Held', 'Proposal', 'Negotiation', 'Won'];
const STATUSES: ProspectStatus[] = ['Active', 'Warm', 'Paused', 'Nurture', 'Closed Won', 'Closed Lost', 'Dormant'];
const PRIORITIES: ProspectPriority[] = ['High', 'Medium', 'Low', 'Strategic', 'Watchlist'];
const CHANNELS: InteractionChannel[] = ['Email', 'LinkedIn', 'Phone', 'WhatsApp', 'Meeting', 'Event', 'Referral'];
const TASK_TYPES: CrmTaskType[] = ['Follow-up', 'Research', 'Send case study', 'Call', 'Meeting', 'Reconnect', 'Proposal'];
const TASK_STATUSES: CrmTaskStatus[] = ['Pending', 'In Progress', 'Waiting', 'Done', 'Deferred', 'Cancelled'];
const TRIGGER_TYPES: TriggerType[] = ['News', 'Hiring', 'Expansion', 'Regulation', 'Leadership change', 'Earnings', 'Results'];

/**
 * meeting_at se guarda en ISO (UTC) pero <input type="datetime-local"> trabaja en
 * hora local: sin convertir, el campo se repinta corrido por el offset horario.
 */
function isoToLocalInput(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

const POSTPONE_REASONS = ['Reestructuración interna', 'Proceso de consultoría vigente', 'Contingencia del mercado', 'Motivos internacionales', 'Otro'];
const OBJECTION_REASONS = ['Sin presupuesto', 'Prioridades distintas', 'Ya lo hacen internamente', 'Proveedor actual', 'No ve valor', 'Otro'];
// Motivo/detalle contextual según el tipo de respuesta
const REASONS_BY_RESPONSE: Partial<Record<ResponseType, string[]>> = {
  mas_adelante:       POSTPONE_REASONS,
  nueva_postergacion: POSTPONE_REASONS,
  objecion:           OBJECTION_REASONS,
};

import type { Project } from '@/lib/types';

interface Props {
  prospect: Prospect | null;
  onClose: () => void;
  onUpdated: (p: Prospect) => void;
  onDeleted: (id: string) => void;
  projects?: Project[];
  playbookNodes?: PlaybookNode[];
  playbookEdges?: PlaybookEdge[];
}

type Tab = 'info' | 'interactions' | 'tasks' | 'triggers' | 'timeline';

function Sel({ value, onChange, options, placeholder, render }: { value: string; onChange: (v: string) => void; options: string[]; placeholder?: string; render?: (v: string) => string }) {
  return (
    <div className="relative inline-flex items-center">
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="h-6 pl-2 pr-6 rounded-[5px] text-[12px] border-0 outline-none appearance-none"
        style={{ background: 'var(--bg-3)', color: 'var(--ink)', fontFamily: 'var(--font)' }}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map(o => <option key={o} value={o}>{render ? render(o) : o}</option>)}
      </select>
      <ChevronDown size={10} className="absolute right-1 pointer-events-none" style={{ color: 'var(--ink-4)' }} />
    </div>
  );
}

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-4 py-[7px]" style={{ borderBottom: '1px solid var(--line)' }}>
      <div className="w-[120px] flex-shrink-0 text-[12px] pt-[1px]" style={{ color: 'var(--ink-3)' }}>{label}</div>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}

function EditableText({ value, onSave, placeholder, multiline }: {
  value?: string; onSave: (v: string) => void; placeholder?: string; multiline?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? '');
  useEffect(() => { setDraft(value ?? ''); }, [value]);
  const commit = () => { setEditing(false); onSave(draft); };
  if (editing) {
    if (multiline) return (
      <textarea
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={commit}
        autoFocus
        rows={3}
        className="w-full text-[13px] px-2 py-1 rounded-[5px] outline-none resize-none"
        style={{ border: '1px solid var(--accent)', background: 'var(--surface)', color: 'var(--ink)', fontFamily: 'var(--font)' }}
      />
    );
    return (
      <input
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') { setEditing(false); setDraft(value ?? ''); } }}
        autoFocus
        className="w-full text-[13px] px-2 py-[2px] rounded-[5px] outline-none"
        style={{ border: '1px solid var(--accent)', background: 'var(--surface)', color: 'var(--ink)', fontFamily: 'var(--font)' }}
      />
    );
  }
  return (
    <span
      onClick={() => setEditing(true)}
      className="cursor-text text-[13px] rounded-[4px] px-1 -mx-1 transition-colors block"
      style={{ color: value ? 'var(--ink)' : 'var(--ink-4)', minHeight: 20 }}
      onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-3)')}
      onMouseLeave={e => (e.currentTarget.style.background = '')}
    >
      {value || placeholder || '—'}
    </span>
  );
}

export function ProspectDetail({ prospect, onClose, onUpdated, onDeleted, projects = [], playbookNodes = [], playbookEdges = [] }: Props) {
  const { deleteWithUndo } = useToast();
  const [tab, setTab] = useState<Tab>('info');
  const [interactions, setInteractions] = useState<CrmInteraction[]>([]);
  const [tasks, setTasks] = useState<CrmTask[]>([]);
  const [triggers, setTriggers] = useState<CrmTrigger[]>([]);
  const [saving, setSaving] = useState(false);

  // New / edit interaction form. editingIntId != null ⇒ estamos editando una
  // interacción existente (sólo campos descriptivos; no se re-dispara la cadencia).
  const [newIntForm, setNewIntForm] = useState(false);
  const [editingIntId, setEditingIntId] = useState<string | null>(null);
  const [intDraft, setIntDraft] = useState<Partial<CrmInteraction>>({ date: new Date().toISOString().slice(0, 10) });
  const [playbookHint, setPlaybookHint] = useState<string | null>(null);
  const [reconnectPreset, setReconnectPreset] = useState<number | null>(null);

  // New task form
  const [newTaskForm, setNewTaskForm] = useState(false);
  const [taskDraft, setTaskDraft] = useState<Partial<CrmTask>>({});

  // New trigger form
  const [newTriggerForm, setNewTriggerForm] = useState(false);
  const [triggerDraft, setTriggerDraft] = useState<Partial<CrmTrigger>>({ date_detected: new Date().toISOString().slice(0, 10) });

  const reload = useCallback(async (id: string) => {
    const [i, t, tr] = await Promise.all([
      fetchInteractions(id),
      fetchCrmTasks(id),
      fetchCrmTriggers(id),
    ]);
    setInteractions(i);
    setTasks(t);
    setTriggers(tr);
  }, []);

  useEffect(() => {
    if (prospect) {
      setTab('info');
      reload(prospect.id);
    }
  }, [prospect?.id, reload]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!prospect) return null;

  // Respuestas que ofrece el selector: las del nodo actual (el guion) primero,
  // y las iniciales después, porque el cliente siempre puede salirse del guion.
  const currentNode = prospect.playbook_node
    ? playbookNodes.find(n => n.node_key === prospect.playbook_node)
    : undefined;
  const responseOptions = validResponses(prospect, playbookEdges);

  // Qué fecha hay que pedir la decide el ancla del nodo al que lleva la respuesta
  // elegida, no una lista de respuestas hardcodeada.
  const targetNode = intDraft.response_type
    ? playbookNodes.find(n => n.node_key === edgeTarget(prospect, playbookEdges, intDraft.response_type!))
    : undefined;
  const needsMeeting   = targetNode?.anchor === 'meeting'   && !prospect.meeting_at;
  const needsReconnect = targetNode?.anchor === 'reconnect';

  async function save(fields: Partial<Omit<Prospect, 'id' | 'created_at'>>) {
    if (!prospect) return;
    setSaving(true);
    try {
      const updated = await updateProspect(prospect.id, fields);
      onUpdated(updated);
    } finally {
      setSaving(false);
    }
  }

  // El borrado real lo hace la página con deshacer (toast). Acá solo señalizamos y cerramos.
  function handleDelete() {
    if (!prospect) return;
    onDeleted(prospect.id);
    onClose();
  }

  function resetIntForm() {
    setNewIntForm(false);
    setEditingIntId(null);
    setIntDraft({ date: new Date().toISOString().slice(0, 10) });
    setReconnectPreset(null);
  }

  function startEditInteraction(i: CrmInteraction) {
    setEditingIntId(i.id);
    setIntDraft({ ...i });
    setNewIntForm(true);
  }

  // Deshacer, mismo patrón que tareas/prospectos: se oculta al instante y el
  // DELETE real (con la cascada a sus tareas pendientes) recién corre si expira
  // la ventana sin deshacer. Mientras tanto las tareas siguen visibles en su
  // pestaña — todavía no se borraron.
  function requestDeleteInteraction(i: CrmInteraction) {
    setInteractions(prev => prev.filter(x => x.id !== i.id));
    deleteWithUndo({
      message: `Interacción "${i.type || channelEs(i.channel) || 'sin tipo'}" eliminada`,
      onCommit: async () => {
        await deleteInteractionWithPendingTasks(i.id);
        if (prospect) await reload(prospect.id);
      },
      onUndo: () => {
        setInteractions(prev => [...prev, i].sort((a, b) => b.date.localeCompare(a.date)));
      },
    });
  }

  // La etapa sólo avanza (nunca retrocede). Registrar cualquier interacción en un
  // prospecto "New" ya lo lleva como mínimo a "Contacted"; una respuesta de
  // cadencia puede empujarlo más lejos, y un canal "Meeting" marca reunión hecha.
  function nextStage(current: ProspectStage): ProspectStage {
    let target: ProspectStage = current === 'New' ? 'Contacted' : current;
    if (intDraft.response_type && STAGE_FROM_RESPONSE[intDraft.response_type]) {
      target = STAGE_FROM_RESPONSE[intDraft.response_type];
    }
    if (intDraft.channel === 'Meeting') target = 'Meeting Held';
    // Sólo hacia adelante.
    return STAGES.indexOf(target) > STAGES.indexOf(current) ? target : current;
  }

  async function submitInteraction() {
    if (!prospect || !intDraft.date) return;

    // Editar: sólo actualiza los campos descriptivos. No re-dispara la cadencia
    // (la respuesta ya generó sus tareas cuando se registró por primera vez).
    if (editingIntId) {
      await updateInteraction(editingIntId, {
        date: intDraft.date,
        channel: intDraft.channel,
        type: intDraft.type,
        summary: intDraft.summary,
        next_step: intDraft.next_step,
        follow_up_due: intDraft.follow_up_due,
      });
      resetIntForm();
      await reload(prospect.id);
      return;
    }

    // El outcome ya no se pide a mano: se deriva de la respuesta de cadencia.
    const derivedOutcome = intDraft.response_type
      ? OUTCOME_FROM_RESPONSE[intDraft.response_type]
      : intDraft.outcome;

    await insertInteraction({
      prospect_id: prospect.id,
      date: intDraft.date,
      channel: intDraft.channel,
      direction: intDraft.direction,
      type: intDraft.type,
      summary: intDraft.summary,
      outcome: derivedOutcome,
      next_step: intDraft.next_step,
      follow_up_due: intDraft.follow_up_due,
      trigger_mentioned: intDraft.trigger_mentioned ?? false,
      response_type: intDraft.response_type,
      response_detail: intDraft.response_detail,
      meeting_at: intDraft.meeting_at,
      reconnect_at: intDraft.reconnect_at,
    });

    // Auto-avance de etapa (sólo hacia adelante), antes de resetear el draft.
    const stageTarget = nextStage(prospect.stage);
    resetIntForm();
    await reload(prospect.id);

    if (stageTarget !== prospect.stage) {
      const updated = await updateProspect(prospect.id, { stage: stageTarget });
      onUpdated(updated);
    }

    // Con tipo de respuesta el trigger ya avanzó la cadencia del lado del servidor:
    // hay que releer el prospecto para que el panel muestre el nodo nuevo.
    if (intDraft.response_type) {
      const fresh = await fetchProspect(prospect.id);
      if (fresh) onUpdated(fresh);
      const node = fresh?.playbook_node
        ? playbookNodes.find(n => n.node_key === fresh.playbook_node)
        : undefined;
      setPlaybookHint(
        node
          ? `Cadencia → “${node.label}”. Se generaron ${node.tasks.length} tarea${node.tasks.length > 1 ? 's' : ''} en la pestaña Tareas.`
          : 'Se registró la respuesta y el sistema generó la próxima tarea según la cadencia.',
      );
      setTimeout(() => setPlaybookHint(null), 6000);
    }
  }

  async function submitTask() {
    if (!prospect || !taskDraft.task_type) return;
    const created = await insertCrmTask({
      prospect_id: prospect.id,
      task_type: taskDraft.task_type,
      priority: taskDraft.priority ?? 'Medium',
      status: 'Pending',
      due_date: taskDraft.due_date,
      notes: taskDraft.notes,
    });
    setTasks(prev => [created, ...prev]);
    setNewTaskForm(false);
    setTaskDraft({});
  }

  async function submitTrigger() {
    if (!prospect || !triggerDraft.trigger_type) return;
    const created = await insertCrmTrigger({
      prospect_id: prospect.id,
      date_detected: triggerDraft.date_detected ?? new Date().toISOString().slice(0, 10),
      trigger_type: triggerDraft.trigger_type,
      description: triggerDraft.description,
      source_url: triggerDraft.source_url,
      priority: triggerDraft.priority ?? 'Medium',
      action_suggested: triggerDraft.action_suggested,
      status: 'Open',
    });
    setTriggers(prev => [created, ...prev]);
    setNewTriggerForm(false);
    setTriggerDraft({ date_detected: new Date().toISOString().slice(0, 10) });
  }

  const priStyle  = PRIORITY_STYLE[prospect.priority] ?? PRIORITY_STYLE['Medium'];
  const statStyle = STATUS_STYLE[prospect.status] ?? STATUS_STYLE['Active'];
  const today = new Date().toISOString().slice(0, 10);

  const pendingTaskCount = tasks.filter(t => t.status === 'Pending' || t.status === 'In Progress').length;
  const overdueTaskCount = tasks.filter(t => (t.status === 'Pending' || t.status === 'In Progress') && t.due_date && t.due_date < today).length;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6"
      style={{ background: 'rgba(0,0,0,0.35)' }}
      onClick={onClose}
    >
      {/* Modal grande centrado */}
      <div
        className="flex flex-col overflow-hidden w-full"
        onClick={e => e.stopPropagation()}
        style={{
          maxWidth: 1000,
          height: '90vh',
          background: 'var(--bg)',
          border: '1px solid var(--line)',
          borderRadius: 14,
          boxShadow: '0 12px 48px rgba(0,0,0,0.22)',
        }}
      >
        {/* Header */}
        <div className="flex items-start justify-between px-5 pt-4 pb-3 flex-shrink-0" style={{ borderBottom: '1px solid var(--line)' }}>
          <div className="flex-1 min-w-0">
            <EditableText
              value={prospect.company}
              onSave={v => save({ company: v })}
              placeholder="Nombre empresa"
            />
            <div className="mt-1 flex items-center gap-2 flex-wrap">
              <Sel value={prospect.status} onChange={v => save({ status: v as ProspectStatus })} options={STATUSES} render={statusEs} />
              <Sel value={prospect.priority} onChange={v => save({ priority: v as ProspectPriority })} options={PRIORITIES} render={priorityEs} />
              {saving && <span className="text-[11px]" style={{ color: 'var(--ink-4)' }}>Guardando…</span>}
            </div>
          </div>
          <div className="flex items-center gap-1 ml-3 flex-shrink-0">
            <button
              onClick={() => { setTab('interactions'); resetIntForm(); setNewIntForm(true); }}
              className="h-7 px-3 rounded-[6px] text-[12px] font-medium border-0 flex items-center gap-1 flex-shrink-0"
              style={{ background: 'var(--accent)', color: 'var(--on-accent)' }}
              title="Registrar una interacción"
            >
              <Plus size={13} /> Registrar interacción
            </button>
            {(prospect.stage === 'Won' || prospect.status === 'Closed Won') && (
              <a
                href={`/viabilidad/index.html?prospect_id=${prospect.id}&prospect_name=${encodeURIComponent(prospect.company)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="h-7 px-2 rounded-[6px] text-[11.5px] font-medium border-0 flex items-center gap-1 no-underline flex-shrink-0"
                style={{ background: 'var(--accent)', color: 'var(--on-accent)' }}
                title="Abrir análisis de viabilidad"
              >
                📊 Viabilidad
              </a>
            )}
            <button
              onClick={handleDelete}
              className="w-7 h-7 flex items-center justify-center rounded-[6px] border-0 bg-transparent transition-colors"
              style={{ color: 'var(--ink-4)' }}
              title="Eliminar prospecto"
            >
              <Trash2 size={14} />
            </button>
            <button
              onClick={onClose}
              className="w-7 h-7 flex items-center justify-center rounded-[6px] border-0 bg-transparent transition-colors"
              style={{ color: 'var(--ink-4)' }}
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Stage progress */}
        <div className="px-5 py-3 flex-shrink-0" style={{ borderBottom: '1px solid var(--line)', background: 'var(--bg-2)' }}>
          {/* Solo lectura: la etapa avanza sola al registrar interacciones
              (ver nextStage). No se clickea, para no pisar la automatización. */}
          <div className="flex items-center gap-0">
            {STAGES.map((s, i) => {
              const stageIdx = STAGES.indexOf(prospect.stage);
              const isDone = i < stageIdx;
              const isCurrent = i === stageIdx;
              return (
                <div
                  key={s}
                  className="flex-1 flex flex-col items-center gap-[3px]"
                  title={stageEs(s)}
                >
                  <div
                    className="w-full h-[4px] rounded-full transition-all"
                    style={{ background: isDone || isCurrent ? STAGE_STYLE[s] : 'var(--bg-3)' }}
                  />
                  <span
                    className="text-[9.5px] font-medium whitespace-nowrap hidden sm:block"
                    style={{ color: isCurrent ? STAGE_STYLE[s] : isDone ? 'var(--ink-3)' : 'var(--ink-4)' }}
                  >
                    {stageEs(s)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Quick stats */}
        <div className="flex gap-0 flex-shrink-0" style={{ borderBottom: '1px solid var(--line)', background: 'var(--bg-2)' }}>
          {[
            { label: 'Interacciones', value: interactions.length, color: 'var(--ink)' },
            { label: 'Tareas activas', value: pendingTaskCount, color: overdueTaskCount > 0 ? 'var(--sem-red)' : 'var(--ink)' },
            { label: 'Triggers abiertos', value: triggers.filter(t => t.status === 'Open').length, color: 'var(--ink)' },
          ].map(stat => (
            <div key={stat.label} className="flex-1 text-center py-2 px-3" style={{ borderRight: '1px solid var(--line)' }}>
              <div className="text-[18px] font-bold tabular-nums" style={{ color: stat.color }}>{stat.value}</div>
              <div className="text-[10px]" style={{ color: 'var(--ink-4)' }}>{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-0 flex-shrink-0 px-5 pt-2 overflow-x-auto" style={{ borderBottom: '1px solid var(--line)' }}>
          {([
            ['info', 'Información'],
            ['interactions', `Interacciones (${interactions.length})`],
            ['tasks', `Tareas (${tasks.length})`],
            ['triggers', `Triggers (${triggers.filter(t => t.status === 'Open').length})`],
            ['timeline', 'Línea de tiempo'],
          ] as [Tab, string][]).map(([id, label]) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className="px-3 py-[8px] text-[13px] border-0 bg-transparent transition-colors whitespace-nowrap"
              style={{
                color: tab === id ? 'var(--ink)' : 'var(--ink-3)',
                borderBottom: tab === id ? '2px solid var(--accent)' : '2px solid transparent',
                fontWeight: tab === id ? 600 : 400,
                marginBottom: -1,
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5">
          {tab === 'info' && (
            <div>
              {playbookNodes.length > 0 && (
                <div className="mb-4">
                  <PlaybookPanel prospect={prospect} nodes={playbookNodes} edges={playbookEdges} />
                </div>
              )}
              <FieldRow label="Contacto">
                <EditableText value={prospect.contact_name} onSave={v => save({ contact_name: v })} placeholder="Nombre contacto" />
              </FieldRow>
              <FieldRow label="Cargo">
                <EditableText value={prospect.role} onSave={v => save({ role: v })} placeholder="Cargo / rol" />
              </FieldRow>
              <FieldRow label="Email">
                <div className="flex items-center gap-2">
                  <EditableText value={prospect.email} onSave={v => save({ email: v })} placeholder="email@empresa.com" />
                  {prospect.email && (
                    <a href={`mailto:${prospect.email}`} className="flex-shrink-0" style={{ color: 'var(--accent)' }}>
                      <Mail size={13} />
                    </a>
                  )}
                </div>
              </FieldRow>
              <FieldRow label="Teléfono">
                <div className="flex items-center gap-2">
                  <EditableText value={prospect.phone} onSave={v => save({ phone: v })} placeholder="+56 9 XXXX XXXX" />
                  {prospect.phone && (
                    <a href={`tel:${prospect.phone}`} className="flex-shrink-0" style={{ color: 'var(--accent)' }}>
                      <Phone size={13} />
                    </a>
                  )}
                </div>
              </FieldRow>
              <FieldRow label="LinkedIn">
                <div className="flex items-center gap-2">
                  <EditableText value={prospect.linkedin} onSave={v => save({ linkedin: v })} placeholder="linkedin.com/in/…" />
                  {prospect.linkedin && (
                    <a href={prospect.linkedin} target="_blank" rel="noreferrer" className="flex-shrink-0 text-[11px] font-medium" style={{ color: 'var(--accent)' }}>
                      LI ↗
                    </a>
                  )}
                </div>
              </FieldRow>
              <FieldRow label="Industria">
                <EditableText value={prospect.industry} onSave={v => save({ industry: v })} placeholder="Industria" />
              </FieldRow>
              <FieldRow label="Subsector">
                <EditableText value={prospect.subsector} onSave={v => save({ subsector: v })} placeholder="Subsector" />
              </FieldRow>
              <FieldRow label="País">
                <EditableText value={prospect.country} onSave={v => save({ country: v })} placeholder="País" />
              </FieldRow>
              <FieldRow label="Fuente">
                <EditableText value={prospect.source} onSave={v => save({ source: v })} placeholder="¿Cómo llegó este lead?" />
              </FieldRow>
              <FieldRow label="Dolores">
                <EditableText value={prospect.pain_points} onSave={v => save({ pain_points: v })} placeholder="Principales dolores detectados" multiline />
              </FieldRow>
              <FieldRow label="Ángulo ERA">
                <EditableText value={prospect.era_value_angle} onSave={v => save({ era_value_angle: v })} placeholder="Por qué ERA Group es relevante para esta empresa" multiline />
              </FieldRow>
              <FieldRow label="Trigger notes">
                <EditableText value={prospect.trigger_notes} onSave={v => save({ trigger_notes: v })} placeholder="Notas sobre trigger(s) detectados" multiline />
              </FieldRow>
              <FieldRow label="Mes reactivar">
                <EditableText value={prospect.reconnect_month} onSave={v => save({ reconnect_month: v })} placeholder="ej. Marzo 2026" />
              </FieldRow>
              <FieldRow label="Notas">
                <EditableText value={prospect.notes} onSave={v => save({ notes: v })} placeholder="Notas generales…" multiline />
              </FieldRow>

              {projects.length > 0 && (
                <FieldRow label="Proyecto">
                  <div className="flex items-center gap-2">
                    <select
                      value={prospect.project_id ?? ''}
                      onChange={e => save({ project_id: e.target.value || undefined })}
                      className="flex-1 h-7 px-2 rounded-[5px] text-[12px] outline-none"
                      style={{ border: '1px solid var(--line)', background: 'var(--surface)', color: 'var(--ink)', fontFamily: 'var(--font)' }}
                    >
                      <option value="">— Ninguno —</option>
                      {projects.map(p => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                    {prospect.project_id && (
                      <span
                        className="w-3 h-3 rounded-[3px] flex-shrink-0"
                        style={{ background: projects.find(p => p.id === prospect.project_id)?.color ?? 'var(--ink-4)' }}
                      />
                    )}
                  </div>
                  <div className="text-[11px] mt-1" style={{ color: 'var(--ink-4)' }}>
                    Vincula este prospecto a un proyecto cuando se convierta en cliente
                  </div>
                </FieldRow>
              )}
            </div>
          )}

          {tab === 'interactions' && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="text-[12px]" style={{ color: 'var(--ink-3)' }}>{interactions.length} interacciones</div>
                {!newIntForm && (
                  <button
                    onClick={() => { resetIntForm(); setNewIntForm(true); }}
                    className="h-7 px-3 rounded-[6px] text-[12px] font-medium flex items-center gap-1 border-0"
                    style={{ background: 'var(--accent)', color: 'var(--on-accent)' }}
                  >
                    <Plus size={13} />
                    Registrar interacción
                  </button>
                )}
              </div>

              {newIntForm && (
                <div className="mb-4 p-4 rounded-[10px]" style={{ background: 'var(--bg-2)', border: '1px solid var(--line)' }}>
                  <div className="text-[12px] font-semibold mb-3" style={{ color: 'var(--ink)' }}>
                    {editingIntId ? 'Editar interacción' : 'Nueva interacción'}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
                    <div>
                      <label className="text-[11px] mb-1 block" style={{ color: 'var(--ink-3)' }}>Fecha</label>
                      <input type="date" value={intDraft.date ?? ''} onChange={e => setIntDraft(d => ({ ...d, date: e.target.value }))}
                        className="w-full h-8 px-2 rounded-[6px] text-[13px] outline-none"
                        style={{ border: '1px solid var(--line)', background: 'var(--surface)', color: 'var(--ink)', fontFamily: 'var(--font)' }} />
                    </div>
                    <div>
                      <label className="text-[11px] mb-1 block" style={{ color: 'var(--ink-3)' }}>Canal</label>
                      <select value={intDraft.channel ?? ''} onChange={e => setIntDraft(d => ({ ...d, channel: e.target.value as InteractionChannel }))}
                        className="w-full h-8 px-2 rounded-[6px] text-[13px] outline-none"
                        style={{ border: '1px solid var(--line)', background: 'var(--surface)', color: 'var(--ink)', fontFamily: 'var(--font)' }}>
                        <option value="">— Canal —</option>
                        {CHANNELS.map(c => <option key={c} value={c}>{channelEs(c)}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-[11px] mb-1 block" style={{ color: 'var(--ink-3)' }}>Tipo</label>
                      <input value={intDraft.type ?? ''} onChange={e => setIntDraft(d => ({ ...d, type: e.target.value }))}
                        placeholder="Email intro, Seguimiento…"
                        className="w-full h-8 px-2 rounded-[6px] text-[13px] outline-none"
                        style={{ border: '1px solid var(--line)', background: 'var(--surface)', color: 'var(--ink)', fontFamily: 'var(--font)' }} />
                    </div>
                  </div>
                  {editingIntId ? (
                    <div className="mb-3 px-3 py-2 rounded-[8px] text-[11.5px]" style={{ background: 'var(--bg-3)', color: 'var(--ink-3)' }}>
                      Estás editando el registro. La respuesta y su cadencia no cambian desde acá.
                    </div>
                  ) : (
                  <div className="mb-3 p-2.5 rounded-[8px]" style={{ background: 'var(--bg-3)', border: '1px dashed var(--line)' }}>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[11px] mb-1 block" style={{ color: 'var(--ink-3)' }}>
                          ¿Qué respondió el prospecto?
                        </label>
                        <select value={intDraft.response_type ?? ''} onChange={e => setIntDraft(d => ({ ...d, response_type: (e.target.value || undefined) as ResponseType | undefined, response_detail: undefined }))}
                          className="w-full h-8 px-2 rounded-[6px] text-[13px] outline-none"
                          style={{ border: '1px solid var(--line)', background: 'var(--surface)', color: 'var(--ink)', fontFamily: 'var(--font)' }}>
                          <option value="">— Todavía nada / solo registro —</option>
                          {responseOptions.contextual.length > 0 && (
                            <optgroup label={currentNode ? 'Continúa la cadencia' : 'Respuesta'}>
                              {responseOptions.contextual.map(({ response }) => (
                                <option key={response} value={response}>
                                  {RESPONSE_LABELS[response]}
                                </option>
                              ))}
                            </optgroup>
                          )}
                          {responseOptions.initial.length > 0 && (
                            <optgroup label={currentNode ? 'Otra cosa (cambia de rama)' : 'Respuesta'}>
                              {responseOptions.initial.map(r => (
                                <option key={r} value={r}>{RESPONSE_LABELS[r]}</option>
                              ))}
                            </optgroup>
                          )}
                        </select>
                      </div>
                      {intDraft.response_type && REASONS_BY_RESPONSE[intDraft.response_type] && (
                        <div>
                          <label className="text-[11px] mb-1 block" style={{ color: 'var(--ink-3)' }}>Motivo</label>
                          <select value={intDraft.response_detail ?? ''} onChange={e => setIntDraft(d => ({ ...d, response_detail: e.target.value || undefined }))}
                            className="w-full h-8 px-2 rounded-[6px] text-[13px] outline-none"
                            style={{ border: '1px solid var(--line)', background: 'var(--surface)', color: 'var(--ink)', fontFamily: 'var(--font)' }}>
                            <option value="">— Motivo —</option>
                            {REASONS_BY_RESPONSE[intDraft.response_type]!.map(m => <option key={m} value={m}>{m}</option>)}
                          </select>
                        </div>
                      )}
                    </div>
                    {needsMeeting && (
                      <div className="mt-2">
                        <label className="text-[11px] mb-1 block" style={{ color: 'var(--ink-3)' }}>
                          Fecha y hora de la reunión <span style={{ color: 'var(--danger)' }}>·  los avisos se cuentan desde acá</span>
                        </label>
                        <input type="datetime-local" value={isoToLocalInput(intDraft.meeting_at)}
                          onChange={e => setIntDraft(d => ({ ...d, meeting_at: e.target.value ? new Date(e.target.value).toISOString() : null }))}
                          className="w-full h-8 px-2 rounded-[6px] text-[13px] outline-none"
                          style={{ border: '1px solid var(--line)', background: 'var(--surface)', color: 'var(--ink)', fontFamily: 'var(--font)' }} />
                      </div>
                    )}

                    {needsReconnect && (
                      <div className="mt-2">
                        <label className="text-[11px] mb-1 block" style={{ color: 'var(--ink-3)' }}>Recontactar en</label>
                        <div className="flex gap-2 flex-wrap items-center">
                          {[30, 90, 180].map(days => {
                            const active = reconnectPreset === days;
                            return (
                              <button key={days} type="button"
                                onClick={() => {
                                  // La fecha se calcula al hacer click, no en cada render.
                                  const iso = new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
                                  setReconnectPreset(days);
                                  setIntDraft(d => ({ ...d, reconnect_at: iso }));
                                }}
                                className="h-7 px-2.5 text-[12px] rounded-[6px] border transition-colors"
                                style={active
                                  ? { background: 'var(--accent-bg)', borderColor: 'var(--accent)', color: 'var(--accent)' }
                                  : { background: 'var(--surface)', borderColor: 'var(--line)', color: 'var(--ink-3)' }}>
                                {days} días
                              </button>
                            );
                          })}
                          <input type="date" value={intDraft.reconnect_at ?? ''}
                            onChange={e => { setReconnectPreset(null); setIntDraft(d => ({ ...d, reconnect_at: e.target.value || null })); }}
                            className="h-7 px-2 rounded-[6px] text-[12px] outline-none"
                            style={{ border: '1px solid var(--line)', background: 'var(--surface)', color: 'var(--ink)', fontFamily: 'var(--font)' }} />
                        </div>
                      </div>
                    )}

                    <p className="text-[10.5px] mt-1.5" style={{ color: 'var(--ink-4)' }}>
                      {targetNode
                        ? targetNode.tasks.length > 1
                          ? `Se van a crear ${targetNode.tasks.length} tareas con vencimiento ${anchorHint(targetNode)}.`
                          : `Se va a crear 1 tarea con vencimiento ${anchorHint(targetNode)}.`
                        : 'Al elegir qué respondió, el sistema crea solo la próxima tarea con su fecha según la cadencia.'}
                    </p>
                  </div>
                  )}
                  <div className="mb-3">
                    <label className="text-[11px] mb-1 block" style={{ color: 'var(--ink-3)' }}>Resumen</label>
                    <textarea value={intDraft.summary ?? ''} onChange={e => setIntDraft(d => ({ ...d, summary: e.target.value }))}
                      placeholder="¿Qué pasó en esta interacción?" rows={2}
                      className="w-full px-2 py-1 rounded-[6px] text-[13px] outline-none resize-none"
                      style={{ border: '1px solid var(--line)', background: 'var(--surface)', color: 'var(--ink)', fontFamily: 'var(--font)' }} />
                  </div>
                  {/* Próximo paso manual: sólo cuando NO hay respuesta de cadencia.
                      Si elegiste qué respondió, la tarea siguiente la genera el sistema. */}
                  {!intDraft.response_type && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                      <div>
                        <label className="text-[11px] mb-1 block" style={{ color: 'var(--ink-3)' }}>Próximo paso</label>
                        <input value={intDraft.next_step ?? ''} onChange={e => setIntDraft(d => ({ ...d, next_step: e.target.value }))}
                          placeholder="Acción siguiente"
                          className="w-full h-8 px-2 rounded-[6px] text-[13px] outline-none"
                          style={{ border: '1px solid var(--line)', background: 'var(--surface)', color: 'var(--ink)', fontFamily: 'var(--font)' }} />
                      </div>
                      <div>
                        <label className="text-[11px] mb-1 block" style={{ color: 'var(--ink-3)' }}>Recordar para</label>
                        <input type="date" value={intDraft.follow_up_due ?? ''} onChange={e => setIntDraft(d => ({ ...d, follow_up_due: e.target.value }))}
                          className="w-full h-8 px-2 rounded-[6px] text-[13px] outline-none"
                          style={{ border: '1px solid var(--line)', background: 'var(--surface)', color: 'var(--ink)', fontFamily: 'var(--font)' }} />
                      </div>
                    </div>
                  )}
                  <div className="flex gap-2">
                    <button onClick={submitInteraction}
                      className="h-7 px-4 rounded-[6px] text-[12px] font-medium border-0"
                      style={{ background: 'var(--accent)', color: 'var(--on-accent)' }}>
                      {editingIntId ? 'Guardar cambios' : 'Guardar'}
                    </button>
                    <button onClick={resetIntForm}
                      className="h-7 px-3 rounded-[6px] text-[12px] border-0"
                      style={{ background: 'var(--bg-3)', color: 'var(--ink-2)' }}>
                      Cancelar
                    </button>
                  </div>
                </div>
              )}

              {playbookHint && (
                <div className="mb-3 px-3 py-2 rounded-[8px] text-[12px]"
                  style={{ background: 'var(--accent)', color: 'var(--on-accent)' }}>
                  ✓ {playbookHint}
                </div>
              )}

              <div className="flex flex-col gap-2">
                {interactions.length === 0 && !newIntForm && (
                  <div className="text-[13px] text-center py-6" style={{ color: 'var(--ink-4)' }}>Sin interacciones aún</div>
                )}
                {interactions.map(i => (
                  <InteractionCard key={i.id} interaction={i}
                    onEdit={() => startEditInteraction(i)}
                    onDelete={() => requestDeleteInteraction(i)} />
                ))}
              </div>
            </div>
          )}

          {tab === 'tasks' && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="text-[12px]" style={{ color: 'var(--ink-3)' }}>
                  {tasks.filter(t => t.status === 'Pending' || t.status === 'In Progress').length} pendientes
                </div>
                <button
                  onClick={() => setNewTaskForm(v => !v)}
                  className="h-7 px-3 rounded-[6px] text-[12px] font-medium flex items-center gap-1 border-0"
                  style={{ background: 'var(--accent)', color: 'var(--on-accent)' }}
                >
                  <Plus size={13} />
                  Nueva tarea
                </button>
              </div>

              {newTaskForm && (
                <div className="mb-4 p-4 rounded-[10px]" style={{ background: 'var(--bg-2)', border: '1px solid var(--line)' }}>
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <div>
                      <label className="text-[11px] mb-1 block" style={{ color: 'var(--ink-3)' }}>Tipo de tarea *</label>
                      <select value={taskDraft.task_type ?? ''} onChange={e => setTaskDraft(d => ({ ...d, task_type: e.target.value as CrmTaskType }))}
                        className="w-full h-8 px-2 rounded-[6px] text-[13px] outline-none"
                        style={{ border: '1px solid var(--line)', background: 'var(--surface)', color: 'var(--ink)', fontFamily: 'var(--font)' }}>
                        <option value="">— Tipo —</option>
                        {TASK_TYPES.map(t => <option key={t} value={t}>{taskTypeEs(t)}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-[11px] mb-1 block" style={{ color: 'var(--ink-3)' }}>Fecha límite</label>
                      <input type="date" value={taskDraft.due_date ?? ''} onChange={e => setTaskDraft(d => ({ ...d, due_date: e.target.value }))}
                        className="w-full h-8 px-2 rounded-[6px] text-[13px] outline-none"
                        style={{ border: '1px solid var(--line)', background: 'var(--surface)', color: 'var(--ink)', fontFamily: 'var(--font)' }} />
                    </div>
                  </div>
                  <div className="mb-3">
                    <label className="text-[11px] mb-1 block" style={{ color: 'var(--ink-3)' }}>Notas</label>
                    <input value={taskDraft.notes ?? ''} onChange={e => setTaskDraft(d => ({ ...d, notes: e.target.value }))}
                      placeholder="Descripción de la tarea"
                      className="w-full h-8 px-2 rounded-[6px] text-[13px] outline-none"
                      style={{ border: '1px solid var(--line)', background: 'var(--surface)', color: 'var(--ink)', fontFamily: 'var(--font)' }} />
                  </div>
                  <div className="flex gap-2">
                    <button onClick={submitTask}
                      disabled={!taskDraft.task_type}
                      className="h-7 px-4 rounded-[6px] text-[12px] font-medium border-0"
                      style={{ background: 'var(--accent)', color: 'var(--on-accent)', opacity: taskDraft.task_type ? 1 : 0.5 }}>
                      Guardar
                    </button>
                    <button onClick={() => setNewTaskForm(false)}
                      className="h-7 px-3 rounded-[6px] text-[12px] border-0"
                      style={{ background: 'var(--bg-3)', color: 'var(--ink-2)' }}>
                      Cancelar
                    </button>
                  </div>
                </div>
              )}

              <div className="flex flex-col gap-2">
                {tasks.length === 0 && !newTaskForm && (
                  <div className="text-[13px] text-center py-6" style={{ color: 'var(--ink-4)' }}>Sin tareas CRM</div>
                )}
                {tasks.map(t => (
                  <CrmTaskCard
                    key={t.id}
                    task={t}
                    today={today}
                    onToggle={async () => {
                      const newStatus: CrmTaskStatus = t.status === 'Done' ? 'Pending' : 'Done';
                      await updateCrmTask(t.id, { status: newStatus, completed_date: newStatus === 'Done' ? today : undefined });
                      setTasks(prev => prev.map(x => x.id === t.id ? { ...x, status: newStatus } : x));
                    }}
                    onDelete={async () => {
                      await deleteCrmTask(t.id);
                      setTasks(prev => prev.filter(x => x.id !== t.id));
                    }}
                  />
                ))}
              </div>
            </div>
          )}

          {tab === 'timeline' && (
            <TimelineTab interactions={interactions} tasks={tasks} triggers={triggers} today={today} />
          )}

          {tab === 'triggers' && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="text-[12px]" style={{ color: 'var(--ink-3)' }}>
                  {triggers.filter(t => t.status === 'Open').length} abiertos
                </div>
                <button
                  onClick={() => setNewTriggerForm(v => !v)}
                  className="h-7 px-3 rounded-[6px] text-[12px] font-medium flex items-center gap-1 border-0"
                  style={{ background: 'var(--accent)', color: 'var(--on-accent)' }}
                >
                  <Plus size={13} />
                  Nuevo trigger
                </button>
              </div>

              {newTriggerForm && (
                <div className="mb-4 p-4 rounded-[10px]" style={{ background: 'var(--bg-2)', border: '1px solid var(--line)' }}>
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <div>
                      <label className="text-[11px] mb-1 block" style={{ color: 'var(--ink-3)' }}>Tipo *</label>
                      <select value={triggerDraft.trigger_type ?? ''} onChange={e => setTriggerDraft(d => ({ ...d, trigger_type: e.target.value as TriggerType }))}
                        className="w-full h-8 px-2 rounded-[6px] text-[13px] outline-none"
                        style={{ border: '1px solid var(--line)', background: 'var(--surface)', color: 'var(--ink)', fontFamily: 'var(--font)' }}>
                        <option value="">— Tipo —</option>
                        {TRIGGER_TYPES.map(t => <option key={t} value={t}>{triggerTypeEs(t)}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-[11px] mb-1 block" style={{ color: 'var(--ink-3)' }}>Fecha detectada</label>
                      <input type="date" value={triggerDraft.date_detected ?? ''} onChange={e => setTriggerDraft(d => ({ ...d, date_detected: e.target.value }))}
                        className="w-full h-8 px-2 rounded-[6px] text-[13px] outline-none"
                        style={{ border: '1px solid var(--line)', background: 'var(--surface)', color: 'var(--ink)', fontFamily: 'var(--font)' }} />
                    </div>
                  </div>
                  <div className="mb-3">
                    <label className="text-[11px] mb-1 block" style={{ color: 'var(--ink-3)' }}>Descripción</label>
                    <textarea value={triggerDraft.description ?? ''} onChange={e => setTriggerDraft(d => ({ ...d, description: e.target.value }))}
                      placeholder="¿Qué pasó? Ej: La empresa anunció expansión a…" rows={2}
                      className="w-full px-2 py-1 rounded-[6px] text-[13px] outline-none resize-none"
                      style={{ border: '1px solid var(--line)', background: 'var(--surface)', color: 'var(--ink)', fontFamily: 'var(--font)' }} />
                  </div>
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <div>
                      <label className="text-[11px] mb-1 block" style={{ color: 'var(--ink-3)' }}>URL fuente</label>
                      <input value={triggerDraft.source_url ?? ''} onChange={e => setTriggerDraft(d => ({ ...d, source_url: e.target.value }))}
                        placeholder="https://…"
                        className="w-full h-8 px-2 rounded-[6px] text-[13px] outline-none"
                        style={{ border: '1px solid var(--line)', background: 'var(--surface)', color: 'var(--ink)', fontFamily: 'var(--font)' }} />
                    </div>
                    <div>
                      <label className="text-[11px] mb-1 block" style={{ color: 'var(--ink-3)' }}>Acción sugerida</label>
                      <input value={triggerDraft.action_suggested ?? ''} onChange={e => setTriggerDraft(d => ({ ...d, action_suggested: e.target.value }))}
                        placeholder="Ej: Enviar email de intro"
                        className="w-full h-8 px-2 rounded-[6px] text-[13px] outline-none"
                        style={{ border: '1px solid var(--line)', background: 'var(--surface)', color: 'var(--ink)', fontFamily: 'var(--font)' }} />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={submitTrigger}
                      disabled={!triggerDraft.trigger_type}
                      className="h-7 px-4 rounded-[6px] text-[12px] font-medium border-0"
                      style={{ background: 'var(--accent)', color: 'var(--on-accent)', opacity: triggerDraft.trigger_type ? 1 : 0.5 }}>
                      Guardar
                    </button>
                    <button onClick={() => setNewTriggerForm(false)}
                      className="h-7 px-3 rounded-[6px] text-[12px] border-0"
                      style={{ background: 'var(--bg-3)', color: 'var(--ink-2)' }}>
                      Cancelar
                    </button>
                  </div>
                </div>
              )}

              <div className="flex flex-col gap-2">
                {triggers.length === 0 && !newTriggerForm && (
                  <div className="text-[13px] text-center py-6" style={{ color: 'var(--ink-4)' }}>Sin triggers registrados</div>
                )}
                {triggers.map(tr => (
                  <TriggerCard
                    key={tr.id}
                    trigger={tr}
                    onStatusChange={async (status) => {
                      await updateCrmTrigger(tr.id, { status });
                      setTriggers(prev => prev.map(x => x.id === tr.id ? { ...x, status } : x));
                    }}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function InteractionCard({ interaction: i, onDelete, onEdit }: { interaction: CrmInteraction; onDelete: () => void; onEdit: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div
      className="rounded-[8px] p-3 cursor-pointer"
      style={{ background: 'var(--surface)', border: '1px solid var(--line)' }}
      onClick={() => setOpen(v => !v)}
    >
      <div className="flex items-center gap-2">
        <span className="text-[15px]">{channelEmoji(i.channel)}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[12.5px] font-medium" style={{ color: 'var(--ink)' }}>
              {i.type ?? channelEs(i.channel) ?? 'Interacción'}
            </span>
            <span className="text-[11px]" style={{ color: 'var(--ink-4)' }}>{fmtDate(i.date)}</span>
          </div>
          {i.summary && (
            <div className="text-[12px] truncate mt-[1px]" style={{ color: 'var(--ink-3)' }}>{i.summary}</div>
          )}
        </div>
        {i.outcome && (
          <span
            className="text-[10px] px-[6px] py-[2px] rounded-full flex-shrink-0"
            style={{ background: outcomeBg(i.outcome), color: outcomeFg(i.outcome) }}
          >
            {outcomeEs(i.outcome)}
          </span>
        )}
      </div>
      {open && (
        <div className="mt-3 pt-3" style={{ borderTop: '1px solid var(--line)' }} onClick={e => e.stopPropagation()}>
          {i.summary && <p className="text-[12.5px] mb-2" style={{ color: 'var(--ink-2)' }}>{i.summary}</p>}
          {i.next_step && (
            <div className="text-[12px] mb-1"><span style={{ color: 'var(--ink-4)' }}>Próximo paso: </span><span style={{ color: 'var(--ink)' }}>{i.next_step}</span></div>
          )}
          {i.follow_up_due && (
            <div className="text-[12px] mb-2"><span style={{ color: 'var(--ink-4)' }}>Recordatorio: </span><span style={{ color: 'var(--ink)' }}>{fmtDate(i.follow_up_due)}</span></div>
          )}
          <div className="mt-2 flex items-center gap-3">
            <button onClick={onEdit} className="text-[11px] flex items-center gap-1 border-0 bg-transparent" style={{ color: 'var(--accent)' }}>
              <Pencil size={11} /> Editar
            </button>
            <button onClick={onDelete} className="text-[11px] flex items-center gap-1 border-0 bg-transparent" style={{ color: 'var(--sem-red)' }}>
              <Trash2 size={11} /> Eliminar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function CrmTaskCard({ task, today, onToggle, onDelete }: { task: CrmTask; today: string; onToggle: () => void; onDelete: () => void }) {
  const isDone = task.status === 'Done';
  const isOverdue = !isDone && task.due_date && task.due_date < today;
  return (
    <div
      className="rounded-[8px] p-3 flex items-start gap-3"
      style={{ background: 'var(--surface)', border: `1px solid ${isOverdue ? 'var(--sem-red-border)' : 'var(--line)'}` }}
    >
      <button
        onClick={onToggle}
        className="w-4 h-4 rounded-[3px] border flex items-center justify-center flex-shrink-0 mt-[2px] transition-colors"
        style={{
          borderColor: isDone ? 'var(--sem-green)' : 'var(--line)',
          background: isDone ? 'var(--sem-green)' : 'transparent',
          color: 'white',
        }}
      >
        {isDone && <span style={{ fontSize: 9 }}>✓</span>}
      </button>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-[13px]" style={{ color: isDone ? 'var(--ink-4)' : 'var(--ink)', textDecoration: isDone ? 'line-through' : 'none' }}>
            {taskTypeEs(task.task_type) || 'Tarea CRM'}
          </span>
          {task.due_date && (
            <span className="text-[11px]" style={{ color: isOverdue ? 'var(--sem-red)' : 'var(--ink-4)', fontWeight: isOverdue ? 600 : 400 }}>
              {fmtDate(task.due_date)}
            </span>
          )}
        </div>
        {task.notes && <div className="text-[12px] mt-[2px]" style={{ color: 'var(--ink-3)' }}>{task.notes}</div>}
      </div>
      <button onClick={onDelete} className="border-0 bg-transparent flex-shrink-0" style={{ color: 'var(--ink-4)' }}>
        <Trash2 size={12} />
      </button>
    </div>
  );
}

function TriggerCard({ trigger, onStatusChange }: { trigger: CrmTrigger; onStatusChange: (s: 'Open' | 'Monitoring' | 'Closed') => void }) {
  const statusColors: Record<string, { bg: string; fg: string }> = {
    Open:       { bg: 'var(--sem-red-bg)',  fg: 'var(--sem-red-dark)'  },
    Monitoring: { bg: 'oklch(0.95 0.06 85)',  fg: 'var(--sem-amber-dark)'  },
    Closed:     { bg: 'var(--sem-gray-bg)',   fg: 'var(--sem-gray-fg)'   },
  };
  const sc = statusColors[trigger.status] ?? statusColors.Open;
  return (
    <div className="rounded-[8px] p-3" style={{ background: 'var(--surface)', border: '1px solid var(--line)' }}>
      <div className="flex items-start gap-2">
        <span className="text-[15px] mt-[-1px]">⚡</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[12.5px] font-medium" style={{ color: 'var(--ink)' }}>{triggerTypeEs(trigger.trigger_type) || 'Trigger'}</span>
            <span className="text-[11px]" style={{ color: 'var(--ink-4)' }}>{fmtDate(trigger.date_detected)}</span>
            <span
              className="ml-auto text-[10px] px-[6px] py-[2px] rounded-full cursor-pointer"
              style={{ background: sc.bg, color: sc.fg }}
              onClick={() => {
                const next: ('Open' | 'Monitoring' | 'Closed')[] = ['Open', 'Monitoring', 'Closed'];
                const idx = next.indexOf(trigger.status as 'Open' | 'Monitoring' | 'Closed');
                onStatusChange(next[(idx + 1) % 3]);
              }}
            >
              {trigger.status}
            </span>
          </div>
          {trigger.description && <p className="text-[12px] mb-1" style={{ color: 'var(--ink-2)' }}>{trigger.description}</p>}
          {trigger.action_suggested && (
            <div className="text-[11.5px]" style={{ color: 'var(--ink-3)' }}>💡 {trigger.action_suggested}</div>
          )}
          {trigger.source_url && (
            <a href={trigger.source_url} target="_blank" rel="noreferrer"
              className="inline-flex items-center gap-1 text-[11px] mt-1" style={{ color: 'var(--accent)' }}>
              <ExternalLink size={10} /> Fuente
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Timeline Tab ─────────────────────────────────────────────────────────────

type TimelineEntry =
  | { kind: 'interaction'; date: string; data: CrmInteraction }
  | { kind: 'task'; date: string; data: CrmTask }
  | { kind: 'trigger'; date: string; data: CrmTrigger };

function TimelineTab({ interactions, tasks, triggers, today }: {
  interactions: CrmInteraction[];
  tasks: CrmTask[];
  triggers: CrmTrigger[];
  today: string;
}) {
  const entries: TimelineEntry[] = [
    ...interactions.map(i => ({ kind: 'interaction' as const, date: i.date, data: i })),
    ...tasks.map(t => ({ kind: 'task' as const, date: t.due_date ?? t.created_at ?? today, data: t })),
    ...triggers.map(tr => ({ kind: 'trigger' as const, date: tr.date_detected, data: tr })),
  ].sort((a, b) => b.date.localeCompare(a.date));

  if (entries.length === 0) {
    return (
      <div className="text-[13px] text-center py-10" style={{ color: 'var(--ink-4)' }}>
        Sin actividad registrada aún
      </div>
    );
  }

  // Group by month
  const byMonth: Record<string, TimelineEntry[]> = {};
  for (const e of entries) {
    const month = e.date.slice(0, 7);
    if (!byMonth[month]) byMonth[month] = [];
    byMonth[month].push(e);
  }

  return (
    <div className="flex flex-col gap-6">
      {Object.entries(byMonth).map(([month, items]) => {
        const d = new Date(month + '-15');
        const label = d.toLocaleString('es-CL', { month: 'long', year: 'numeric' });
        return (
          <div key={month}>
            <div className="text-[11px] font-semibold uppercase tracking-wide mb-3" style={{ color: 'var(--ink-4)' }}>
              {label.charAt(0).toUpperCase() + label.slice(1)}
            </div>
            <div className="flex flex-col gap-2 relative pl-5">
              {/* Vertical line */}
              <div className="absolute left-[6px] top-2 bottom-2 w-px" style={{ background: 'var(--line)' }} />

              {items.map((entry, idx) => (
                <div key={idx} className="relative flex gap-3">
                  {/* Dot */}
                  <div
                    className="absolute left-[-14px] top-[8px] w-3 h-3 rounded-full border-2 flex-shrink-0"
                    style={{
                      borderColor: 'var(--bg)',
                      background:
                        entry.kind === 'interaction' ? 'var(--accent)' :
                        entry.kind === 'task' ? 'var(--sem-blue)' :
                        'var(--sem-orange-2)',
                    }}
                  />

                  <div
                    className="flex-1 rounded-[8px] p-3"
                    style={{ background: 'var(--surface)', border: '1px solid var(--line)' }}
                  >
                    {entry.kind === 'interaction' && (() => {
                      const i = entry.data as CrmInteraction;
                      return (
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span>{channelEmoji(i.channel)}</span>
                            <span className="text-[12.5px] font-medium" style={{ color: 'var(--ink)' }}>
                              {i.type ?? channelEs(i.channel) ?? 'Interacción'}
                            </span>
                            <span className="text-[11px] ml-auto" style={{ color: 'var(--ink-4)' }}>
                              {fmtDate(i.date)}
                            </span>
                          </div>
                          {i.outcome && (
                            <span
                              className="inline-block text-[10px] px-[6px] py-[2px] rounded-full mb-1"
                              style={{ background: outcomeBg(i.outcome), color: outcomeFg(i.outcome) }}
                            >{outcomeEs(i.outcome)}</span>
                          )}
                          {i.summary && <p className="text-[12px]" style={{ color: 'var(--ink-3)' }}>{i.summary}</p>}
                          {i.next_step && (
                            <p className="text-[11.5px] mt-1" style={{ color: 'var(--ink-4)' }}>
                              → {i.next_step}
                            </p>
                          )}
                        </div>
                      );
                    })()}

                    {entry.kind === 'task' && (() => {
                      const t = entry.data as CrmTask;
                      const isDone = t.status === 'Done';
                      const isOverdue = !isDone && t.due_date && t.due_date < today;
                      return (
                        <div className="flex items-center gap-2">
                          <span className="text-[14px]">📋</span>
                          <div className="flex-1 min-w-0">
                            <span
                              className="text-[12.5px]"
                              style={{ color: isDone ? 'var(--ink-4)' : 'var(--ink)', textDecoration: isDone ? 'line-through' : 'none' }}
                            >
                              {taskTypeEs(t.task_type)}
                            </span>
                            {t.notes && <div className="text-[11.5px]" style={{ color: 'var(--ink-3)' }}>{t.notes}</div>}
                          </div>
                          <span
                            className="text-[10.5px] px-[6px] py-[2px] rounded-full flex-shrink-0"
                            style={{
                              background: isDone ? 'var(--sem-green-bg)' : isOverdue ? 'var(--sem-red-bg-2)' : 'var(--bg-3)',
                              color: isDone ? 'var(--sem-green-dark)' : isOverdue ? 'var(--sem-red-dark)' : 'var(--ink-3)',
                            }}
                          >
                            {isDone ? 'Hecho' : isOverdue ? 'Vencida' : taskStatusEs(t.status)}
                          </span>
                        </div>
                      );
                    })()}

                    {entry.kind === 'trigger' && (() => {
                      const tr = entry.data as CrmTrigger;
                      return (
                        <div className="flex items-start gap-2">
                          <span className="text-[14px]">⚡</span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-[12.5px] font-medium" style={{ color: 'var(--ink)' }}>
                                {triggerTypeEs(tr.trigger_type)}
                              </span>
                              <span
                                className="text-[10px] px-[5px] py-[2px] rounded-full"
                                style={{
                                  background: tr.status === 'Open' ? 'var(--sem-red-bg)' : tr.status === 'Monitoring' ? 'oklch(0.96 0.04 85)' : 'var(--bg-3)',
                                  color: tr.status === 'Open' ? 'var(--sem-red-dark)' : tr.status === 'Monitoring' ? 'var(--sem-amber-dark)' : 'var(--ink-4)',
                                }}
                              >
                                {tr.status}
                              </span>
                            </div>
                            {tr.description && <p className="text-[12px] mt-1" style={{ color: 'var(--ink-3)' }}>{tr.description}</p>}
                            {tr.action_suggested && (
                              <p className="text-[11.5px] mt-1" style={{ color: 'var(--ink-4)' }}>💡 {tr.action_suggested}</p>
                            )}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function fmtDate(d?: string): string {
  if (!d) return '—';
  const date = new Date(d + 'T12:00:00');
  const today2 = new Date(); today2.setHours(0, 0, 0, 0);
  const diff = Math.round((date.getTime() - today2.getTime()) / 86400000);
  if (diff === 0) return 'Hoy';
  if (diff === 1) return 'Mañana';
  if (diff === -1) return 'Ayer';
  if (diff < -1) return `${(-diff)}d atrás`;
  return date.toLocaleDateString('es-CL', { day: 'numeric', month: 'short' });
}

function channelEmoji(channel?: string): string {
  const map: Record<string, string> = { Email: '📧', LinkedIn: '💼', Phone: '📞', WhatsApp: '💬', Meeting: '🤝', Event: '🎪', Referral: '👥' };
  return map[channel ?? ''] ?? '📋';
}

function outcomeBg(outcome: string): string {
  if (['Positive', 'Interested', 'Meeting booked'].includes(outcome)) return 'var(--sem-green-bg)';
  if (['Not now', 'No response'].includes(outcome)) return 'oklch(0.94 0.02 85)';
  if (outcome === 'Lost') return 'var(--sem-red-bg)';
  return 'var(--bg-3)';
}

function outcomeFg(outcome: string): string {
  if (['Positive', 'Interested', 'Meeting booked'].includes(outcome)) return 'var(--sem-green-dark)';
  if (['Not now', 'No response'].includes(outcome)) return 'var(--sem-gray-fg)';
  if (outcome === 'Lost') return 'var(--sem-red-dark)';
  return 'var(--ink-3)';
}
