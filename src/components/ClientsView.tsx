'use client';
import { useState } from 'react';
import { Search, Building2, Check } from 'lucide-react';
import { setClientActive } from '@/lib/db';
import { EmptyState } from './EmptyState';
import type { Client, Project, Task } from '@/lib/types';

interface Props {
  clients: Client[];
  projects: Project[];
  tasks: Task[];
  onChanged: () => void;
  onOpenProject: (projectId: string) => void;
}

type Filter = 'todos' | 'abiertos' | 'cerrados';

/**
 * ¿Qué clientes están activos y cuáles cerramos?
 *
 * Cerrar un cliente no borra nada: sus proyectos dejan de aparecer al crear
 * tareas nuevas, pero el trabajo histórico sigue visible en reportes y
 * estadísticas. Es la palanca para que el selector de proyecto no siga
 * creciendo con clientes que ya no están activos.
 */
export function ClientsView({ clients, projects, tasks, onChanged, onOpenProject }: Props) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('todos');
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Los nombres de cliente viven en projects.client; la tabla clients sólo les
  // agrega estado. Unimos ambos para no perder un cliente escrito a mano que
  // todavía no tenga fila propia.
  const names = [...new Set([
    ...clients.map(c => c.name),
    ...projects.map(p => p.client).filter(Boolean) as string[],
  ])].sort((a, b) => a.localeCompare(b));

  const rows = names.map(name => {
    const record = clients.find(c => c.name === name);
    const active = record?.active ?? true;
    const projs = projects.filter(p => p.client === name);
    const projIds = new Set(projs.map(p => p.id));
    const clientTasks = tasks.filter(t => projIds.has(t.project));
    return {
      name,
      active,
      projects: projs,
      activeTasks: clientTasks.filter(t => t.status !== 'done').length,
      totalTasks: clientTasks.length,
    };
  });

  const visible = rows.filter(r => {
    if (filter === 'abiertos' && !r.active) return false;
    if (filter === 'cerrados' && r.active) return false;
    if (search && !r.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const openCount = rows.filter(r => r.active).length;

  async function toggle(name: string, nextActive: boolean) {
    setSaving(name);
    setError(null);
    try {
      await setClientActive(name, nextActive);
      onChanged();
    } catch (err) {
      setError(`No se pudo ${nextActive ? 'reabrir' : 'cerrar'} "${name}": ${(err as Error).message}`);
    } finally {
      setSaving(null);
    }
  }

  return (
    <div className="p-6 max-w-[900px]">
      <div className="mb-6">
        <h1 className="text-[24px] font-bold tracking-tight" style={{ color: 'var(--ink)' }}>Clientes</h1>
        <p className="text-[14px] mt-1" style={{ color: 'var(--ink-3)' }}>
          {openCount} abierto{openCount !== 1 ? 's' : ''} de {rows.length} ·{' '}
          los cerrados dejan de aparecer al crear tareas, pero conservan su historial.
        </p>
      </div>

      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <div className="relative">
          <Search size={13} className="absolute left-[9px] top-1/2 -translate-y-1/2" style={{ color: 'var(--ink-4)' }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar cliente…"
            className="h-8 pl-7 pr-3 rounded-[7px] text-[13px] outline-none"
            style={{ width: 240, border: '1px solid var(--line)', background: 'var(--bg-2)', color: 'var(--ink)', fontFamily: 'var(--font)' }}
          />
        </div>
        <div className="flex gap-[3px]">
          {(['todos', 'abiertos', 'cerrados'] as Filter[]).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className="h-8 px-3 rounded-[7px] text-[12.5px] border-0 transition-colors capitalize"
              style={{
                background: filter === f ? 'var(--accent)' : 'var(--bg-3)',
                color: filter === f ? 'var(--on-accent)' : 'var(--ink-2)',
                fontWeight: filter === f ? 600 : 400,
              }}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="mb-4 px-3 py-2 rounded-[8px] text-[12.5px]"
          style={{ background: 'var(--danger-bg)', color: 'var(--danger)', border: '1px solid var(--danger)' }}>
          {error}
        </div>
      )}

      {visible.length === 0 ? (
        <EmptyState
          icon={<Building2 size={26} />}
          title={rows.length === 0 ? 'Todavía no hay clientes' : 'Sin resultados'}
          hint={rows.length === 0
            ? 'Los clientes aparecen acá cuando creás un proyecto y le asignás una empresa.'
            : 'Ningún cliente coincide con la búsqueda o el filtro.'}
        />
      ) : (
        <div className="rounded-[12px] overflow-hidden" style={{ border: '1px solid var(--line)', background: 'var(--surface)' }}>
          {visible.map((r, i) => (
            <div
              key={r.name}
              className="flex items-center gap-4 px-4 py-3"
              style={{ borderTop: i > 0 ? '1px solid var(--line)' : 'none', opacity: r.active ? 1 : 0.62 }}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[13.5px] font-semibold truncate" style={{ color: 'var(--ink)' }}>{r.name}</span>
                  {!r.active && (
                    <span className="text-[10.5px] font-medium px-[7px] py-[2px] rounded-full flex-shrink-0"
                      style={{ background: 'var(--bg-3)', color: 'var(--ink-3)' }}>
                      Cerrado
                    </span>
                  )}
                </div>
                <div className="text-[12px] mt-[2px] flex items-center gap-2 flex-wrap" style={{ color: 'var(--ink-4)' }}>
                  <span>{r.projects.length} proyecto{r.projects.length !== 1 ? 's' : ''}</span>
                  <span>·</span>
                  <span>{r.activeTasks} tarea{r.activeTasks !== 1 ? 's' : ''} activa{r.activeTasks !== 1 ? 's' : ''}</span>
                  {r.totalTasks > r.activeTasks && (
                    <>
                      <span>·</span>
                      <span>{r.totalTasks - r.activeTasks} completada{r.totalTasks - r.activeTasks !== 1 ? 's' : ''}</span>
                    </>
                  )}
                </div>
                {r.projects.length > 0 && (
                  <div className="flex gap-[6px] mt-[6px] flex-wrap">
                    {r.projects.slice(0, 6).map(p => (
                      <button
                        key={p.id}
                        onClick={() => onOpenProject(p.id)}
                        className="flex items-center gap-[5px] h-[22px] px-2 rounded-[6px] text-[11.5px] border-0"
                        style={{ background: 'var(--bg-3)', color: 'var(--ink-2)' }}
                      >
                        <span className="w-[7px] h-[7px] rounded-[2px] flex-shrink-0" style={{ background: p.color }} />
                        {p.name}
                      </button>
                    ))}
                    {r.projects.length > 6 && (
                      <span className="text-[11.5px] self-center" style={{ color: 'var(--ink-4)' }}>
                        +{r.projects.length - 6}
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Abierto / cerrado. Botón con texto además del color: el estado no
                  puede depender sólo del color. */}
              <button
                onClick={() => toggle(r.name, !r.active)}
                disabled={saving === r.name}
                className="h-8 px-3 rounded-[7px] text-[12.5px] font-medium flex items-center gap-[6px] flex-shrink-0 transition-colors"
                style={{
                  border: `1px solid ${r.active ? 'var(--accent)' : 'var(--line)'}`,
                  background: r.active ? 'var(--accent-bg)' : 'var(--surface-2)',
                  color: r.active ? 'var(--accent)' : 'var(--ink-3)',
                  opacity: saving === r.name ? 0.5 : 1,
                }}
                title={r.active ? 'Cerrar cliente' : 'Reabrir cliente'}
              >
                {r.active && <Check size={12} />}
                {saving === r.name ? 'Guardando…' : r.active ? 'Abierto' : 'Cerrado'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
