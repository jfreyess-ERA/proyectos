'use client';
import { useState } from 'react';
import { Search, Building2, ChevronDown } from 'lucide-react';
import { setClientStatus } from '@/lib/db';
import { EmptyState } from './EmptyState';
import type { Client, ClientStatus, Project, Task } from '@/lib/types';

interface Props {
  clients: Client[];
  projects: Project[];
  tasks: Task[];
  onChanged: () => void;
  onOpenProject: (projectId: string) => void;
}

type Filter = 'todos' | ClientStatus;

/** Sólo 'active' y 'paused' pueden recibir trabajo nuevo — ver openProjects en useNorteData. */
const STATUS_META: Record<ClientStatus, { label: string; fg: string; bg: string; border: string; hidesFromNewWork: boolean }> = {
  active:    { label: 'Activo',             fg: 'var(--accent)',        bg: 'var(--accent-bg)',       border: 'var(--accent)',        hidesFromNewWork: false },
  paused:    { label: 'Detenido',           fg: 'oklch(0.55 0.15 70)',  bg: 'oklch(0.96 0.05 70)',     border: 'oklch(0.75 0.1 70)',   hidesFromNewWork: false },
  completed: { label: 'Contrato terminado', fg: 'var(--ink-3)',         bg: 'var(--bg-3)',             border: 'var(--line)',          hidesFromNewWork: true },
  cancelled: { label: 'Cancelado',          fg: 'oklch(0.55 0.18 25)',  bg: 'oklch(0.96 0.04 25)',     border: 'oklch(0.78 0.1 25)',   hidesFromNewWork: true },
};
const STATUS_ORDER: ClientStatus[] = ['active', 'paused', 'completed', 'cancelled'];

/**
 * ¿Qué clientes están activos y cuáles no, y por qué?
 *
 * "Activo" y "Detenido" siguen disponibles al crear tareas nuevas — Detenido
 * es una pausa, no un cierre. "Contrato terminado" y "Cancelado" sí ocultan
 * al cliente del selector. Ningún estado borra nada: el trabajo histórico
 * sigue visible en reportes y estadísticas pase lo que pase acá.
 */
export function ClientsView({ clients, projects, tasks, onChanged, onOpenProject }: Props) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('todos');
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [openMenu, setOpenMenu] = useState<string | null>(null);

  // Los nombres de cliente viven en projects.client; la tabla clients sólo les
  // agrega estado. Unimos ambos para no perder un cliente escrito a mano que
  // todavía no tenga fila propia.
  const names = [...new Set([
    ...clients.map(c => c.name),
    ...projects.map(p => p.client).filter(Boolean) as string[],
  ])].sort((a, b) => a.localeCompare(b));

  const rows = names.map(name => {
    const record = clients.find(c => c.name === name);
    const status: ClientStatus = record?.status ?? 'active';
    const projs = projects.filter(p => p.client === name);
    const projIds = new Set(projs.map(p => p.id));
    const clientTasks = tasks.filter(t => projIds.has(t.project));
    return {
      name,
      status,
      projects: projs,
      activeTasks: clientTasks.filter(t => t.status !== 'done').length,
      totalTasks: clientTasks.length,
    };
  });

  const visible = rows.filter(r => {
    if (filter !== 'todos' && r.status !== filter) return false;
    if (search && !r.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const activeCount = rows.filter(r => r.status === 'active').length;

  async function changeStatus(name: string, status: ClientStatus) {
    setOpenMenu(null);
    setSaving(name);
    setError(null);
    try {
      await setClientStatus(name, status);
      onChanged();
    } catch (err) {
      setError(`No se pudo actualizar "${name}": ${(err as Error).message}`);
    } finally {
      setSaving(null);
    }
  }

  return (
    <div className="p-6 max-w-[900px]">
      <div className="mb-6">
        <h1 className="text-[24px] font-bold tracking-tight" style={{ color: 'var(--ink)' }}>Clientes</h1>
        <p className="text-[14px] mt-1" style={{ color: 'var(--ink-3)' }}>
          {activeCount} activo{activeCount !== 1 ? 's' : ''} de {rows.length} ·{' '}
          terminado, cancelado y detenido dejan de aparecer al crear tareas — salvo Detenido,
          que sigue disponible por si hay que cargar algo puntual mientras está en pausa.
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
        <div className="flex gap-[3px] flex-wrap">
          <button
            onClick={() => setFilter('todos')}
            className="h-8 px-3 rounded-[7px] text-[12.5px] border-0 transition-colors"
            style={{
              background: filter === 'todos' ? 'var(--accent)' : 'var(--bg-3)',
              color: filter === 'todos' ? 'var(--on-accent)' : 'var(--ink-2)',
              fontWeight: filter === 'todos' ? 600 : 400,
            }}
          >
            Todos
          </button>
          {STATUS_ORDER.map(s => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className="h-8 px-3 rounded-[7px] text-[12.5px] border-0 transition-colors"
              style={{
                background: filter === s ? 'var(--accent)' : 'var(--bg-3)',
                color: filter === s ? 'var(--on-accent)' : 'var(--ink-2)',
                fontWeight: filter === s ? 600 : 400,
              }}
            >
              {STATUS_META[s].label}
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
              style={{ borderTop: i > 0 ? '1px solid var(--line)' : 'none', opacity: r.status === 'active' ? 1 : 0.75 }}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[13.5px] font-semibold truncate" style={{ color: 'var(--ink)' }}>{r.name}</span>
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

              {/* Selector de estado. Texto siempre visible además del color —
                  el estado nunca depende sólo del color. */}
              <div className="relative flex-shrink-0">
                <button
                  onClick={() => setOpenMenu(m => m === r.name ? null : r.name)}
                  disabled={saving === r.name}
                  className="h-8 px-3 rounded-[7px] text-[12.5px] font-medium flex items-center gap-[6px] transition-colors"
                  style={{
                    border: `1px solid ${STATUS_META[r.status].border}`,
                    background: STATUS_META[r.status].bg,
                    color: STATUS_META[r.status].fg,
                    opacity: saving === r.name ? 0.5 : 1,
                  }}
                >
                  {saving === r.name ? 'Guardando…' : STATUS_META[r.status].label}
                  <ChevronDown size={12} />
                </button>

                {openMenu === r.name && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setOpenMenu(null)} />
                    <div
                      className="absolute right-0 top-[calc(100%+4px)] z-20 rounded-[8px] overflow-hidden"
                      style={{ background: 'var(--surface)', border: '1px solid var(--line)', boxShadow: 'var(--shadow-pop)', minWidth: 170 }}
                    >
                      {STATUS_ORDER.map(s => (
                        <button
                          key={s}
                          onClick={() => changeStatus(r.name, s)}
                          className="w-full flex items-center gap-2 px-3 py-2 text-[12.5px] text-left border-0"
                          style={{
                            background: s === r.status ? 'var(--bg-2)' : 'transparent',
                            color: s === r.status ? 'var(--ink)' : 'var(--ink-2)',
                            fontWeight: s === r.status ? 600 : 400,
                          }}
                        >
                          <span className="w-[8px] h-[8px] rounded-full flex-shrink-0" style={{ background: STATUS_META[s].fg }} />
                          {STATUS_META[s].label}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
