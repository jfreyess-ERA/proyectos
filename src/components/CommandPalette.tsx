'use client';
import { useState, useEffect, useRef, useMemo } from 'react';
import { Search, Home, Inbox, CheckSquare, Users, BarChart2, Plus, Moon } from 'lucide-react';
import { PEOPLE } from '@/lib/data';
import { Avatar } from './Avatar';
import type { Task, Project } from '@/lib/types';

type NavId = string;
type Kind = 'nav' | 'act' | 'proj' | 'task' | 'user';

interface Item {
  id: string;
  kind: Kind;
  label: string;
  sub?: string;
  color?: string;
  priority?: string;
  userId?: string;
  hint?: string;
  action: () => void;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onNav: (id: NavId) => void;
  onOpenTask: (task: Task) => void;
  tasks: Task[];
  projects: Project[];
}

const PRIORITY_COLORS: Record<string, string> = {
  urgent: 'oklch(0.58 0.18 25)',
  high:   'oklch(0.65 0.14 50)',
  med:    'oklch(0.62 0.05 250)',
  low:    'oklch(0.62 0.02 250)',
};

const GROUP_ORDER: Kind[] = ['nav', 'act', 'proj', 'task', 'user'];
const GROUP_LABELS: Record<Kind, string> = {
  nav:  'Navegar',
  act:  'Acciones',
  proj: 'Proyectos',
  task: 'Tareas',
  user: 'Personas',
};

