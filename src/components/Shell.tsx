'use client';
import { useState } from 'react';
import {
  Home, Inbox, CheckSquare, Users, BarChart2,
  Search, Plus, Filter, SortAsc, Star, Settings,
  PanelLeft, ChevronRight, SlidersHorizontal,
  LayoutGrid, List, GanttChart, Calendar,
} from 'lucide-react';
import { PEOPLE } from '@/lib/data';
import { Avatar } from './Avatar';
import { NotificationBell } from './NotificationBell';
import type { Project } from '@/lib/types';

type NavId = 'dashboard' | 'inbox' | 'mytasks' | 'people' | 'reports' | string;
type ViewId = 'board' | 'list' | 'timeline' | 'calendar';

interface ShellProps {
  activeNav: NavId;
  activeView?: ViewId;
  crumbs?: string[];
  projectId?: string;
  projects: Project[];
  loading?: boolean;
  currentUser?: { name: string; role: string; id: string; initials: string; hue: number };
  onNavChange?: (id: NavId) => void;
  onViewChange?: (id: ViewId) => void;
  onOpenCmdk?: () => void;
  onCreateTask?: () => void;
  onOpenSettings?: () => void;
  onCreateProject?: () => void;
  onEditProject?: (id: string) => void;
  onOpenTask?: (taskId: string) => void;
  children: React.ReactNode;
}

