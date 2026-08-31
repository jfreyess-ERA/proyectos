'use client';
import { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Shell } from '@/components/Shell';
import { Dashboard } from '@/components/Dashboard';
import { Board } from '@/components/Board';
import { StageBoard } from '@/components/StageBoard';
import { ListView } from '@/components/ListView';
import { CalendarView } from '@/components/CalendarView';
import { TimelineView } from '@/components/TimelineView';
import { TaskDetail } from '@/components/TaskDetail';
import { CommandPalette } from '@/components/CommandPalette';
import { CreateTaskModal } from '@/components/CreateTaskModal';
import { MyTasksView } from '@/components/MyTasksView';
import { InboxView } from '@/components/InboxView';
import { PeopleView } from '@/components/PeopleView';
import { TeamWeekView } from '@/components/TeamWeekView';
import { StatsView } from '@/components/StatsView';
import { PhaseDurationView } from '@/components/PhaseDurationView';
import { SubtaskStatsView } from '@/components/SubtaskStatsView';
import { ClientsView } from '@/components/ClientsView';
import { ReportsView } from '@/components/ReportsView';
import { SettingsPanel } from '@/components/SettingsPanel';
import { ProjectModal } from '@/components/ProjectModal';
import { SprintModal } from '@/components/SprintModal';
import { SprintView } from '@/components/SprintView';
import { SavedView } from '@/components/SavedView';
import { CrmDashboard } from '@/components/CrmDashboard';
import { ProspectsView } from '@/components/ProspectsView';
import { ProspectDetail } from '@/components/ProspectDetail';
import { CreateProspectModal } from '@/components/CreateProspectModal';
import { CrmTasksView } from '@/components/CrmTasksView';
import { InteractionsView } from '@/components/InteractionsView';
import { TriggersView } from '@/components/TriggersView';
import { EmailTemplatesView } from '@/components/EmailTemplatesView';
import { CrmCalendarView } from '@/components/CrmCalendarView';
import { CrmImportModal } from '@/components/CrmImportModal';
import { CreateCrmTaskModal } from '@/components/CreateCrmTaskModal';
import { CrmReports } from '@/components/CrmReports';
import { InviteUserModal } from '@/components/InviteUserModal';
import { EMPTY_FILTERS, applySubtaskFilters } from '@/components/TaskFilterBar';
import { overdueCrmTasks, dueForReactivation } from '@/lib/crm-alerts';
import { UsersContext } from '@/lib/users-context';
import { LabelsContext } from '@/lib/labels-context';
import { ProjectsContext } from '@/lib/projects-context';
import { useNorteData } from '@/lib/useNorteData';
import { useCrmData } from '@/lib/useCrmData';
import { useAuth } from '@/lib/auth-context';
import { getOrCreateShare, deleteTask, deleteProspect, toggleSubtask } from '@/lib/db';
import { useToast } from '@/lib/toast-context';
import { SubtaskDetail } from '@/components/SubtaskDetail';
import type { Task, Project, Sprint, Prospect, DatedSubtask } from '@/lib/types';

type NavId = 'dashboard' | 'inbox' | 'mytasks' | 'people' | 'reports' | 'admin:team-week' | 'admin:clients' | 'admin:stats' | 'admin:durations' | 'admin:subtasks' | string;
type ViewId = 'board' | 'stages' | 'list' | 'timeline' | 'calendar';

