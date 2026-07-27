'use client';
import { STATUSES, PRIORITIES } from '@/lib/data';
import type { Task, Project, User } from '@/lib/types';

export interface TaskFilterState {
  client: string;
  project: string;
  assignee: string;
  status: string;
  priority: string;
  /** Only active (not done) tasks whose due date is in the past. */
  overdueOnly: boolean;
}

export const EMPTY_FILTERS: TaskFilterState = {
  client: 'all',
  project: 'all',
  assignee: 'all',
  status: 'all',
  priority: 'all',
  overdueOnly: false,
};

export function filtersActive(f: TaskFilterState): boolean {
  return f.client !== 'all' || f.project !== 'all' || f.assignee !== 'all' || f.status !== 'all' || f.priority !== 'all' || f.overdueOnly;
}

function todayISO(): string {
  const d = new Date(); d.setHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}

/** Apply the active filters to a task list. */
export function applyTaskFilters(tasks: Task[], projects: Project[], f: TaskFilterState): Task[] {
  const projectClient: Record<string, string | undefined> = {};
  for (const p of projects) projectClient[p.id] = p.client;
  const iso = todayISO();
  return tasks.filter(t => {
    if (f.client !== 'all' && projectClient[t.project] !== f.client) return false;
    if (f.project !== 'all' && t.project !== f.project) return false;
    if (f.assignee !== 'all' && !t.assignees.includes(f.assignee)) return false;
    if (f.status !== 'all' && t.status !== f.status) return false;
    if (f.priority !== 'all' && t.priority !== f.priority) return false;
    if (f.overdueOnly && !(t.status !== 'done' && t.due && t.due < iso)) return false;
    return true;
  });
}

type DropdownKey = 'client' | 'project' | 'assignee' | 'status' | 'priority';

interface Props {
  filters: TaskFilterState;
  onChange: (f: TaskFilterState) => void;
  projects: Project[];
  users?: User[];
  /** Which filter dropdowns to render, in order. Defaults to all. */
  show?: DropdownKey[];
  /** Whether to render the "Solo atrasadas" toggle. Defaults to true. */
  showOverdue?: boolean;
  /** Extra content rendered before the filters (e.g. a view toggle). */
  children?: React.ReactNode;
  /** Content rendered pushed to the right (e.g. checkboxes). */
  trailing?: React.ReactNode;
}

export function TaskFilterBar({
  filters,
  onChange,
  projects,
  users = [],
  show = ['client', 'project', 'assignee', 'status', 'priority'],
  showOverdue = true,
  children,
  trailing,
}: Props) {
  const clients = [...new Set(projects.map(p => p.client).filter(Boolean) as string[])].sort();

  // when a client is selected, the project dropdown only lists that client's projects
  const projectOptions = (filters.client === 'all'
    ? projects
    : projects.filter(p => p.client === filters.client)
  ).slice().sort((a, b) => {
    const ca = (a.client ?? '').localeCompare(b.client ?? '');
    return ca !== 0 ? ca : a.name.localeCompare(b.name);
  });

  function set(key: DropdownKey, value: string) {
    const next = { ...filters, [key]: value };
    // if client changes and the selected project no longer belongs to it, reset project
    if (key === 'client' && value !== 'all') {
      const stillValid = projects.some(p => p.id === next.project && p.client === value);
      if (!stillValid) next.project = 'all';
    }
    onChange(next);
  }

  return (
    <div className="flex items-center gap-3 flex-wrap">
      {children}
      {show.includes('client') && (
        <Select label="Cliente" value={filters.client} onChange={v => set('client', v)}>
          <option value="all">Todos ({clients.length})</option>
          {clients.map(c => <option key={c} value={c}>{c}</option>)}
        </Select>
      )}
      {show.includes('project') && (
        <Select label="Proyecto" value={filters.project} onChange={v => set('project', v)}>
          <option value="all">Todos</option>
          {projectOptions.map(p => (
            <option key={p.id} value={p.id}>
              {filters.client === 'all' && p.client ? `${p.client} · ${p.name}` : p.name}
            </option>
          ))}
        </Select>
      )}
      {show.includes('assignee') && (
        <Select label="Analista" value={filters.assignee} onChange={v => set('assignee', v)}>
          <option value="all">Todos</option>
          {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
        </Select>
      )}
      {show.includes('status') && (
        <Select label="Estado" value={filters.status} onChange={v => set('status', v)}>
          <option value="all">Todos</option>
          {STATUSES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
        </Select>
      )}
      {show.includes('priority') && (
        <Select label="Prioridad" value={filters.priority} onChange={v => set('priority', v)}>
          <option value="all">Todas</option>
          {PRIORITIES.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
        </Select>
      )}
      {showOverdue && (
        <button
          onClick={() => onChange({ ...filters, overdueOnly: !filters.overdueOnly })}
          className="h-8 px-3 text-[12px] font-medium rounded-[7px] border transition-colors"
          style={
            filters.overdueOnly
              ? { background: 'var(--danger-bg)', borderColor: 'var(--danger)', color: 'var(--danger)' }
              : { background: 'var(--bg-2)', borderColor: 'var(--line)', color: 'var(--ink-3)' }
          }
          aria-pressed={filters.overdueOnly}
        >
          Solo atrasadas
        </button>
      )}
      {filtersActive(filters) && (
        <button
          onClick={() => onChange(EMPTY_FILTERS)}
          className="h-8 px-3 text-[12px] rounded-[7px] border transition-colors"
          style={{ background: 'var(--bg-2)', borderColor: 'var(--line)', color: 'var(--ink-3)' }}
        >
          Limpiar filtros
        </button>
      )}
      {trailing && <div className="ml-auto flex items-center gap-3 flex-wrap">{trailing}</div>}
    </div>
  );
}

function Select({ label, value, onChange, children }: { label: string; value: string; onChange: (v: string) => void; children: React.ReactNode }) {
  return (
    <label className="flex items-center gap-2 text-[12px]" style={{ color: 'var(--ink-3)' }}>
      <span className="font-medium">{label}:</span>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="h-8 px-2 rounded-[7px] border text-[12px] outline-none max-w-[200px]"
        style={{ background: 'var(--bg-2)', borderColor: 'var(--line)', color: 'var(--ink)', fontFamily: 'var(--font)' }}
      >
        {children}
      </select>
    </label>
  );
}
