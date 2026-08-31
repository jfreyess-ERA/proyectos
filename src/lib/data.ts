import type { User, Project, Task, Label, StatusDef, PriorityDef } from './types';

export const PEOPLE: User[] = [
  { id: 'u1', name: 'Ana Mendoza',     role: 'Product Lead',  initials: 'AM', hue: 14  },
  { id: 'u2', name: 'Bruno Carrillo',  role: 'Diseño',        initials: 'BC', hue: 220 },
  { id: 'u3', name: 'Carla Restrepo',  role: 'Frontend',      initials: 'CR', hue: 160 },
  { id: 'u4', name: 'Diego Salgado',   role: 'Backend',       initials: 'DS', hue: 280 },
  { id: 'u5', name: 'Elena Vargas',    role: 'QA',            initials: 'EV', hue: 38  },
  { id: 'u6', name: 'Federico Núñez',  role: 'Estrategia',    initials: 'FN', hue: 340 },
  { id: 'u7', name: 'Gabriela Soto',   role: 'Diseño',        initials: 'GS', hue: 190 },
  { id: 'u8', name: 'Hugo Pérez',      role: 'Frontend',      initials: 'HP', hue: 100 },
];

export const PROJECTS: Project[] = [
  { id: 'p1', name: 'Rediseño portal cliente',   key: 'PORT', color: 'oklch(0.62 0.16 265)', favorite: true  },
  { id: 'p2', name: 'App móvil iOS v3',          key: 'iOS',  color: 'oklch(0.66 0.14 160)', favorite: true  },
  { id: 'p3', name: 'Onboarding B2B',            key: 'ONB',  color: 'oklch(0.68 0.13 38)',  favorite: false },
  { id: 'p4', name: 'Sistema de diseño 2.0',     key: 'DS',   color: 'oklch(0.60 0.14 340)', favorite: true  },
  { id: 'p5', name: 'Migración infraestructura', key: 'INF',  color: 'oklch(0.55 0.05 250)', favorite: false },
];

export const STATUSES: StatusDef[] = [
  { id: 'backlog', label: 'Backlog',     tone: 'var(--ink-4)' },
  { id: 'todo',    label: 'Por hacer',   tone: 'var(--sem-blue-gray-med)' },
  { id: 'doing',   label: 'En curso',    tone: 'var(--accent)' },
  { id: 'review',  label: 'En revisión', tone: 'var(--sem-amber)'  },
  { id: 'done',    label: 'Completado',  tone: 'var(--sem-green)' },
];

export const PRIORITIES: PriorityDef[] = [
  { id: 'urgent', label: 'Urgente', tone: 'var(--sem-red-2)'  },
  { id: 'high',   label: 'Alta',    tone: 'var(--sem-orange)'  },
  { id: 'med',    label: 'Media',   tone: 'var(--sem-blue-gray-med)' },
  { id: 'low',    label: 'Baja',    tone: 'var(--sem-blue-gray-low)' },
];

export const LABELS: Label[] = [
  { id: 'l1', text: 'Descubrimiento', bg: 'oklch(0.94 0.04 265)', fg: 'oklch(0.40 0.12 265)' },
  { id: 'l2', text: 'Diseño',         bg: 'oklch(0.94 0.04 340)', fg: 'oklch(0.40 0.12 340)' },
  { id: 'l3', text: 'Frontend',       bg: 'oklch(0.94 0.04 160)', fg: 'oklch(0.38 0.10 160)' },
  { id: 'l4', text: 'Backend',        bg: 'oklch(0.94 0.04 280)', fg: 'oklch(0.40 0.12 280)' },
  { id: 'l5', text: 'QA',             bg: 'oklch(0.94 0.04 38)',  fg: 'oklch(0.40 0.10 38)'  },
  { id: 'l6', text: 'Bloqueante',     bg: 'oklch(0.94 0.04 25)',  fg: 'oklch(0.42 0.14 25)'  },
  { id: 'l7', text: 'Documentación',  bg: 'oklch(0.95 0.01 250)', fg: 'oklch(0.40 0.02 250)' },
  { id: 'l8', text: 'Investigación',  bg: 'oklch(0.94 0.04 220)', fg: 'oklch(0.40 0.12 220)' },
];

const day = (offset: number): string => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  d.setHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
};

