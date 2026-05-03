'use client';
import { useState, useEffect } from 'react';
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
import { useNorteData } from '@/lib/useNorteData';
import type { Task } from '@/lib/types';

type NavId = 'dashboard' | 'inbox' | 'mytasks' | 'people' | 'reports' | string;
type ViewId = 'board' | 'list' | 'timeline' | 'calendar';

export default function Home() {
  const { tasks, projects, users, loading, error, refetch } = useNorteData();

  const [activeNav, setActiveNav] = useState<NavId>('dashboard');
  const [activeView, setActiveView] = useState<ViewId>('board');
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [cmdkOpen, setCmdkOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [createDefaultStatus, setCreateDefaultStatus] = useState<Task['status']>('todo');

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
        if (selectedTask) setSelectedTask(null);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [cmdkOpen, selectedTask]);

  function handleNav(id: NavId) {
    setActiveNav(id);
    setActiveView('board');
    setCmdkOpen(false);
  }

  function openCreateTask(defaultStatus: Task['status'] = 'todo') {
    setCreateDefaultStatus(defaultStatus);
    setCreateOpen(true);
  }

  function renderContent() {
    if (!isProjectView) {
      switch (activeNav) {
        case 'inbox':   return <InboxView tasks={tasks} projects={projects} onOpenTask={setSelectedTask} />;
        case 'mytasks': return <MyTasksView tasks={tasks} projects={projects} onOpenTask={setSelectedTask} />;
        case 'people':  return <PeopleView tasks={tasks} projects={projects} onOpenTask={setSelectedTask} />;
        case 'reports': return <ReportsView tasks={tasks} projects={projects} />;
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
        onNavChange={handleNav}
        onViewChange={setActiveView}
        onOpenCmdk={() => setCmdkOpen(true)}
        onCreateTask={() => openCreateTask()}
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

      <TaskDetail task={selectedTask} onClose={() => setSelectedTask(null)} />

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
    </>
  );
}
