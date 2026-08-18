'use client';
import { useState, useEffect } from 'react';
import { fetchTasks, fetchProjects, fetchClients, fetchUsers, fetchLabels, fetchAllSprints, fetchAllSubtasks, taskRowToTask } from './db';
import { supabase } from './supabase';
import type { Task, Project, Client, User, Label, Sprint, DatedSubtask, SubtaskLite } from './types';

interface NorteData {
  tasks: Task[];
  projects: Project[];
  clients: Client[];
  /** Proyectos de clientes abiertos — lo que se ofrece al crear tareas. */
  openProjects: Project[];
  users: User[];
  labels: Label[];
  sprints: Sprint[];
  subtasks: SubtaskLite[];
  datedSubtasks: DatedSubtask[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useNorteData(): NorteData {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [labels, setLabels] = useState<Label[]>([]);
  const [sprints, setSprints] = useState<Sprint[]>([]);
  const [subtasks, setSubtasks] = useState<SubtaskLite[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  // Initial fetch
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    Promise.all([fetchTasks(), fetchProjects(), fetchUsers(), fetchLabels(), fetchAllSprints(), fetchAllSubtasks(), fetchClients()])
      .then(([t, p, u, l, s, st, c]) => {
        if (cancelled) return;
        setTasks(t);
        setProjects(p);
        setUsers(u);
        setLabels(l);
        setSprints(s);
        setSubtasks(st);
        setClients(c);
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

  // Las subtareas con fecha se derivan de todas — evita una segunda query.
  const datedSubtasks = subtasks.filter(s => s.due_date) as DatedSubtask[];

  // Proyectos que se pueden elegir al crear trabajo nuevo: los de clientes
  // abiertos. Un proyecto sin cliente, o con un cliente que todavía no está en
  // la tabla, se considera abierto (no escondemos nada por omisión).
  const closedClients = new Set(clients.filter(c => !c.active).map(c => c.name));
  const openProjects = projects.filter(p => !p.client || !closedClients.has(p.client));

  return { tasks, projects, clients, openProjects, users, labels, sprints, subtasks, datedSubtasks, loading, error, refetch: () => setTick(t => t + 1) };
}
