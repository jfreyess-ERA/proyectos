'use client';
import { useState, useEffect } from 'react';
import { fetchTasks, fetchProjects, fetchUsers, fetchLabels } from './db';
import {
  TASKS as SEED_TASKS,
  PROJECTS as SEED_PROJECTS,
  PEOPLE as SEED_PEOPLE,
  LABELS as SEED_LABELS,
} from './data';
import type { Task, Project, User, Label } from './types';

interface NorteData {
  tasks: Task[];
  projects: Project[];
  users: User[];
  labels: Label[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useNorteData(): NorteData {
  const [tasks, setTasks] = useState<Task[]>(SEED_TASKS);
  const [projects, setProjects] = useState<Project[]>(SEED_PROJECTS);
  const [users, setUsers] = useState<User[]>(SEED_PEOPLE);
  const [labels, setLabels] = useState<Label[]>(SEED_LABELS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    Promise.all([fetchTasks(), fetchProjects(), fetchUsers(), fetchLabels()])
      .then(([t, p, u, l]) => {
        if (cancelled) return;
        if (t.length > 0) setTasks(t);
        if (p.length > 0) setProjects(p);
        if (u.length > 0) setUsers(u);
        if (l.length > 0) setLabels(l);
      })
      .catch(err => {
        if (!cancelled) setError(err.message ?? 'Error conectando a Supabase');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [tick]);

  return { tasks, projects, users, labels, loading, error, refetch: () => setTick(t => t + 1) };
}
