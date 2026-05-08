'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Shell } from '@/components/Shell';
import { Dashboard } from '@/components/Dashboard';
import { Board } from '@/components/Board';
import { ListView } from '@/components/ListView';
import { CalendarView } from '@/components/CalendarView';
import { TimelineView } from '@/components/TimelineView';
import { TaskDetail } from '@/components/TaskDetail';
import { CommandPalette } from '@/components/CommandPalette';
import { CreateTaskModal } from '@/components/CreateTaskModal';
import { MyTasksView } from '@/components/MyTasksView';
import { InboxView } from '@/components/InboxView';
import { PeopleView } from '@/components/PeopleView';
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
import { CrmReports } from '@/components/CrmReports';
import { InviteUserModal } from '@/components/InviteUserModal';
import { useNorteData } from '@/lib/useNorteData';
import { useCrmData } from '@/lib/useCrmData';
import { useAuth } from '@/lib/auth-context';
import { getOrCreateShare } from '@/lib/db';
import type { Task, Project, Sprint, Prospect } from '@/lib/types';

type NavId = 'dashboard' | 'inbox' | 'mytasks' | 'people' | 'reports' | string;
type ViewId = 'board' | 'list' | 'timeline' | 'calendar';

export default function Home() {
  const router = useRouter();
  const { session, profile, loading: authLoading } = useAuth();
  const { tasks, projects, users, sprints, loading, error, refetch } = useNorteData();
  const { prospects, interactions, crmTasks, triggers, templates, refetch: crmRefetch } = useCrmData();
  const [selectedProspect, setSelectedProspect] = useState<Prospect | null>(null);
  const [createProspectOpen, setCreateProspectOpen] = useState(false);
  const [importProspectOpen, setImportProspectOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);

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

  const crumbs = isProjectView && project
    ? ['ERA Group', project.name]
    : isSprintView && activeSprint
    ? ['ERA Group', activeSprint.name]
    : isCrmView
    ? ['ERA Group', 'CRM', CRM_LABELS[activeNav] ?? 'CRM']
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
      if (e.key === 'n')           { openCreateTask(); return; }
      if (e.key === 'b' && isProjectView) { setActiveView('board'); return; }
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
    setActiveView('board');
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
        case 'inbox':   return <InboxView tasks={tasks} projects={projects} onOpenTask={setSelectedTask} />;
        case 'mytasks': return <MyTasksView tasks={tasks} projects={projects} onOpenTask={setSelectedTask} />;
        case 'people':  return <PeopleView tasks={tasks} projects={projects} users={users} onOpenTask={setSelectedTask} />;
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
      case 'list':     return <ListView tasks={visibleTasks} onOpenTask={setSelectedTask} />;
      case 'calendar': return <CalendarView tasks={visibleTasks} onOpenTask={setSelectedTask} />;
      case 'timeline': return <TimelineView tasks={visibleTasks} projects={projects} onOpenTask={setSelectedTask} />;
      default:         return <Board tasks={visibleTasks} users={users} onOpenTask={setSelectedTask} onCreateTask={openCreateTask} />;
    }
  }

  return (
    <>
      <Shell
        activeNav={activeNav}
        activeView={activeView}
        crumbs={crumbs}
        projectId={projectId}
        projects={projects}
        sprints={localSprints}
        currentUser={profile ?? undefined}
        onNavChange={handleNav}
        onViewChange={setActiveView}
        onOpenCmdk={() => setCmdkOpen(true)}
        onCreateTask={() => openCreateTask()}
        onOpenSettings={() => setSettingsOpen(true)}
        onCreateProject={openCreateProject}
        onEditProject={openEditProject}
        onOpenTask={(taskId) => { const t = tasks.find(t => t.id === taskId); if (t) setSelectedTask(t); }}
        onCreateSprint={() => setSprintModalOpen(true)}
        loading={loading}
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
              style={{ background: shareCopied ? 'oklch(0.96 0.03 160)' : 'var(--bg-3)', color: shareCopied ? 'oklch(0.38 0.12 160)' : 'var(--ink-3)' }}
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

      <CreateTaskModal
        open={createOpen}
        defaultStatus={createDefaultStatus}
        defaultProjectId={projectId}
        projects={projects}
        users={users}
        onClose={() => setCreateOpen(false)}
        onCreated={() => refetch()}
      />

      <ProjectModal
        open={projectModalOpen}
        project={editingProject}
        onClose={() => setProjectModalOpen(false)}
        onSaved={() => {
          refetch();
          if (editingProject && activeNav === 'project:' + editingProject.id) setActiveNav('dashboard');
        }}
      />

      <SprintModal
        open={sprintModalOpen}
        projects={projects}
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
        onClose={() => setSelectedProspect(null)}
        onUpdated={updated => {
          setSelectedProspect(updated);
          crmRefetch();
        }}
        onDeleted={() => {
          setSelectedProspect(null);
          crmRefetch();
        }}
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
  );
}