export function CommandPalette({ open, onClose, onNav, onOpenTask, tasks, projects }: Props) {
  const [query, setQuery] = useState('');
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setQuery('');
      setActiveIdx(0);
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open]);

  const items = useMemo<Item[]>(() => {
    const navs: Item[] = [
      { id: 'go-dashboard', kind: 'nav', label: 'Ir a Inicio',      action: () => onNav('dashboard') },
      { id: 'go-mytasks',   kind: 'nav', label: 'Ir a Mis tareas',  action: () => onNav('mytasks')   },
      { id: 'go-inbox',     kind: 'nav', label: 'Ir a Bandeja',     action: () => onNav('inbox')     },
      { id: 'go-people',    kind: 'nav', label: 'Ir a Equipo',      action: () => onNav('people')    },
      { id: 'go-reports',   kind: 'nav', label: 'Ir a Reportes',    action: () => onNav('reports')   },
    ];
    const acts: Item[] = [
      { id: 'new-task',    kind: 'act', label: 'Nueva tarea',         hint: 'N',  action: () => {} },
      { id: 'new-proj',    kind: 'act', label: 'Nuevo proyecto',                  action: () => {} },
      { id: 'toggle-dark', kind: 'act', label: 'Alternar modo oscuro', hint: '⌘D', action: () => {} },
    ];
    const projs: Item[] = projects.map(p => ({
      id:    'proj-' + p.id,
      kind:  'proj' as Kind,
      label: p.name,
      sub:   'Proyecto · ' + p.key,
      color: p.color,
      action: () => onNav('project:' + p.id),
    }));
    const taskItems: Item[] = tasks.map(t => {
      const proj = projects.find(p => p.id === t.project);
      return {
        id:       'task-' + t.id,
        kind:     'task' as Kind,
        label:    t.title,
        sub:      t.ref + ' · ' + proj?.name,
        color:    proj?.color,
        priority: t.priority,
        action:   () => onOpenTask(t),
      };
    });
    const users: Item[] = PEOPLE.map((u: { id: string; name: string; role?: string }) => ({
      id:     'user-' + u.id,
      kind:   'user' as Kind,
      label:  u.name,
      sub:    u.role,
      userId: u.id,
      action: () => onNav('people'),
    }));
    return [...navs, ...acts, ...projs, ...taskItems, ...users];
  }, [onNav, onOpenTask, tasks, projects]);

  const norm = (s: string) =>
    s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

  const q = norm(query.trim());
  const filtered = q
    ? items.filter(it => norm(it.label).includes(q) || norm(it.sub ?? '').includes(q))
    : items;

  const groups = GROUP_ORDER
    .map(k => ({ k, items: filtered.filter(it => it.kind === k) }))
    .filter(g => g.items.length > 0);

  const flat = groups.flatMap(g => g.items);

  useEffect(() => { setActiveIdx(0); }, [query]);
  useEffect(() => {
    if (activeIdx >= flat.length) setActiveIdx(Math.max(0, flat.length - 1));
  }, [flat.length, activeIdx]);

  // Scroll active item into view
  useEffect(() => {
    if (!listRef.current) return;
    const el = listRef.current.querySelector(`[data-active="true"]`) as HTMLElement | null;
    el?.scrollIntoView({ block: 'nearest' });
  }, [activeIdx]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx(a => Math.min(flat.length - 1, a + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIdx(a => Math.max(0, a - 1)); }
    else if (e.key === 'Enter') {
      e.preventDefault();
      const it = flat[activeIdx];
      if (it) { it.action(); onClose(); }
    } else if (e.key === 'Escape') { onClose(); }
  };

  const navIcons: Record<string, React.ReactNode> = {
    'go-dashboard': <Home size={14} />,
    'go-mytasks':   <CheckSquare size={14} />,
    'go-inbox':     <Inbox size={14} />,
    'go-people':    <Users size={14} />,
    'go-reports':   <BarChart2 size={14} />,
  };
  const actIcons: Record<string, React.ReactNode> = {
    'new-task':    <Plus size={14} />,
    'new-proj':    <Plus size={14} />,
    'toggle-dark': <Moon size={14} />,
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60]"
      style={{
        background: 'rgba(20,18,12,.32)',
        backdropFilter: 'blur(2px)',
        display: 'grid',
        placeItems: 'flex-start center',
        paddingTop: '12vh',
      }}
      onClick={onClose}
    >
      <div
        className="flex flex-col overflow-hidden"
        style={{
          width: 'min(620px, 92vw)',
          maxHeight: '70vh',
          background: 'var(--surface)',
          border: '1px solid var(--line)',
          borderRadius: 14,
          boxShadow: 'var(--shadow-pop)',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Input */}
        <div
          className="flex items-center gap-[10px] px-4 py-[14px] border-b flex-shrink-0"
          style={{ borderColor: 'var(--line)', color: 'var(--ink-3)' }}
        >
          <Search size={16} />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Buscar tareas, proyectos, personas o ejecutar comandos…"
            className="flex-1 border-0 bg-transparent outline-none text-[15px]"
            style={{ color: 'var(--ink)', fontFamily: 'var(--font)' }}
          />
          <span
            className="text-[11px] px-[6px] py-px rounded border"
            style={{
              fontFamily: 'var(--font-mono)',
              color: 'var(--ink-4)',
              border: '1px solid var(--line)',
              background: 'var(--bg-2)',
            }}
          >
            esc
          </span>
        </div>

        {/* Results */}
        <div ref={listRef} className="flex-1 min-h-0 overflow-y-auto p-[6px]">
          {groups.length === 0 && (
            <div className="py-8 text-center text-[13px]" style={{ color: 'var(--ink-4)' }}>
              Sin resultados para &ldquo;{query}&rdquo;
            </div>
          )}
          {groups.map(g => (
            <div key={g.k} className="py-1">
              <div
                className="px-[10px] py-[6px] text-[10.5px] font-semibold tracking-widest uppercase"
                style={{ color: 'var(--ink-4)' }}
              >
                {GROUP_LABELS[g.k]}
              </div>
              {g.items.map(it => {
                const idx = flat.indexOf(it);
                const isActive = idx === activeIdx;
                return (
                  <button
                    key={it.id}
                    data-active={isActive}
                    onMouseEnter={() => setActiveIdx(idx)}
                    onClick={() => { it.action(); onClose(); }}
                    className="w-full flex items-center gap-[10px] px-[10px] py-2 rounded-[8px] border-0 text-[13.5px] text-left transition-colors"
                    style={{
                      background: isActive ? 'var(--accent-bg)' : 'transparent',
                      color: 'var(--ink)',
                      fontFamily: 'var(--font)',
                    }}
                  >
                    {/* Icon */}
                    <span
                      className="w-[22px] h-[22px] flex items-center justify-center flex-shrink-0"
                      style={{ color: isActive ? 'var(--accent)' : 'var(--ink-3)' }}
                    >
                      {it.kind === 'task' && (
                        <span className="w-2 h-2 rounded-full" style={{ background: PRIORITY_COLORS[it.priority ?? 'med'] }} />
                      )}
                      {it.kind === 'proj' && (
                        <span className="w-[10px] h-[10px] rounded-[3px]" style={{ background: it.color }} />
                      )}
                      {it.kind === 'user' && it.userId && (
                        <Avatar userId={it.userId} size="sm" />
                      )}
                      {it.kind === 'nav' && navIcons[it.id]}
                      {it.kind === 'act' && actIcons[it.id]}
                    </span>

                    <span className="flex-1 min-w-0 truncate">{it.label}</span>
                    {it.sub && (
                      <span className="text-[12px] flex-shrink-0" style={{ color: 'var(--ink-4)' }}>
                        {it.sub}
                      </span>
                    )}
                    {it.hint && (
                      <span
                        className="text-[11px] px-[5px] py-px rounded border flex-shrink-0"
                        style={{
                          fontFamily: 'var(--font-mono)',
                          color: 'var(--ink-4)',
                          border: '1px solid var(--line)',
                          background: 'var(--bg-2)',
                        }}
                      >
                        {it.hint}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div
          className="flex gap-4 px-[14px] py-2 border-t text-[11.5px] flex-shrink-0"
          style={{
            borderColor: 'var(--line)',
            background: 'var(--bg-2)',
            color: 'var(--ink-3)',
          }}
        >
          {[
            { keys: ['↑', '↓'], label: 'navegar' },
            { keys: ['↵'], label: 'abrir' },
            { keys: ['esc'], label: 'cerrar' },
          ].map(({ keys, label }) => (
            <span key={label} className="flex items-center gap-1">
              {keys.map(k => (
                <kbd
                  key={k}
                  className="text-[11px] px-[5px] py-px rounded border"
                  style={{
                    fontFamily: 'var(--font-mono)',
                    background: 'var(--surface)',
                    border: '1px solid var(--line)',
                  }}
                >
                  {k}
                </kbd>
              ))}
              <span className="ml-1">{label}</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
