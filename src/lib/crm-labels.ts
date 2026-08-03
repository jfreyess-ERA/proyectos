/**
 * Etiquetas en español para los enums del CRM.
 *
 * Los valores se guardan en inglés en la base (para no romper reportes, filtros
 * ni el motor de cadencia que compara strings), pero la interfaz siempre se
 * muestra en español. Este módulo es la única fuente de esa traducción.
 */
import type {
  InteractionChannel, InteractionOutcome, ProspectStage, ProspectStatus,
  ProspectPriority, CrmTaskType, CrmTaskStatus, TriggerType, ResponseType,
} from './types';

export const CHANNEL_ES: Record<InteractionChannel, string> = {
  Email: 'Email', LinkedIn: 'LinkedIn', Phone: 'Llamada', WhatsApp: 'WhatsApp',
  Meeting: 'Reunión', Event: 'Evento', Referral: 'Referido',
};

export const OUTCOME_ES: Record<InteractionOutcome, string> = {
  'No response': 'Sin respuesta',
  'Positive': 'Positiva',
  'Interested': 'Interesado',
  'Meeting booked': 'Reunión agendada',
  'Not now': 'Ahora no',
  'Lost': 'Perdido',
};

export const STAGE_ES: Record<ProspectStage, string> = {
  'New': 'Nuevo',
  'Contacted': 'Contactado',
  'Meeting Requested': 'Reunión pedida',
  'Meeting Held': 'Reunión hecha',
  'Proposal': 'Propuesta',
  'Negotiation': 'Negociación',
  'Won': 'Ganado',
};

export const STATUS_ES: Record<ProspectStatus, string> = {
  'Active': 'Activo',
  'Warm': 'Tibio',
  'Paused': 'En pausa',
  'Nurture': 'Cultivar',
  'Closed Won': 'Ganado',
  'Closed Lost': 'Perdido',
  'Dormant': 'Dormido',
};

export const PRIORITY_ES: Record<ProspectPriority, string> = {
  'High': 'Alta',
  'Medium': 'Media',
  'Low': 'Baja',
  'Strategic': 'Estratégico',
  'Watchlist': 'En observación',
};

export const TASK_TYPE_ES: Record<CrmTaskType, string> = {
  'Follow-up': 'Seguimiento',
  'Research': 'Investigar',
  'Send case study': 'Enviar caso',
  'Call': 'Llamar',
  'Meeting': 'Reunión',
  'Reconnect': 'Reconectar',
  'Proposal': 'Propuesta',
};

export const TASK_STATUS_ES: Record<CrmTaskStatus, string> = {
  'Pending': 'Pendiente',
  'In Progress': 'En curso',
  'Waiting': 'Esperando',
  'Done': 'Hecha',
  'Deferred': 'Postergada',
  'Cancelled': 'Cancelada',
};

export const TRIGGER_TYPE_ES: Record<TriggerType, string> = {
  'News': 'Noticia',
  'Hiring': 'Contratación',
  'Expansion': 'Expansión',
  'Regulation': 'Regulación',
  'Leadership change': 'Cambio de liderazgo',
  'Earnings': 'Resultados',
  'Results': 'Resultados',
};

// Helpers tolerantes: si el valor no está mapeado, devuelven el original.
export const channelEs  = (v?: string | null) => (v ? CHANNEL_ES[v as InteractionChannel]  ?? v : '');
export const outcomeEs  = (v?: string | null) => (v ? OUTCOME_ES[v as InteractionOutcome]  ?? v : '');
export const stageEs    = (v?: string | null) => (v ? STAGE_ES[v as ProspectStage]         ?? v : '');
export const statusEs   = (v?: string | null) => (v ? STATUS_ES[v as ProspectStatus]       ?? v : '');
export const priorityEs = (v?: string | null) => (v ? PRIORITY_ES[v as ProspectPriority]   ?? v : '');
export const taskTypeEs = (v?: string | null) => (v ? TASK_TYPE_ES[v as CrmTaskType]        ?? v : '');
export const taskStatusEs = (v?: string | null) => (v ? TASK_STATUS_ES[v as CrmTaskStatus]  ?? v : '');
export const triggerTypeEs = (v?: string | null) => (v ? TRIGGER_TYPE_ES[v as TriggerType]  ?? v : '');

/**
 * Outcome derivado de la respuesta de cadencia. Al unificar el campo "Outcome"
 * con "¿Qué respondió?", el outcome ya no se pide a mano: se infiere de la
 * respuesta elegida para que los reportes por outcome sigan funcionando.
 */
export const OUTCOME_FROM_RESPONSE: Record<ResponseType, InteractionOutcome> = {
  acepta_reunion:     'Meeting booked',
  ok:                 'Positive',
  reagendar:          'Not now',
  mas_adelante:       'Not now',
  nueva_postergacion: 'Not now',
  deriva:             'Interested',
  objecion:           'Not now',
  sin_respuesta:      'No response',
};

/**
 * Etapa objetivo que sugiere cada respuesta. La etapa sólo avanza (nunca
 * retrocede) — ver aplicación en ProspectDetail. Registrar cualquier interacción
 * en un prospecto "New" ya lo lleva como mínimo a "Contacted".
 */
export const STAGE_FROM_RESPONSE: Record<ResponseType, ProspectStage> = {
  sin_respuesta:      'Contacted',
  mas_adelante:       'Contacted',
  nueva_postergacion: 'Contacted',
  deriva:             'Contacted',
  objecion:           'Contacted',
  acepta_reunion:     'Meeting Requested',
  ok:                 'Meeting Requested',
  reagendar:          'Meeting Requested',
};
