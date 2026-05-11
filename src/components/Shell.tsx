'use client';
import { useState, useEffect } from 'react';
import {
  Home, Inbox, CheckSquare, Users, BarChart2,
  Search, Plus, Filter, SortAsc, Star, Settings,
  PanelLeft, ChevronRight, SlidersHorizontal,
  LayoutGrid, List, GanttChart, Calendar,
  Target, MessageSquare, ListChecks, Zap, Mail, LayoutDashboard, CalendarDays,
  TrendingUp, PieChart,
} from 'lucide-react';
import { PEOPLE } from '@/lib/data';
import { Avatar } from './Avatar';
import { NotificationBell } from './NotificationBell';
import type { Project, Sprint } from '@/lib/types';

type NavId = 'dashboard' | 'inbox' | 'mytasks' | 'people' | 'reports' | string;
type ViewId = 'board' | 'list' | 'timeline' | 'calendar';

interface ShellProps {
  activeNav: NavId;
  activeView?: ViewId;
  crumbs?: string[];
  projectId?: string;
  projects: Project[];
  loading?: boolean;
  inboxCount?: number;
  myTasksCount?: number;
  currentUser?: { name: string; role: string; id: string; initials: string; hue: number };
  onNavChange?: (id: NavId) => void;
  onViewChange?: (id: ViewId) => void;
  onOpenCmdk?: () => void;
  onCreateTask?: () => void;
  onOpenSettings?: () => void;
  onCreateProject?: () => void;
  onEditProject?: (id: string) => void;
  onOpenTask?: (taskId: string) => void;
  onCreateSprint?: () => void;
  sprints?: Sprint[];
  children: React.ReactNode;
}