export const TASKS: Task[] = [
  { id: 't1',  ref: 'PORT-101', project: 'p1', title: 'Auditoría de heurísticas en flujo de pagos',  status: 'done',    priority: 'high',   assignees: ['u1','u6'], labels:['l1','l8'], start: day(-12), due: day(-5),  estimate: 8,  spent: 9,  subtasks:{done:5,total:5} },
  { id: 't2',  ref: 'PORT-104', project: 'p1', title: 'Wireframes pantalla principal del portal',    status: 'done',    priority: 'high',   assignees: ['u2'],      labels:['l2'],      start: day(-10), due: day(-3),  estimate: 12, spent:14, subtasks:{done:7,total:7} },
  { id: 't3',  ref: 'PORT-110', project: 'p1', title: 'Hi-fi del dashboard del cliente',             status: 'doing',   priority: 'urgent', assignees: ['u2','u7'], labels:['l2'],      start: day(-4),  due: day(2),   estimate: 16, spent: 6,  subtasks:{done:2,total:6} },
  { id: 't4',  ref: 'PORT-112', project: 'p1', title: 'Componente "Resumen de contrato"',            status: 'doing',   priority: 'high',   assignees: ['u3'],      labels:['l3'],      start: day(-2),  due: day(4),   estimate: 10, spent: 3,  subtasks:{done:1,total:4} },
  { id: 't5',  ref: 'PORT-115', project: 'p1', title: 'Validación de formulario con backend',        status: 'review',  priority: 'med',    assignees: ['u3','u4'], labels:['l3','l4'], start: day(-6),  due: day(-1),  estimate: 6,  spent: 7,  subtasks:{done:3,total:3} },
  { id: 't6',  ref: 'PORT-118', project: 'p1', title: 'Tests E2E del flujo de alta',                 status: 'todo',    priority: 'med',    assignees: ['u5'],      labels:['l5'],      start: day(2),   due: day(8),   estimate: 8,  spent: 0,  subtasks:{done:0,total:5} },
  { id: 't7',  ref: 'PORT-121', project: 'p1', title: 'Migración de tabla de transacciones',         status: 'todo',    priority: 'urgent', assignees: ['u4'],      labels:['l4','l6'], start: day(3),   due: day(7),   estimate: 12, spent: 0,  subtasks:{done:0,total:4} },
  { id: 't8',  ref: 'PORT-125', project: 'p1', title: 'Documentación API pública v2',                status: 'backlog', priority: 'low',    assignees: ['u4'],      labels:['l7','l4'], start: day(10),  due: day(20),  estimate: 5,  spent: 0,  subtasks:{done:0,total:3} },
  { id: 't9',  ref: 'iOS-014',  project: 'p2', title: 'Investigación: notificaciones push v2',       status: 'done',    priority: 'med',    assignees: ['u6'],      labels:['l1','l8'], start: day(-15), due: day(-8),  estimate: 6,  spent: 6,  subtasks:{done:3,total:3} },
  { id: 't10', ref: 'iOS-022',  project: 'p2', title: 'Pantalla de perfil rediseñada',               status: 'doing',   priority: 'high',   assignees: ['u7'],      labels:['l2'],      start: day(-3),  due: day(3),   estimate: 10, spent: 4,  subtasks:{done:2,total:5} },
  { id: 't11', ref: 'iOS-027',  project: 'p2', title: 'Animación de transición entre tabs',          status: 'review',  priority: 'med',    assignees: ['u8','u7'], labels:['l3','l2'], start: day(-5),  due: day(0),   estimate: 5,  spent: 5,  subtasks:{done:2,total:2} },
  { id: 't12', ref: 'iOS-031',  project: 'p2', title: 'Refactor del modelo de sesión',               status: 'doing',   priority: 'urgent', assignees: ['u4'],      labels:['l4','l6'], start: day(-1),  due: day(5),   estimate: 14, spent: 5,  subtasks:{done:1,total:4} },
  { id: 't13', ref: 'iOS-035',  project: 'p2', title: 'QA regresión iOS 17',                         status: 'todo',    priority: 'high',   assignees: ['u5'],      labels:['l5'],      start: day(4),   due: day(9),   estimate: 7,  spent: 0,  subtasks:{done:0,total:6} },
  { id: 't14', ref: 'iOS-038',  project: 'p2', title: 'Onboarding biométrico (Face ID)',             status: 'backlog', priority: 'med',    assignees: [],          labels:['l1'],      start: day(12),  due: day(22),  estimate: 9,  spent: 0,  subtasks:{done:0,total:0} },
  { id: 't15', ref: 'ONB-005',  project: 'p3', title: 'Mapa de empatía: cliente B2B',                status: 'done',    priority: 'med',    assignees: ['u1','u6'], labels:['l1'],      start: day(-20), due: day(-13), estimate: 4,  spent: 4,  subtasks:{done:2,total:2} },
  { id: 't16', ref: 'ONB-009',  project: 'p3', title: 'Flujo de invitación multi-cuenta',            status: 'doing',   priority: 'high',   assignees: ['u2','u3'], labels:['l2','l3'], start: day(-2),  due: day(6),   estimate: 12, spent: 5,  subtasks:{done:2,total:5} },
  { id: 't17', ref: 'ONB-012',  project: 'p3', title: 'Estado vacío: cero proyectos',               status: 'todo',    priority: 'low',    assignees: ['u7'],      labels:['l2'],      start: day(5),   due: day(10),  estimate: 3,  spent: 0,  subtasks:{done:0,total:2} },
  { id: 't18', ref: 'DS-040',   project: 'p4', title: 'Tokens de color v2',                         status: 'done',    priority: 'high',   assignees: ['u2'],      labels:['l2','l7'], start: day(-22), due: day(-15), estimate: 8,  spent: 9,  subtasks:{done:4,total:4} },
  { id: 't19', ref: 'DS-046',   project: 'p4', title: 'Componente Tabla con virtualización',        status: 'doing',   priority: 'high',   assignees: ['u8'],      labels:['l3'],      start: day(-6),  due: day(2),   estimate: 14, spent: 9,  subtasks:{done:3,total:5} },
  { id: 't20', ref: 'DS-049',   project: 'p4', title: 'Documentar variantes de Botón',              status: 'review',  priority: 'med',    assignees: ['u2','u8'], labels:['l7','l2'], start: day(-4),  due: day(0),   estimate: 4,  spent: 4,  subtasks:{done:3,total:3} },
  { id: 't21', ref: 'DS-052',   project: 'p4', title: 'Componente DatePicker accesible',            status: 'todo',    priority: 'med',    assignees: ['u3'],      labels:['l3'],      start: day(3),   due: day(11),  estimate: 12, spent: 0,  subtasks:{done:0,total:5} },
  { id: 't22', ref: 'DS-058',   project: 'p4', title: 'Auditoría de contraste WCAG 2.2',            status: 'backlog', priority: 'low',    assignees: ['u5'],      labels:['l5','l7'], start: day(14),  due: day(20),  estimate: 6,  spent: 0,  subtasks:{done:0,total:0} },
  { id: 't23', ref: 'INF-007',  project: 'p5', title: 'Migrar storage a S3 multirregión',           status: 'doing',   priority: 'urgent', assignees: ['u4'],      labels:['l4','l6'], start: day(-3),  due: day(4),   estimate: 16, spent: 7,  subtasks:{done:1,total:4} },
  { id: 't24', ref: 'INF-010',  project: 'p5', title: 'Pipeline CI con caché distribuida',          status: 'todo',    priority: 'high',   assignees: ['u4','u8'], labels:['l4'],      start: day(5),   due: day(12),  estimate: 10, spent: 0,  subtasks:{done:0,total:3} },
];

