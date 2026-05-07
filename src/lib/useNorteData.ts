'use client';
import { useState, useEffect } from 'react';
import { fetchTasks, fetchProjects, fetchUsers, fetchLabels, fetchAllSprints, taskRowToTask } from './db';
import { supabase } from './supabase';
import {
  TASKS as SEED_TASKS,
  PROJECTS as SEED_PROJECTS,
  PEOPLE as SEED_PEOPLE,
  LABELS as SEED_LABELS,
} from './data';
import type { Task, Project, User, Label, Sprint } from './types';

interface NorteData {
  tasks: Task[];
  projects: Project[];
  users: User[];
  labels: Label[];
  sprints: Sprint[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useNorteData(): NorteData {
  const [tasks, setTasks] = useState<Task[]>(SEED_TASKS);
  const [projects, setProjects] = useState<Project[]>(SEED_PROJECTS);
  const [users, setUsers] = useState<User[]>(SEED_PEOPLE);
  const [labels, setLabels] = useState<Label[]>(SEED_LABELS);
  const [sprints, setSprints] = useState<Sprint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  // Initial fetch
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    Promise.all([fetchTasks(), fetchProjects(), fetchUsers(), fetchLabels(), fetchAllSprints()])
      .then(([t, p, u, l, s]) => {
        if (cancelled) return;
        if (t.length > 0) setTasks(t);
        if (p.length > 0) setProjects(p);
        if (u.length > 0) setUsers(u);
        if (l.length > 0) setLabels(l);
        setSprints(s);
      })
      .catch(err => {
        if (!cancelled) setError(err.message ?? 'Error conectando a Supabase');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [tick]);

  // Realtime: sync task changes across tabs/users
  useEffect(() => {
    const channel = supabase
      .channel('norte-tasks-rt')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tasks' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            setTasks(prev => [...prev, taskRowToTask(payload.new as any)]);
          } else if (payload.eventType === 'UPDATE') {
            setTasks(prev =>
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              prev.map(t => t.id === (payload.new as any).id ? taskRowToTask(payload.new as any) : t)
            );
          } else if (payload.eventType === 'DELETE') {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            setTasks(prev => prev.filter(t => t.id !== (payload.old as any).id));
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  return { tasks, projects, users, labels, sprints, loading, error, refetch: () => setTick(t => t + 1) };
}