export function Shell({
  activeNav,
  activeView = 'board',
  crumbs = ['Norte'],
  projectId,
  projects,
  currentUser,
  onNavChange,
  onViewChange,
  onOpenCmdk,
  onCreateTask,
  onOpenSettings,
  onCreateProject,
  onEditProject,
  onOpenTask,
  children,
}: ShellProps) {
  const [collapsed, setCollapsed] = useState(false);
  const me = currentUser ?? PEOPLE[0];

  const activeProject = projects.find(p => p.id === projectId);

  return (
    <div
      className="flex h-screen overflow-hidden"
      style={{ background: 'var(--bg)' }}
    >
      {/* Sidebar */}
      <aside
        className="flex flex-col border-r border-[var(--line)] overflow-hidden transition-all duration-200 flex-shrink-0"
        style={{
          width: collapsed ? 60 : 'var(--sidebar-w)',
          background: 'var(--bg-2)',
        }}
      >
        {/* Brand */}
        <div
          className="flex items-center gap-[10px] px-4 border-b border-[var(--line)] flex-shrink-0"
          style={{ height: 'var(--header-h)' }}
        >
          <div
            className="w-[26px] h-[26px] rounded-[7px] flex items-center justify-center text-white font-bold text-[13px] flex-shrink-0"
            style={{
              background: 'linear-gradient(135deg, var(--accent), var(--accent-2))',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,.25)',
            }}
          >
            E
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <div className="font-semibold text-[14.5px] tracking-tight whitespace-nowrap" style={{ color: 'var(--ink)' }}>
                ERA Group Chile
              </div>
              <div className="text-[11px]" style={{ color: 'var(--ink-3)' }}>Sistema de Gestión</div>
            </div>
          )}
        </div>

        {/* Nav */}
        <div className="flex-1 overflow-y-auto pb-2 min-h-0">
          {/* Espacio */}
          <div className="px-2 pt-3 pb-1">
            {!collapsed && (
              <div className="px-2 pb-1.5 text-[10.5px] font-semibold tracking-widest uppercase" style={{ color: 'var(--ink-4)' }}>
                Espacio
              </div>
            )}
            {[
              { id: 'dashboard', icon: <Home size={16} />,       label: 'Inicio' },
              { id: 'inbox',     icon: <Inbox size={16} />,      label: 'Bandeja',    count: 4 },
              { id: 'mytasks',   icon: <CheckSquare size={16} />, label: 'Mis tareas', count: 7 },
              { id: 'people',    icon: <Users size={16} />,      label: 'Equipo' },
              { id: 'reports',   icon: <BarChart2 size={16} />,  label: 'Reportes' },
            ].map(item => (
              <button
                key={item.id}
                onClick={() => onNavChange?.(item.id)}
                className="flex items-center gap-[10px] w-full text-left px-[10px] py-[6px] rounded-[6px] text-[13px] border-0 transition-colors"
                style={{
                  color: activeNav === item.id ? 'var(--ink)' : 'var(--ink-2)',
                  background: activeNav === item.id ? 'var(--surface)' : 'transparent',
                  boxShadow: activeNav === item.id ? 'var(--shadow-1)' : 'none',
                  fontWeight: activeNav === item.id ? 500 : 400,
                }}
              >
                <span style={{ color: activeNav === item.id ? 'var(--accent)' : 'var(--ink-3)', flexShrink: 0 }}>
                  {item.icon}
                </span>
                {!collapsed && <span>{item.label}</span>}
                {!collapsed && item.count != null && (
                  <span className="ml-auto text-[11px] tabular-nums" style={{ color: 'var(--ink-4)' }}>
                    {item.count}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Proyectos */}
          <div className="px-2 pt-3 pb-1">
            {!collapsed && (
              <div className="flex items-center justify-between px-2 pb-1.5">
                <span className="text-[10.5px] font-semibold tracking-widest uppercase" style={{ color: 'var(--ink-4)' }}>
                  Proyectos
                </span>
                <button
                  onClick={onCreateProject}
                  className="border-0 bg-transparent text-[14px] leading-none px-1 rounded"
                  style={{ color: 'var(--ink-4)' }}
                  title="Nuevo proyecto"
                >
                  +
                </button>
              </div>
            )}
            {projects.map(p => (
              <div key={p.id} className="flex items-center group">
                <button
                  onClick={() => onNavChange?.('project:' + p.id)}
                  className="flex items-center gap-[10px] flex-1 text-left px-[10px] py-[6px] rounded-[6px] text-[13px] border-0 transition-colors overflow-hidden min-w-0"
                  style={{
                    color: activeNav === 'project:' + p.id ? 'var(--ink)' : 'var(--ink-2)',
                    background: activeNav === 'project:' + p.id ? 'var(--surface)' : 'transparent',
                    fontWeight: activeNav === 'project:' + p.id ? 500 : 400,
                  }}
                >
                  <span className="w-[10px] h-[10px] rounded-[3px] flex-shrink-0" style={{ background: p.color }} />
                  {!collapsed && (
                    <span className="overflow-hidden text-ellipsis whitespace-nowrap min-w-0">{p.name}</span>
                  )}
                </button>
                {!collapsed && onEditProject && (
                  <button
                    onClick={e => { e.stopPropagation(); onEditProject(p.id); }}
                    className="w-5 h-5 flex items-center justify-center rounded-[4px] border-0 bg-transparent opacity-0 group-hover:opacity-100 flex-shrink-0 mr-1 transition-opacity"
                    style={{ color: 'var(--ink-4)', fontSize: 11 }}
                    title="Editar proyecto"
                  >
                    ···
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Vistas guardadas */}
          {!collapsed && (
            <div className="px-2 pt-3 pb-1">
              <div className="px-2 pb-1.5 text-[10.5px] font-semibold tracking-widest uppercase" style={{ color: 'var(--ink-4)' }}>
                Vistas guardadas
              </div>
              {[
                { id: 'saved:week',     label: 'Vence esta semana' },
                { id: 'saved:blockers', label: 'Bloqueantes' },
              ].map(item => (
                <button
                  key={item.id}
                  onClick={() => onNavChange?.(item.id)}
                  className="flex items-center gap-[10px] w-full text-left px-[10px] py-[6px] rounded-[6px] text-[13px] border-0 transition-colors"
                  style={{
                    color: activeNav === item.id ? 'var(--ink)' : 'var(--ink-2)',
                    background: activeNav === item.id ? 'var(--surface)' : 'transparent',
                    fontWeight: activeNav === item.id ? 500 : 400,
                  }}
                >
                  <Filter size={16} style={{ color: activeNav === item.id ? 'var(--accent)' : 'var(--ink-3)', flexShrink: 0 }} />
                  <span>{item.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer user */}
        <div
          className="flex items-center gap-[10px] px-3 py-[10px] border-t border-[var(--line)] flex-shrink-0"
        >
          <div className="flex items-center gap-[10px] flex-1 p-1 rounded-[8px] cursor-default min-w-0">
            <Avatar userId={me.id} size="md" />
            {!collapsed && (
              <div className="min-w-0 overflow-hidden">
                <div className="text-[12.5px] font-medium leading-tight truncate" style={{ color: 'var(--ink)' }}>{me.name}</div>
                <div className="text-[11px] leading-tight" style={{ color: 'var(--ink-3)' }}>{me.role}</div>
              </div>
            )}
          </div>
          {!collapsed && (
            <button
              onClick={onOpenSettings}
              className="w-8 h-8 flex items-center justify-center rounded-[7px] border-0 bg-transparent transition-colors flex-shrink-0"
              style={{ color: 'var(--ink-2)' }}
              title="Configuración"
            >
              <Settings size={16} />
            </button>
          )}
        </div>
      </aside>

      {/* Main */}
      <div className="flex flex-col flex-1 min-w-0 min-h-0" style={{ background: 'var(--bg)' }}>
        {/* Header */}
        <header
          className="flex items-center gap-4 px-6 border-b border-[var(--line)] flex-shrink-0"
          style={{ height: 'var(--header-h)', background: 'var(--bg)' }}
        >
          <button
            onClick={() => setCollapsed(c => !c)}
            className="w-8 h-8 flex items-center justify-center rounded-[7px] border-0 bg-transparent transition-colors"
            style={{ color: 'var(--ink-2)' }}
            title="Plegar barra lateral"
          >
            <PanelLeft size={16} />
          </button>

          <div className="flex items-center gap-2 text-[13px] min-w-0 flex-shrink-0" style={{ color: 'var(--ink-3)' }}>
            {crumbs.map((c, i) => (
              <span key={i} className="flex items-center gap-2">
                {i > 0 && <ChevronRight size={12} style={{ color: 'var(--ink-4)' }} />}
                <span
                  className={i === crumbs.length - 1 ? 'font-medium' : ''}
                  style={{ color: i === crumbs.length - 1 ? 'var(--ink)' : undefined }}
                >
                  {c}
                </span>
              </span>
            ))}
          </div>

          {/* Search */}
          <div className="relative flex-1 max-w-[360px] ml-auto" onClick={onOpenCmdk}>
            <Search size={14} className="absolute left-[9px] top-1/2 -translate-y-1/2" style={{ color: 'var(--ink-4)' }} />
            <input
              readOnly
              placeholder="Buscar tareas, proyectos, personas…"
              className="w-full h-8 pl-8 pr-10 rounded-[7px] text-[13px] outline-none transition-colors cursor-pointer"
              style={{
                border: '1px solid var(--line)',
                background: 'var(--surface-2)',
                color: 'var(--ink)',
                fontFamily: 'var(--font)',
              }}
            />
            <span
              className="absolute right-2 top-1/2 -translate-y-1/2 text-[11px] px-[5px] py-px rounded"
              style={{
                fontFamily: 'var(--font-mono)',
                color: 'var(--ink-4)',
                border: '1px solid var(--line)',
                background: 'var(--bg-2)',
              }}
            >
              ⌘K
            </span>
          </div>

          <NotificationBell onOpenTask={taskId => onOpenTask?.(taskId)} />

          <button
            onClick={onCreateTask}
            className="h-8 px-3 rounded-[7px] text-[13px] font-medium flex items-center gap-[6px] border-0"
            style={{
              background: 'var(--accent)',
              color: 'var(--on-accent)',
              boxShadow: '0 1px 0 rgba(255,255,255,.2) inset, var(--shadow-1)',
            }}
          >
            <Plus size={14} />
            <span>Nueva tarea</span>
          </button>
        </header>

        {/* Subheader (only for project views) */}
        {activeProject && (
          <div
            className="flex items-center gap-2 px-6 border-b border-[var(--line)] flex-shrink-0"
            style={{ padding: '10px 24px', background: 'var(--bg)' }}
          >
            <div className="flex items-center gap-[10px] min-w-0 flex-shrink-0">
              <span className="w-[10px] h-[10px] rounded-[3px] flex-shrink-0" style={{ background: activeProject.color }} />
              <span className="font-semibold text-[14.5px] whitespace-nowrap" style={{ color: 'var(--ink)' }}>
                {activeProject.name}
              </span>
              <button className="w-[22px] h-[22px] flex items-center justify-center rounded-[5px] border-0 bg-transparent flex-shrink-0" style={{ color: 'var(--ink-4)' }}>
                <Star size={13} />
              </button>
            </div>

            <div
              className="flex gap-[2px] ml-4 rounded-[8px] p-[3px] border border-[var(--line)]"
              style={{ background: 'var(--bg-2)' }}
            >
              {[
                { id: 'board' as ViewId,    icon: <LayoutGrid size={13} />,  label: 'Tablero' },
                { id: 'list' as ViewId,     icon: <List size={13} />,        label: 'Lista' },
                { id: 'timeline' as ViewId, icon: <GanttChart size={13} />,  label: 'Timeline' },
                { id: 'calendar' as ViewId, icon: <Calendar size={13} />,    label: 'Calendario' },
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => onViewChange?.(tab.id)}
                  className="h-[26px] px-[10px] rounded-[6px] text-[12.5px] font-medium flex items-center gap-[6px] border-0 transition-colors"
                  style={{
                    color: activeView === tab.id ? 'var(--ink)' : 'var(--ink-2)',
                    background: activeView === tab.id ? 'var(--surface)' : 'transparent',
                    boxShadow: activeView === tab.id ? 'var(--shadow-1)' : 'none',
                  }}
                  aria-selected={activeView === tab.id}
                >
                  {tab.icon}
                  <span>{tab.label}</span>
                </button>
              ))}
            </div>

            <div className="flex gap-[6px] ml-auto items-center">
              {[
                { icon: <Filter size={13} />, label: 'Filtros' },
                { icon: <SortAsc size={13} />, label: 'Agrupar' },
                { icon: <Users size={13} />, label: 'Asignado' },
              ].map(chip => (
                <button
                  key={chip.label}
                  className="inline-flex items-center gap-[6px] h-[26px] px-[10px] rounded-full text-[12px] border transition-colors"
                  style={{
                    border: '1px solid var(--line)',
                    background: 'var(--surface-2)',
                    color: 'var(--ink-2)',
                  }}
                >
                  {chip.icon}
                  <span>{chip.label}</span>
                </button>
              ))}
              <button className="w-8 h-8 flex items-center justify-center rounded-[7px] border-0 bg-transparent" style={{ color: 'var(--ink-2)' }}>
                <SlidersHorizontal size={15} />
              </button>
            </div>
          </div>
        )}

        {/* Content */}
        <main className="flex-1 min-h-0 overflow-auto" style={{ background: 'var(--bg)' }}>
          {children}
        </main>
      </div>
    </div>
  );
}