export default function Home() {
  const router = useRouter();
  const { session, profile, loading: authLoading } = useAuth();
  const { tasks: allTasks, projects, clients, openProjects, users, labels, sprints, subtasks, datedSubtasks: rawDatedSubtasks, loading, error, refetch } = useNorteData();
  const { prospects: allProspects, interactions, crmTasks, triggers, templates, playbookNodes, playbookEdges, refetch: crmRefetch } = useCrmData();
  const { deleteWithUndo } = useToast();

  // Borrado diferido con deshacer: los ítems marcados se ocultan de toda la app hasta que
  // expira la ventana; el filtro en un solo punto (acá) evita tener que tocar cada consumidor.
  const [hiddenTaskIds, setHiddenTaskIds] = useState<Set<string>>(new Set());
  const [hiddenProspectIds, setHiddenProspectIds] = useState<Set<string>>(new Set());
  const tasks = useMemo(() => hiddenTaskIds.size ? allTasks.filter(t => !hiddenTaskIds.has(t.id)) : allTasks, [allTasks, hiddenTaskIds]);
  const prospects = useMemo(() => hiddenProspectIds.size ? allProspects.filter(p => !hiddenProspectIds.has(p.id)) : allProspects, [allProspects, hiddenProspectIds]);
  const [selectedProspect, setSelectedProspect] = useState<Prospect | null>(null);
  // Subtarea abierta desde un calendario, con su tarea padre para dar contexto.
  const [selectedSubtask, setSelectedSubtask] = useState<{ subtask: DatedSubtask; task: Task } | null>(null);
  // Tildado optimista: refetch tarda, y el check tiene que responder al instante.
  const [subtaskDoneOverride, setSubtaskDoneOverride] = useState<Record<string, boolean>>({});
  const datedSubtasks = useMemo(
    () => Object.keys(subtaskDoneOverride).length === 0
      ? rawDatedSubtasks
      : rawDatedSubtasks.map(s => s.id in subtaskDoneOverride ? { ...s, done: subtaskDoneOverride[s.id] } : s),
    [rawDatedSubtasks, subtaskDoneOverride],
  );
  const [createProspectOpen, setCreateProspectOpen] = useState(false);
  const [importProspectOpen, setImportProspectOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [createCrmTaskOpen, setCreateCrmTaskOpen] = useState(false);

  const [activeNav, setActiveNav]   = useState<NavId>('dashboard');
  const [activeView, setActiveView] = useState<ViewId>('board');
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [cmdkOpen, setCmdkOpen]     = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [createDefaultStatus, setCreateDefaultStatus] = useState<Task['status']>('todo');
  const [settingsOpen, setSettingsOpen]   = useState(false);
  const [projectModalOpen, setProjectModalOpen] = useState(false);
  const [editingProject, setEditingProject]     = useState<Project | undefined>(undefined);
  const [sprintModalOpen, setSprintModalOpen]   = useState(false);
  const [shareLink, setShareLink]   = useState('');
  const [shareCopied, setShareCopied] = useState(false);
  const [localSprints, setLocalSprints] = useState<Sprint[]>([]);

  useEffect(() => { setLocalSprints(sprints); }, [sprints]);

  useEffect(() => {
    if (!authLoading && !session) router.replace('/login');
  }, [authLoading, session, router]);

  // ── Estado en la URL: sección activa + tarea/prospecto abiertos ──
  // Permite compartir un link a una tarea/prospecto puntual, refrescar sin perder
  // el lugar, y back/forward. Se usa history nativo (query only) para no recargar.
  const urlReady = useRef(false);
  const applyingFromUrl = useRef(false);
  const [pendingOpen, setPendingOpen] = useState<{ task?: string; prospect?: string }>({});

  // Leer la URL una vez al montar. (setState-en-effect intencional: sincroniza URL → estado.)
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const nav = p.get('nav');
    if (nav) setActiveNav(nav); // eslint-disable-line react-hooks/set-state-in-effect
    const task = p.get('task');
    const prospect = p.get('prospect');
    if (task || prospect) setPendingOpen({ task: task ?? undefined, prospect: prospect ?? undefined });
    urlReady.current = true;
  }, []);

  // Abrir la tarea/prospecto pendiente cuando los datos ya cargaron.
  useEffect(() => {
    if (!pendingOpen.task || !allTasks.length) return;
    const t = allTasks.find(x => x.id === pendingOpen.task);
    if (t) setSelectedTask(t); // eslint-disable-line react-hooks/set-state-in-effect
    setPendingOpen(o => ({ ...o, task: undefined }));
  }, [pendingOpen.task, allTasks]);
  useEffect(() => {
    if (!pendingOpen.prospect || !allProspects.length) return;
    const pr = allProspects.find(x => x.id === pendingOpen.prospect);
    if (pr) setSelectedProspect(pr); // eslint-disable-line react-hooks/set-state-in-effect
    setPendingOpen(o => ({ ...o, prospect: undefined }));
  }, [pendingOpen.prospect, allProspects]);

  // Escribir la URL cuando cambia la sección o lo abierto (push → back/forward funciona).
  useEffect(() => {
    if (!urlReady.current || applyingFromUrl.current) return;
    const p = new URLSearchParams();
    if (activeNav && activeNav !== 'dashboard') p.set('nav', activeNav);
    if (selectedTask) p.set('task', selectedTask.id);
    if (selectedProspect) p.set('prospect', selectedProspect.id);
    const qs = p.toString();
    const url = qs ? `${window.location.pathname}?${qs}` : window.location.pathname;
    if (url !== window.location.pathname + window.location.search) {
      window.history.pushState(null, '', url);
    }
  }, [activeNav, selectedTask, selectedProspect]);

  // Back/forward: re-aplicar la URL al estado.
  useEffect(() => {
    function onPop() {
      applyingFromUrl.current = true;
      const p = new URLSearchParams(window.location.search);
      setActiveNav(p.get('nav') ?? 'dashboard');
      const task = p.get('task');
      setSelectedTask(task ? (allTasks.find(x => x.id === task) ?? null) : null);
      const prospect = p.get('prospect');
      setSelectedProspect(prospect ? (allProspects.find(x => x.id === prospect) ?? null) : null);
      setTimeout(() => { applyingFromUrl.current = false; }, 0);
    }
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [allTasks, allProspects]);

  const isProjectView = activeNav.startsWith('project:');
  const isSprintView  = activeNav.startsWith('sprint:');
  const projectId     = isProjectView ? activeNav.replace('project:', '') : undefined;
  const sprintId      = isSprintView  ? activeNav.replace('sprint:', '')  : undefined;
  const project       = projectId ? projects.find(p => p.id === projectId) : undefined;
  const activeSprint  = sprintId  ? localSprints.find(s => s.id === sprintId) : undefined;
  const visibleTasks  = projectId ? tasks.filter(t => t.project === projectId) : tasks;

  const isCrmView = activeNav.startsWith('crm:');
  const CRM_LABELS: Record<string, string> = {
    'crm:dashboard': 'Dashboard CRM',
    'crm:prospects': 'Prospectos',
    'crm:interactions': 'Interacciones',
    'crm:tasks': 'Tareas CRM',
    'crm:triggers': 'Triggers',
    'crm:calendar': 'Calendario',
    'crm:templates': 'Plantillas',
    'crm:reports': 'Reportes CRM',
  };

  const ADMIN_LABELS: Record<string, string> = {
    'admin:team-week': 'Panel del equipo',
    'admin:clients':   'Clientes',
    'admin:stats':     'Estadísticas',
    'admin:durations': 'Tiempos por fase',
    'admin:subtasks':  'Subtareas',
  };

  const crumbs = isProjectView && project
    ? ['ERA Group', project.name]
    : isSprintView && activeSprint
    ? ['ERA Group', activeSprint.name]
    : isCrmView
    ? ['ERA Group', 'CRM', CRM_LABELS[activeNav] ?? 'CRM']
    : ADMIN_LABELS[activeNav]
    ? ['ERA Group', 'Administración', ADMIN_LABELS[activeNav]]
    : ['ERA Group', 'Inicio'];

  // Keyboard shortcuts
  useEffect(() => {
    function isTyping() {
      const el = document.activeElement;
      return el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement;
    }
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); setCmdkOpen(o => !o); return; }
      if (e.key === 'Escape') {
        if (cmdkOpen)         { setCmdkOpen(false); return; }
        if (settingsOpen)     { setSettingsOpen(false); return; }
        if (projectModalOpen) { setProjectModalOpen(false); return; }
        if (sprintModalOpen)  { setSprintModalOpen(false); return; }
        if (selectedTask)     { setSelectedTask(null); return; }
      }
      if (isTyping()) return;
      if (e.key === 'n')           { isCrmView ? setCreateCrmTaskOpen(true) : openCreateTask(); return; }
      if (e.key === 'b' && isProjectView) { setActiveView('board'); return; }
      if (e.key === 'e' && isProjectView) { setActiveView('stages'); return; }
      if (e.key === 'l' && isProjectView) { setActiveView('list'); return; }
      if (e.key === 'c' && isProjectView) { setActiveView('calendar'); return; }
      if (e.key === 't' && isProjectView) { setActiveView('timeline'); return; }
      if (e.key === 'g' && e.shiftKey)    { setActiveNav('dashboard'); return; }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [cmdkOpen, selectedTask, settingsOpen, projectModalOpen, sprintModalOpen, isProjectView]);

  function handleNav(id: NavId) {
    setActiveNav(id);
    setActiveView(id.startsWith('project:') ? 'stages' : 'board');
    setCmdkOpen(false);
    setShareLink('');
    setShareCopied(false);
  }

  function openCreateTask(defaultStatus: Task['status'] = 'todo') {
    setCreateDefaultStatus(defaultStatus);
    setCreateOpen(true);
  }

  function openCreateProject() {
    setEditingProject(undefined);
    setProjectModalOpen(true);
  }

  // Borrado con deshacer: cerramos el detalle, ocultamos el ítem, y el DELETE real
  // corre solo si la ventana de deshacer expira.
  function requestDeleteTask(task: Task) {
    setSelectedTask(null);
    setHiddenTaskIds(s => new Set(s).add(task.id));
    deleteWithUndo({
      message: `Tarea "${task.title}" eliminada`,
      onCommit: () => { deleteTask(task.id).then(refetch).catch(console.error); setHiddenTaskIds(s => { const n = new Set(s); n.delete(task.id); return n; }); },
      onUndo: () => setHiddenTaskIds(s => { const n = new Set(s); n.delete(task.id); return n; }),
    });
  }

  // Subtareas en los calendarios: se pueden abrir (panel propio) y tildar sin
  // abrir nada. El optimismo local evita el parpadeo mientras refresca.
  function toggleSubtaskDone(subtask: DatedSubtask, task: Task, done: boolean) {
    setSubtaskDoneOverride(prev => ({ ...prev, [subtask.id]: done }));
    toggleSubtask(subtask.id, done, task.id)
      .then(refetch)
      .catch(console.error);
  }

  function requestDeleteProspect(prospect: Prospect) {
    setSelectedProspect(null);
    setHiddenProspectIds(s => new Set(s).add(prospect.id));
    deleteWithUndo({
      message: `Prospecto "${prospect.company}" eliminado`,
      onCommit: () => { deleteProspect(prospect.id).then(crmRefetch).catch(console.error); setHiddenProspectIds(s => { const n = new Set(s); n.delete(prospect.id); return n; }); },
      onUndo: () => setHiddenProspectIds(s => { const n = new Set(s); n.delete(prospect.id); return n; }),
    });
  }

  function openEditProject(id: string) {
    const p = projects.find(pr => pr.id === id);
    if (!p) return;
    setEditingProject(p);
    setProjectModalOpen(true);
  }

  async function handleShare() {
    if (!projectId) return;
    try {
      const token = await getOrCreateShare(projectId);
      const url = `${window.location.origin}/share/${token}`;
      setShareLink(url);
      await navigator.clipboard.writeText(url);
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 3000);
    } catch (err) {
      console.error(err);
    }
  }

  if (authLoading || !session) {
    return (
      <div className="flex items-center justify-center h-screen" style={{ background: 'var(--bg)' }}>
        <div className="text-[14px]" style={{ color: 'var(--ink-3)' }}>Cargando…</div>
      </div>
    );
  }

  function renderContent() {
    // Sprint view
    if (isSprintView && activeSprint) {
      return (
        <SprintView
          sprint={activeSprint}
          tasks={tasks}
          projects={projects}
          onOpenTask={setSelectedTask}
          onSprintUpdated={s => setLocalSprints(prev => prev.map(x => x.id === s.id ? s : x))}
          onSprintDeleted={id => { setLocalSprints(prev => prev.filter(x => x.id !== id)); setActiveNav('dashboard'); }}
        />
      );
    }

    if (!isProjectView) {
      switch (activeNav) {
        case 'inbox':   return (
          <InboxView
            tasks={tasks} projects={projects} onOpenTask={setSelectedTask}
            crmTasks={crmTasks} prospects={prospects} onOpenProspect={setSelectedProspect}
          />
        );
        case 'mytasks': return <MyTasksView tasks={tasks} projects={projects} datedSubtasks={datedSubtasks} onOpenTask={setSelectedTask} onOpenSubtask={(s, t) => setSelectedSubtask({ subtask: s, task: t })} onToggleSubtask={toggleSubtaskDone} />;
        case 'people':  return <PeopleView tasks={tasks} projects={projects} users={users} datedSubtasks={datedSubtasks} onOpenTask={setSelectedTask} onOpenProject={id => handleNav('project:' + id)} onOpenSubtask={(s, t) => setSelectedSubtask({ subtask: s, task: t })} onToggleSubtask={toggleSubtaskDone} />;
        case 'admin:team-week':
          return profile?.is_admin
            ? <TeamWeekView tasks={tasks} projects={projects} users={users} datedSubtasks={datedSubtasks} onOpenTask={setSelectedTask} onOpenProject={id => handleNav('project:' + id)} onOpenSubtask={(s, t) => setSelectedSubtask({ subtask: s, task: t })} onToggleSubtask={toggleSubtaskDone} />
            : <Dashboard tasks={tasks} projects={projects} onOpenTask={setSelectedTask} onCreateTask={() => openCreateTask()} />;
        case 'admin:clients':
          return profile?.is_admin
            ? <ClientsView clients={clients} projects={projects} tasks={tasks} onChanged={refetch} onOpenProject={id => handleNav('project:' + id)} />
            : <Dashboard tasks={tasks} projects={projects} onOpenTask={setSelectedTask} onCreateTask={() => openCreateTask()} />;
        case 'admin:stats':
          return profile?.is_admin
            ? <StatsView tasks={tasks} projects={projects} users={users} onOpenProject={id => handleNav('project:' + id)} />
            : <Dashboard tasks={tasks} projects={projects} onOpenTask={setSelectedTask} onCreateTask={() => openCreateTask()} />;
        case 'admin:durations':
          return profile?.is_admin
            ? <PhaseDurationView tasks={tasks} projects={projects} onOpenProject={id => handleNav('project:' + id)} />
            : <Dashboard tasks={tasks} projects={projects} onOpenTask={setSelectedTask} onCreateTask={() => openCreateTask()} />;
        case 'admin:subtasks':
          return profile?.is_admin
            ? <SubtaskStatsView subtasks={subtasks} tasks={tasks} projects={projects} users={users} onOpenProject={id => handleNav('project:' + id)} />
            : <Dashboard tasks={tasks} projects={projects} onOpenTask={setSelectedTask} onCreateTask={() => openCreateTask()} />;
        case 'reports': return <ReportsView tasks={tasks} projects={projects} users={users} />;
        case 'crm:dashboard': return (
          <CrmDashboard
            prospects={prospects} interactions={interactions}
            crmTasks={crmTasks} triggers={triggers}
            onViewProspects={() => handleNav('crm:prospects')}
          />
        );
        case 'crm:prospects': return (
          <ProspectsView
            prospects={prospects} interactions={interactions} crmTasks={crmTasks}
            triggers={triggers} users={users}
            onOpenProspect={setSelectedProspect}
            onCreateProspect={() => setCreateProspectOpen(true)}
            onImport={() => setImportProspectOpen(true)}
          />
        );
        case 'crm:interactions': return (
          <InteractionsView
            interactions={interactions} prospects={prospects}
            onOpenProspect={setSelectedProspect}
          />
        );
        case 'crm:calendar': return (
          <CrmCalendarView
            crmTasks={crmTasks} interactions={interactions}
            prospects={prospects}
            onOpenProspect={setSelectedProspect}
          />
        );
        case 'crm:tasks': return (
          <CrmTasksView
            crmTasks={crmTasks} prospects={prospects}
            onOpenProspect={setSelectedProspect}
            onTasksChanged={crmRefetch}
          />
        );
        case 'crm:triggers': return (
          <TriggersView
            triggers={triggers} prospects={prospects}
            onOpenProspect={setSelectedProspect}
            onTriggersChanged={crmRefetch}
          />
        );
        case 'crm:templates': return (
          <EmailTemplatesView templates={templates} prospects={prospects} onTemplatesChanged={crmRefetch} />
        );
        case 'crm:reports': return (
          <CrmReports
            prospects={prospects} interactions={interactions}
            crmTasks={crmTasks} triggers={triggers} users={users}
          />
        );
        case 'saved:week': {
          const now = new Date(); const in7 = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
          const weekTasks = tasks.filter(t => { if (!t.due || t.status === 'done') return false; const d = new Date(t.due); return d >= now && d <= in7; });
          return <SavedView title="Vence esta semana" description="Tareas con fecha límite en los próximos 7 días" tasks={weekTasks} projects={projects} onOpenTask={setSelectedTask} />;
        }
        case 'saved:blockers':
          return <SavedView title="Bloqueantes" description="Tareas marcadas como bloqueantes" tasks={tasks.filter(t => t.labels.includes('l6'))} projects={projects} onOpenTask={setSelectedTask} />;
        default:
          return <Dashboard tasks={tasks} projects={projects} onOpenTask={setSelectedTask} onCreateTask={() => openCreateTask()} />;
      }
    }

    switch (activeView) {
      case 'stages':   return <StageBoard tasks={visibleTasks} users={users} onOpenTask={setSelectedTask} onCreateTask={openCreateTask} />;
      case 'list':     return <ListView tasks={visibleTasks} onOpenTask={setSelectedTask} />;
      case 'calendar': return (
        <CalendarView
          tasks={visibleTasks}
          onOpenTask={setSelectedTask}
          subtaskEvents={applySubtaskFilters(datedSubtasks, tasks, projects, { ...EMPTY_FILTERS, project: projectId ?? 'all' })}
          onOpenSubtask={(s, t) => setSelectedSubtask({ subtask: s, task: t })}
          onToggleSubtask={toggleSubtaskDone}
        />
      );
      case 'timeline': return <TimelineView tasks={visibleTasks} projects={projects} onOpenTask={setSelectedTask} />;
      default:         return <Board tasks={visibleTasks} users={users} onOpenTask={setSelectedTask} onCreateTask={openCreateTask} />;
    }
  }

  return (
    <UsersContext.Provider value={users}>
    <LabelsContext.Provider value={labels}>
    <ProjectsContext.Provider value={projects}>
    <>
      <Shell
        activeNav={activeNav}
        activeView={activeView}
        crumbs={crumbs}
        projectId={projectId}
        projects={projects}
        myProjectIds={profile
          ? new Set(tasks.filter(t => t.assignees?.includes(profile.id)).map(t => t.project))
          : undefined
        }
        sprints={localSprints}
        currentUser={profile ?? undefined}
        onNavChange={handleNav}
        onViewChange={setActiveView}
        onOpenCmdk={() => setCmdkOpen(true)}
        isCrmView={isCrmView}
        onCreateTask={() => isCrmView ? setCreateCrmTaskOpen(true) : openCreateTask()}
        onOpenSettings={() => setSettingsOpen(true)}
        onCreateProject={openCreateProject}
        onEditProject={openEditProject}
        onOpenTask={(taskId) => { const t = tasks.find(t => t.id === taskId); if (t) setSelectedTask(t); }}
        onCreateSprint={() => setSprintModalOpen(true)}
        crmTasks={crmTasks}
        prospects={prospects}
        onOpenProspect={setSelectedProspect}
        loading={loading}
        inboxCount={
          tasks.filter(t => t.status !== 'done' && t.due && new Date(t.due) < new Date()).length
          + overdueCrmTasks(crmTasks).length
          + dueForReactivation(prospects).length
        }
        myTasksCount={profile ? tasks.filter(t => t.status !== 'done' && t.assignees?.includes(profile.id)).length : 0}
      >
        {error && (
          <div className="mx-6 mt-4 px-4 py-3 rounded-[8px] text-[13px]"
            style={{ background: 'var(--danger-bg)', color: 'var(--danger)', border: '1px solid var(--danger)' }}>
            Error Supabase: {error}
          </div>
        )}
        {/* Share button for project views */}
        {isProjectView && (
          <div className="flex items-center gap-2 px-6 pt-3 pb-0">
            <button
              onClick={handleShare}
              className="flex items-center gap-1 h-7 px-3 rounded-[7px] text-[12px] font-medium border-0 transition-colors"
              style={{ background: shareCopied ? 'var(--sem-green-bg-2)' : 'var(--bg-3)', color: shareCopied ? 'var(--sem-green-dark)' : 'var(--ink-3)' }}
            >
              {shareCopied ? '✓ Enlace copiado' : '🔗 Compartir con cliente'}
            </button>
            {shareLink && !shareCopied && (
              <span className="text-[11px] truncate max-w-[300px]" style={{ color: 'var(--ink-4)', fontFamily: 'var(--font-mono)' }}>{shareLink}</span>
            )}
          </div>
        )}
        {renderContent()}
      </Shell>

      <TaskDetail
        task={selectedTask}
        users={users}
        sprints={localSprints.filter(s => selectedTask ? s.project_id === selectedTask.project : false)}
        onClose={() => setSelectedTask(null)}
        onUpdated={updated => { setSelectedTask(updated); refetch(); }}
        onDeleted={() => { if (selectedTask) requestDeleteTask(selectedTask); }}
      />

      <SubtaskDetail
        subtask={selectedSubtask?.subtask ?? null}
        task={selectedSubtask?.task ?? null}
        project={selectedSubtask ? projects.find(p => p.id === selectedSubtask.task.project) : undefined}
        users={users}
        onClose={() => setSelectedSubtask(null)}
        onChanged={refetch}
        onOpenParent={t => { setSelectedSubtask(null); setSelectedTask(t); }}
      />

      <CommandPalette
        open={cmdkOpen}
        onClose={() => setCmdkOpen(false)}
        onNav={handleNav}
        onOpenTask={t => { setSelectedTask(t); setCmdkOpen(false); }}
        onOpenProspect={p => { setSelectedProspect(p); setCmdkOpen(false); }}
        tasks={tasks}
        projects={projects}
        prospects={prospects}
      />

      {/* Trabajo nuevo sólo sobre clientes abiertos. Si estás parado dentro de un
          proyecto de un cliente cerrado, ese proyecto se mantiene disponible para
          no dejarte sin opción en el contexto en el que estás. */}
      <CreateTaskModal
        open={createOpen}
        defaultStatus={createDefaultStatus}
        defaultProjectId={projectId}
        projects={
          projectId && !openProjects.some(p => p.id === projectId) && project
            ? [project, ...openProjects]
            : openProjects
        }
        users={users}
        onClose={() => setCreateOpen(false)}
        onCreated={() => refetch()}
      />

      <CreateCrmTaskModal
        open={createCrmTaskOpen}
        prospects={prospects}
        onClose={() => setCreateCrmTaskOpen(false)}
        onCreated={() => { crmRefetch(); setCreateCrmTaskOpen(false); }}
      />

      <ProjectModal
        open={projectModalOpen}
        project={editingProject}
        existingClients={[...new Set(projects.map(p => p.client).filter(Boolean) as string[])].sort()}
        onClose={() => setProjectModalOpen(false)}
        onSaved={() => {
          refetch();
          if (editingProject && activeNav === 'project:' + editingProject.id) setActiveNav('dashboard');
        }}
      />

      <SprintModal
        open={sprintModalOpen}
        projects={openProjects}
        defaultProjectId={projectId}
        onClose={() => setSprintModalOpen(false)}
        onSaved={s => { setLocalSprints(prev => [...prev, s]); setActiveNav('sprint:' + s.id); }}
      />

      <SettingsPanel
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onInviteUser={() => { setSettingsOpen(false); setInviteOpen(true); }}
      />

      <InviteUserModal
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        onInvited={() => refetch()}
      />

      <ProspectDetail
        prospect={selectedProspect}
        projects={projects}
        playbookNodes={playbookNodes}
        playbookEdges={playbookEdges}
        onClose={() => setSelectedProspect(null)}
        onUpdated={updated => {
          setSelectedProspect(updated);
          crmRefetch();
        }}
        onDeleted={() => { if (selectedProspect) requestDeleteProspect(selectedProspect); }}
      />

      <CreateProspectModal
        open={createProspectOpen}
        existingProspects={prospects}
        onClose={() => setCreateProspectOpen(false)}
        onCreated={p => {
          crmRefetch();
          setSelectedProspect(p);
          setCreateProspectOpen(false);
        }}
      />

      <CrmImportModal
        open={importProspectOpen}
        existingProspects={prospects}
        onClose={() => setImportProspectOpen(false)}
        onImported={() => crmRefetch()}
      />
    </>
    </ProjectsContext.Provider>
    </LabelsContext.Provider>
    </UsersContext.Provider>
  );
}
