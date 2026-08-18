import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const APP_URL = 'https://proyectos.nciconsultores.com';

/**
 * Feed .ics de solo lectura: "qué tengo que hacer", no un calendario de
 * reuniones. Es la mitad barata de la integración con Outlook (ver
 * investigación previa) — cero OAuth, cero Azure AD, pero Outlook lo
 * refresca cada 3 a 24 horas, nunca al instante. Eso se avisa en la UI que
 * entrega el link, no acá.
 *
 * La URL en sí es la credencial (el token vive en users.calendar_token);
 * por eso esta ruta usa el service role — no hay sesión de por medio.
 */

function escapeICS(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

/** RFC 5545 exige líneas ≤75 octetos, continuadas con CRLF + espacio. */
function foldLine(line: string): string {
  const bytes = Buffer.byteLength(line, 'utf8');
  if (bytes <= 75) return line;
  const out: string[] = [];
  let rest = line;
  let first = true;
  while (rest.length > 0) {
    const limit = first ? 75 : 74; // la continuación pierde 1 char por el espacio inicial
    let chunk = rest.slice(0, limit);
    while (Buffer.byteLength(chunk, 'utf8') > limit && chunk.length > 0) {
      chunk = chunk.slice(0, -1);
    }
    out.push((first ? '' : ' ') + chunk);
    rest = rest.slice(chunk.length);
    first = false;
  }
  return out.join('\r\n');
}

function ymd(dateStr: string): string {
  return dateStr.replace(/-/g, '');
}

function addDaysISO(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

interface VEventInput {
  uid: string;
  dueISO: string;
  summary: string;
  description?: string;
  url: string;
}

function buildVEvent(e: VEventInput, dtstamp: string): string[] {
  return [
    'BEGIN:VEVENT',
    `UID:${e.uid}@proyectos.nciconsultores.com`,
    `DTSTAMP:${dtstamp}`,
    `DTSTART;VALUE=DATE:${ymd(e.dueISO)}`,
    `DTEND;VALUE=DATE:${ymd(addDaysISO(e.dueISO, 1))}`,
    `SUMMARY:${escapeICS(e.summary)}`,
    ...(e.description ? [`DESCRIPTION:${escapeICS(e.description)}`] : []),
    `URL:${e.url}`,
    'END:VEVENT',
  ];
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token: rawToken } = await params;
  const token = rawToken.replace(/\.ics$/i, '');

  const { data: user, error: userErr } = await supabaseAdmin
    .from('users')
    .select('id, name')
    .eq('calendar_token', token)
    .maybeSingle();

  if (userErr || !user) {
    return new NextResponse('Calendario no encontrado.', { status: 404 });
  }

  const [{ data: tasks }, { data: projects }, { data: subtasks }] = await Promise.all([
    supabaseAdmin
      .from('tasks')
      .select('id, title, description, due_date, status, project_id')
      .neq('status', 'done')
      .not('due_date', 'is', null)
      .contains('assignees', [user.id]),
    supabaseAdmin.from('projects').select('id, name, client'),
    supabaseAdmin
      .from('task_subtasks')
      .select('id, task_id, title, due_date, done')
      .eq('assignee', user.id)
      .eq('done', false)
      .not('due_date', 'is', null),
  ]);

  const projectById = new Map((projects ?? []).map(p => [p.id, p as { id: string; name: string; client?: string }]));

  const dtstamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//NCI Consultores//Proyectos ERA//ES',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeICS(`Proyectos ERA — ${user.name}`)}`,
    'X-WR-TIMEZONE:America/Santiago',
    'X-PUBLISHED-TTL:PT1H',
    'REFRESH-INTERVAL;VALUE=DURATION:PT1H',
  ];

  for (const t of tasks ?? []) {
    const proj = projectById.get(t.project_id);
    const prefix = proj?.client ? `[${proj.client}] ` : '';
    lines.push(...buildVEvent({
      uid: `task-${t.id}`,
      dueISO: t.due_date as string,
      summary: `${prefix}${t.title}`,
      description: t.description ?? undefined,
      url: `${APP_URL}/?task=${t.id}`,
    }, dtstamp));
  }

  // Las subtareas necesitan el título de su tarea padre para tener contexto,
  // y se excluyen si esa tarea ya está Completada (dato viejo, no es trabajo real).
  const taskIds = [...new Set((subtasks ?? []).map(s => s.task_id))];
  const { data: parentTasks } = taskIds.length
    ? await supabaseAdmin.from('tasks').select('id, title, status, project_id').in('id', taskIds)
    : { data: [] as { id: string; title: string; status: string; project_id: string }[] };
  const parentById = new Map((parentTasks ?? []).map(t => [t.id, t]));

  for (const s of subtasks ?? []) {
    const parent = parentById.get(s.task_id);
    if (!parent || parent.status === 'done') continue;
    const proj = projectById.get(parent.project_id);
    const prefix = proj?.client ? `[${proj.client}] ` : '';
    lines.push(...buildVEvent({
      uid: `subtask-${s.id}`,
      dueISO: s.due_date as string,
      summary: `${prefix}${s.title}`,
      description: `Subtarea de "${parent.title}"`,
      url: `${APP_URL}/?task=${parent.id}`,
    }, dtstamp));
  }

  lines.push('END:VCALENDAR');

  const body = lines.map(foldLine).join('\r\n') + '\r\n';

  return new NextResponse(body, {
    status: 200,
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'inline; filename="proyectos-era.ics"',
      'Cache-Control': 'no-cache',
    },
  });
}
