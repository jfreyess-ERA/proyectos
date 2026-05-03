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
import { SavedView } from '@/components/SavedView';
import { useNorteData } from '@/lib/useNorteData';
import { useAuth } from '@/lib/auth-context';
import type { Task, Project } from '@/lib/types';

type NavId = 'dashboard' | 'inbox' | 'mytasks' | 'people' | 'reports' | string;
type ViewId = 'board' | 'list' | 'timeline' | 'calendar';

export default function Home() {
  const router = useRouter();
  const { session, profile, loading: authLoading } = useAuth();
  const { tasks, projects, users, loading, error, refetch } = useNorteData();

  const [activeNav, setActiveNav] = useState<NavId>('dashboard');
  const [activeView, setActiveView] = useState<ViewId>('board');
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [cmdkOpen, setCmdkOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [createDefaultStatus, setCreateDefaultStatus] = useState<Task['status']>('todo');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [projectModalOpen, setProjectModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | undefined>(undefined);

  useEffect(() => {
    if (!authLoading && !session) {
      router.replace('/login');
    }
  }, [authLoading, session, router]);

  const isProjectView = activeNav.startsWith('project:');
  const projectId = isProjectView ? activeNav.replace('project:', '') : undefined;
  const project = projectId ? projects.find(p => p.id === projectId) : undefined;
  const visibleTasks = projectId ? tasks.filter(t => t.project === projectId) : tasks;

  const crumbs = isProjectView && project
    ? ['Norte', project.name]
    : ['Norte', 'Inicio'];

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setCmdkOpen(o => !o);
      }
      if (e.key === 'Escape') {
        if (cmdkOpen) { setCmdkOpen(false); return; }
        if (settingsOpen) { setSettingsOpen(false); return; }
        if (projectModalOpen) { setProjectModalOpen(false); return; }
        if (selectedTask) setSelectedTask(null);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [cmdkOpen, selectedTask, settingsOpen, projectModalOpen]);

  function handleNav(id: NavId) {
    setActiveNav(id);
    setActiveView('board');
    setCmdkOpen(false);
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

  if (authLoading || !session) {
    return (
      <div className="flex items-center justify-center h-screen" style={{ background: 'var(--bg)' }}>
        <div className="text-[14px]" style={{ color: 'var(--ink-3)' }}>Cargando…</div>
      </div>
    );
  }

  function renderContent() {
    if (!isProjectView) {
      switch (activeNav) {
        case 'inbox':   return <InboxView tasks={tasks} projects={projects} onOpenTask={setSelectedTask} />;
        case 'mytasks': return <MyTasksView tasks={tasks} projects={projects} onOpenTask={setSelectedTask} />;
        case 'people':  return <PeopleView tasks={tasks} projects={projects} onOpenTask={setSelectedTask} />;
        case 'reports': return <ReportsView tasks={tasks} projects={projects} />;
        case 'saved:week': {
          const now = new Date();
          const in7 = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
          const weekTasks = tasks.filter(t => {
            if (!t.due || t.status === 'done') return false;
            const d = new Date(t.due);
            return d >= now && d <= in7;
          });
          return <SavedView title="Vence esta semana" description="Tareas con fecha límite en los próximos 7 días" tasks={weekTasks} projects={projects} onOpenTask={setSelectedTask} />;
        }
        case 'saved:blockers': {
          const blockerTasks = tasks.filter(t => t.labels.includes('l6'));
          return <SavedView title="Bloqueantes" description="Tareas marcadas como bloqueantes" tasks={blockerTasks} projects={projects} onOpenTask={setSelectedTask} />;
        }
        default:        return <Dashboard tasks={tasks} projects={projects} onOpenTask={setSelectedTask} />;
      }
    }
    switch (activeView) {
      case 'list':     return <ListView tasks={visibleTasks} onOpenTask={setSelectedTask} />;
      case 'calendar': return <CalendarView tasks={visibleTasks} onOpenTask={setSelectedTask} />;
      case 'timeline': return <TimelineView tasks={visibleTasks} projects={projects} onOpenTask={setSelectedTask} />;
      default:         return (
        <Board
          tasks={visibleTasks}
          users={users}
          onOpenTask={setSelectedTask}
          onCreateTask={openCreateTask}
        />
      );
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
        currentUser={profile ?? undefined}
        onNavChange={handleNav}
        onViewChange={setActiveView}
        onOpenCmdk={() => setCmdkOpen(true)}
        onCreateTask={() => openCreateTask()}
        onOpenSettings={() => setSettingsOpen(true)}
        onCreateProject={openCreateProject}
        onEditProject={openEditProject}
        onOpenTask={(taskId) => {
          const t = tasks.find(t => t.id === taskId);
          if (t) setSelectedTask(t);
        }}
        loading={loading}
      >
        {error && (
          <div className="mx-6 mt-4 px-4 py-3 rounded-[8px] text-[13px]"
            style={{ background: 'var(--danger-bg)', color: 'var(--danger)', border: '1px solid var(--danger)' }}>
            Error Supabase: {error}
          </div>
        )}
        {renderContent()}
      </Shell>

      <TaskDetail
        task={selectedTask}
        users={users}
        onClose={() => setSelectedTask(null)}
        onUpdated={updated => { setSelectedTask(updated); refetch(); }}
      />

      <CommandPalette
        open={cmdkOpen}
        onClose={() => setCmdkOpen(false)}
        onNav={handleNav}
        onOpenTask={t => { setSelectedTask(t); setCmdkOpen(false); }}
        tasks={tasks}
        projects={projects}
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
          if (editingProject && activeNav === 'project:' + editingProject.id) {
            setActiveNav('dashboard');
          }
        }}
      />

      <SettingsPanel
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
      />
    </>
  );
}