export function Shell({
  activeNav,
  activeView = 'board',
  crumbs = ['Norte'],
  projectId,
  projects,
  currentUser,
  inboxCount = 0,
  myTasksCount = 0,
  onNavChange,
  onViewChange,
  onOpenCmdk,
  onCreateTask,
  onOpenSettings,
  onCreateProject,
  onEditProject,
  onOpenTask,
  onCreateSprint,
  sprints = [],
  children,
}: ShellProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const me = currentUser ?? PEOPLE[0];

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    setIsMobile(mq.matches);
    const handler = (e: MediaQueryListEvent) => {
      setIsMobile(e.matches);
      if (!e.matches) setMobileOpen(false);
    };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const activeProject = projects.find(p => p.id === projectId);

  return (
    <div
      className="flex h-screen overflow-hidden"
      style={{ background: 'var(--bg)' }}
    >
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 md:hidden"
          style={{ background: 'rgba(0,0,0,0.4)' }}
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className="flex flex-col border-r border-[var(--line)] overflow-hidden transition-all duration-200 flex-shrink-0 fixed md:static z-50 md:z-auto h-full md:transform-none"
        style={{
          width: collapsed ? 60 : 'var(--sidebar-w)',
          background: 'var(--bg-2)',
          left: 0,
          top: 0,
          transform: isMobile ? (mobileOpen ? 'translateX(0)' : 'translateX(-100%)') : undefined,
        }}
      >
        {/* Brand */}
        <div
          className="flex items-center gap-[10px] px-4 border-b border-[var(--line)] flex-shrink-0"
          style={{ height: 'var(--header-h)' }}
        >
          {collapsed ? (
            <img src="/era-icon.png" alt="ERA Group" className="w-[30px] h-[30px] object-contain flex-shrink-0" />
          ) : (
            <div className="flex flex-col gap-1 py-1">
              <img src="/era-logo.png" alt="ERA Group" className="h-[45px] w-auto object-contain" />
              <img src="/era-tagline.png" alt="value through insight" className="h-[28px] w-auto object-contain" />
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
              { id: 'inbox',     icon: <Inbox size={16} />,      label: 'Bandeja',    count: inboxCount || undefined },
              { id: 'mytasks',   icon: <CheckSquare size={16} />, label: 'Mis tareas', count: myTasksCount || undefined },
              { id: 'people',    icon: <Users size={16} />,      label: 'Equipo' },
              { id: 'reports',   icon: <BarChart2 size={16} />,  label: 'Reportes' },
            ].map(item => (
              <button
                key={item.id}
                onClick={() => { onNavChange?.(item.id); setMobileOpen(false); }}
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
                  onClick={() => { onNavChange?.('project:' + p.id); setMobileOpen(false); }}
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

          {/* Sprints */}
          {!collapsed && (
            <div className="px-2 pt-3 pb-1">
              <div className="flex items-center justify-between px-2 pb-1.5">
                <span className="text-[10.5px] font-semibold tracking-widest uppercase" style={{ color: 'var(--ink-4)' }}>
                  Sprints
                </span>
                <button
                  onClick={onCreateSprint}
                  className="border-0 bg-transparent text-[14px] leading-none px-1 rounded"
                  style={{ color: 'var(--ink-4)' }}
                  title="Nuevo sprint"
                >+</button>
              </div>
              {sprints.length === 0 && (
                <div className="px-[10px] py-[4px] text-[12px]" style={{ color: 'var(--ink-4)' }}>Sin sprints</div>
              )}
              {sprints.map(s => {
                const sprintNav = 'sprint:' + s.id;
                const statusDot = s.status === 'active' ? 'var(--accent)' : s.status === 'completed' ? 'oklch(0.60 0.14 160)' : 'var(--ink-4)';
                return (
                  <button
                    key={s.id}
                    onClick={() => { onNavChange?.(sprintNav); setMobileOpen(false); }}
                    className="flex items-center gap-[10px] w-full text-left px-[10px] py-[6px] rounded-[6px] text-[13px] border-0 transition-colors overflow-hidden min-w-0"
                    style={{
                      color: activeNav === sprintNav ? 'var(--ink)' : 'var(--ink-2)',
                      background: activeNav === sprintNav ? 'var(--surface)' : 'transparent',
                      fontWeight: activeNav === sprintNav ? 500 : 400,
                    }}
                  >
                    <span className="w-[8px] h-[8px] rounded-full flex-shrink-0" style={{ background: statusDot }} />
                    <span className="truncate min-w-0">{s.name}</span>
                  </button>
                );
              })}
            </div>
          )}

          {/* CRM */}
          {!collapsed && (
            <div className="px-2 pt-3 pb-1">
              <div className="px-2 pb-1.5 text-[10.5px] font-semibold tracking-widest uppercase" style={{ color: 'var(--ink-4)' }}>
                CRM
              </div>
              {[
                { id: 'crm:dashboard',     icon: <LayoutDashboard size={15} />, label: 'Dashboard CRM' },
                { id: 'crm:prospects',     icon: <Target size={15} />,          label: 'Prospectos' },
                { id: 'crm:interactions',  icon: <MessageSquare size={15} />,   label: 'Interacciones' },
                { id: 'crm:tasks',         icon: <ListChecks size={15} />,      label: 'Tareas CRM' },
                { id: 'crm:triggers',      icon: <Zap size={15} />,             label: 'Triggers' },
                { id: 'crm:calendar',      icon: <CalendarDays size={15} />,    label: 'Calendario' },
                { id: 'crm:templates',     icon: <Mail size={15} />,            label: 'Plantillas' },
                { id: 'crm:reports',       icon: <TrendingUp size={15} />,      label: 'Reportes CRM' },
              ].map(item => (
                <button
                  key={item.id}
                  onClick={() => { onNavChange?.(item.id); setMobileOpen(false); }}
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
                  <span>{item.label}</span>
                </button>
              ))}
            </div>
          )}

          {/* CRM (collapsed) */}
          {collapsed && (
            <div className="px-2 pt-3 pb-1">
              {[
                { id: 'crm:dashboard',    icon: <LayoutDashboard size={15} /> },
                { id: 'crm:prospects',    icon: <Target size={15} /> },
                { id: 'crm:tasks',        icon: <ListChecks size={15} /> },
                { id: 'crm:triggers',     icon: <Zap size={15} /> },
                { id: 'crm:calendar',     icon: <CalendarDays size={15} /> },
                { id: 'crm:templates',    icon: <Mail size={15} /> },
                { id: 'crm:reports',      icon: <TrendingUp size={15} /> },
              ].map(item => (
                <button
                  key={item.id}
                  onClick={() => { onNavChange?.(item.id); setMobileOpen(false); }}
                  className="flex items-center justify-center w-full py-[6px] px-[10px] rounded-[6px] border-0 transition-colors"
                  style={{
                    background: activeNav === item.id ? 'var(--surface)' : 'transparent',
                    color: activeNav === item.id ? 'var(--accent)' : 'var(--ink-3)',
                  }}
                >
                  {item.icon}
                </button>
              ))}
            </div>
          )}

          {/* Análisis de Viabilidad */}
          {!collapsed && (
            <div className="px-2 pt-3 pb-1">
              <div className="px-2 pb-1.5 text-[10.5px] font-semibold tracking-widest uppercase" style={{ color: 'var(--ink-4)' }}>
                Herramientas
              </div>
              <a
                href="/viabilidad/"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-[10px] w-full text-left px-[10px] py-[6px] rounded-[6px] text-[13px] border-0 transition-colors no-underline"
                style={{ color: 'var(--ink-2)', background: 'transparent', fontWeight: 400 }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-2)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <PieChart size={16} style={{ color: 'var(--ink-3)', flexShrink: 0 }} />
                <span>Análisis de Viabilidad</span>
              </a>
            </div>
          )}
          {collapsed && (
            <div className="px-2 pt-3 pb-1">
              <a
                href="/viabilidad/"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center w-full py-[6px] px-[10px] rounded-[6px] border-0 transition-colors"
                style={{ background: 'transparent', color: 'var(--ink-3)' }}
                title="Análisis de Viabilidad"
              >
                <PieChart size={15} />
              </a>
            </div>
          )}

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
                  onClick={() => { onNavChange?.(item.id); setMobileOpen(false); }}
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
      <div className="flex flex-col flex-1 min-w-0 min-h-0 md:ml-0" style={{ background: 'var(--bg)' }}>
        {/* Header */}
        <header
          className="flex items-center gap-4 px-4 md:px-6 border-b border-[var(--line)] flex-shrink-0"
          style={{ height: 'var(--header-h)', background: 'var(--bg)' }}
        >
          {/* Hamburger — mobile only */}
          <button
            onClick={() => setMobileOpen(o => !o)}
            className="w-8 h-8 flex items-center justify-center rounded-[7px] border-0 bg-transparent transition-colors md:hidden"
            style={{ color: 'var(--ink-2)' }}
          >
            <PanelLeft size={16} />
          </button>
          {/* Collapse — desktop only */}
          <button
            onClick={() => setCollapsed(c => !c)}
            className="w-8 h-8 items-center justify-center rounded-[7px] border-0 bg-transparent transition-colors hidden md:flex"
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