export function getUser(id: string) { return PEOPLE.find(u => u.id === id); }
export function getProject(id: string) { return PROJECTS.find(p => p.id === id); }
export function getLabel(id: string) { return LABELS.find(l => l.id === id); }
export function getPriority(id: string) { return PRIORITIES.find(p => p.id === id); }
export function getStatus(id: string) { return STATUSES.find(s => s.id === id); }

export function avatarBg(hue: number) {
  return `oklch(0.55 0.14 ${hue})`;
}

/**
 * Nombre corto para mostrar junto a un avatar chico (chips, dropdowns). El
 * primer nombre solo, salvo que otra persona del equipo lo comparta — ahí se
 * agrega la inicial de la siguiente palabra ("José S." vs "José T.") para no
 * dejar dos personas distintas mostrando el mismo texto.
 */
export function shortName(user: User, allUsers: User[]): string {
  const parts = user.name.trim().split(/\s+/);
  const first = parts[0];
  const collides = allUsers.some(u => u.id !== user.id && u.name.trim().split(/\s+/)[0] === first);
  if (!collides) return first;

  const second = parts[1];
  if (second) {
    const withInitial = `${first} ${second[0]}.`;
    const stillCollides = allUsers.some(u => {
      if (u.id === user.id) return false;
      const uParts = u.name.trim().split(/\s+/);
      return uParts[0] === first && uParts[1]?.[0] === second[0];
    });
    if (!stillCollides) return withInitial;
  }
  return user.name;
}

export function fmtDate(dateStr: string, opts?: { relative?: boolean }): string {
  if (!dateStr) return '';
  const date = new Date(dateStr + 'T00:00:00');
  const today = new Date(); today.setHours(0,0,0,0);
  const diff = Math.round((date.getTime() - today.getTime()) / 86400000);
  if (opts?.relative) {
    if (diff === 0) return 'Hoy';
    if (diff === 1) return 'Mañana';
    if (diff === -1) return 'Ayer';
    if (diff < 0) return `Hace ${Math.abs(diff)}d`;
    if (diff < 8) return `En ${diff}d`;
  }
  return date.toLocaleDateString('es', { day: 'numeric', month: 'short' });
}

export function dueClass(due: string, status: string): string {
  if (!due || status === 'done') return '';
  const date = new Date(due + 'T00:00:00');
  const today = new Date(); today.setHours(0,0,0,0);
  const diff = Math.round((date.getTime() - today.getTime()) / 86400000);
  if (diff < 0) return 'text-[var(--danger)]';
  if (diff <= 2) return 'text-[var(--warn)]';
  return 'text-[var(--ink-3)]';
}
