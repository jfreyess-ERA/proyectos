'use client';
import { useState, useRef, useEffect, useMemo, useLayoutEffect } from 'react';
import { ChevronDown, Search, Check } from 'lucide-react';
import type { Project } from '@/lib/types';

interface Props {
  projects: Project[];
  value: string;
  onChange: (projectId: string) => void;
  /** Alto del disparador para calzar con el formulario donde vive (default 36). */
  height?: number;
  placeholder?: string;
}

const norm = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/**
 * Selector de proyecto con búsqueda, agrupado por cliente.
 *
 * Los proyectos se llaman por servicio ("Agua", "Alimentación", "Arriendos") y se
 * repiten entre clientes: una lista plana de ~76 opciones es imposible de escanear.
 * Acá se tipea para filtrar (por cliente o proyecto) y se agrupa bajo el cliente,
 * que es lo que desambigua. Es la acción más frecuente del equipo, así que prioriza
 * el teclado (arquetipo herramienta interna).
 */
export function ProjectPicker({ projects, value, onChange, height = 36, placeholder = 'Seleccionar proyecto' }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0); // índice resaltado en la lista filtrada plana
  const [rect, setRect] = useState<{ left: number; top: number; width: number } | null>(null);

  const triggerRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const selected = projects.find(p => p.id === value);

  // Todos los proyectos ordenados por cliente → nombre (base de todo).
  const sortedAll = useMemo(() =>
    projects.slice().sort((a, b) => {
      const c = (a.client ?? '').localeCompare(b.client ?? '');
      return c !== 0 ? c : a.name.localeCompare(b.name);
    }),
  [projects]);

  // Filtrados por la búsqueda (por cliente o nombre, sin acentos).
  const flat = useMemo(() => {
    const q = norm(query.trim());
    if (!q) return sortedAll;
    return sortedAll.filter(p => norm(`${p.client ?? ''} ${p.name}`).includes(q));
  }, [sortedAll, query]);

  const groups = useMemo(() => {
    const map = new Map<string, Project[]>();
    for (const p of flat) {
      const key = p.client ?? 'Sin cliente';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(p);
    }
    return [...map.entries()];
  }, [flat]);

  function place() {
    const el = triggerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setRect({ left: r.left, top: r.bottom + 4, width: r.width });
  }

  useLayoutEffect(() => { if (open) place(); }, [open]);
  useEffect(() => {
    if (!open) return;
    const onScroll = () => place();
    window.addEventListener('resize', onScroll);
    window.addEventListener('scroll', onScroll, true);
    return () => { window.removeEventListener('resize', onScroll); window.removeEventListener('scroll', onScroll, true); };
  }, [open]);

  // Al abrir: foco en la búsqueda (sync con el DOM). El reset de query/resaltado
  // se hace en openMenu(), no acá, para no disparar setState dentro del effect.
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 20);
  }, [open]);

  function openMenu() {
    setQuery('');
    const idx = sortedAll.findIndex(p => p.id === value);
    setActive(idx >= 0 ? idx : 0);
    setOpen(true);
  }

  // Mantener a la vista la opción resaltada.
  useEffect(() => {
    if (!open) return;
    const node = listRef.current?.querySelector(`[data-idx="${active}"]`) as HTMLElement | null;
    node?.scrollIntoView({ block: 'nearest' });
  }, [active, open]);

  // Cerrar al clickear fuera.
  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      const t = e.target as Node;
      if (triggerRef.current?.contains(t) || listRef.current?.contains(t)) return;
      setOpen(false);
    }
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  function choose(p: Project | undefined) {
    if (!p) return;
    onChange(p.id);
    setOpen(false);
    triggerRef.current?.focus();
  }

  // Delegado: un solo handler para toda la lista (evita cerrar sobre un ref en cada opción del map).
  function onListClick(e: React.MouseEvent) {
    const el = (e.target as HTMLElement).closest('[data-id]') as HTMLElement | null;
    if (el?.dataset.id) choose(projects.find(p => p.id === el.dataset.id));
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(a => Math.min(a + 1, flat.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(a => Math.max(a - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); choose(flat[active]); }
    else if (e.key === 'Escape') { e.preventDefault(); setOpen(false); triggerRef.current?.focus(); }
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => (open ? setOpen(false) : openMenu())}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="w-full flex items-center gap-2 px-2 rounded-[7px] text-[13px] outline-none text-left"
        style={{ height, border: '1px solid var(--line)', background: 'var(--bg-2)', color: selected ? 'var(--ink)' : 'var(--ink-4)' }}
      >
        <span className="flex-1 min-w-0 truncate">
          {selected
            ? <>{selected.client && <span style={{ color: 'var(--ink-4)' }}>{selected.client} · </span>}{selected.name}</>
            : placeholder}
        </span>
        <ChevronDown size={14} className="flex-shrink-0" style={{ color: 'var(--ink-4)' }} />
      </button>

      {open && rect && (
        <div
          ref={listRef}
          role="listbox"
          className="fixed z-[80] flex flex-col rounded-[9px] overflow-hidden"
          style={{
            left: rect.left, top: rect.top, width: Math.max(rect.width, 240),
            maxHeight: 320,
            background: 'var(--surface)', border: '1px solid var(--line)', boxShadow: 'var(--shadow-pop)',
          }}
        >
          <div className="flex items-center gap-2 px-2.5 h-9 border-b flex-shrink-0" style={{ borderColor: 'var(--line)' }}>
            <Search size={13} style={{ color: 'var(--ink-4)' }} />
            <input
              ref={inputRef}
              value={query}
              onChange={e => { setQuery(e.target.value); setActive(0); }}
              onKeyDown={onKeyDown}
              placeholder="Buscar proyecto o cliente…"
              className="flex-1 bg-transparent outline-none text-[13px]"
              style={{ color: 'var(--ink)', fontFamily: 'var(--font)' }}
            />
          </div>

          <div className="overflow-y-auto flex-1 py-1" onClick={onListClick}>
            {flat.length === 0 ? (
              <div className="px-3 py-6 text-center text-[12.5px]" style={{ color: 'var(--ink-4)' }}>
                Ningún proyecto coincide con “{query}”.
              </div>
            ) : (
              groups.map(([client, ps]) => (
                <div key={client}>
                  <div className="px-3 pt-1.5 pb-0.5 text-[10.5px] font-semibold uppercase tracking-wider" style={{ color: 'var(--ink-4)' }}>
                    {client}
                  </div>
                  {ps.map(p => {
                    const idx = flat.indexOf(p);
                    const isActive = idx === active;
                    const isSelected = p.id === value;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        data-id={p.id}
                        data-idx={idx}
                        role="option"
                        aria-selected={isSelected}
                        onMouseEnter={() => setActive(idx)}
                        className="w-full flex items-center gap-2 pl-3 pr-2.5 py-[6px] text-left text-[13px] border-0"
                        style={{ background: isActive ? 'var(--accent-bg)' : 'transparent', color: 'var(--ink)' }}
                      >
                        <span className="w-[8px] h-[8px] rounded-[2px] flex-shrink-0" style={{ background: p.color }} />
                        <span className="flex-1 min-w-0 truncate">{p.name}</span>
                        {isSelected && <Check size={13} className="flex-shrink-0" style={{ color: 'var(--accent)' }} />}
                      </button>
                    );
                  })}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </>
  );
}
