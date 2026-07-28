'use client';
import { useState, useEffect, useCallback } from 'react';
import {
  fetchProspects, fetchInteractions, fetchCrmTasks,
  fetchCrmTriggers, fetchEmailTemplates, fetchPlaybook,
} from './db';
import type { Prospect, CrmInteraction, CrmTask, CrmTrigger, EmailTemplate, PlaybookNode, PlaybookEdge } from './types';

interface CrmData {
  prospects: Prospect[];
  interactions: CrmInteraction[];
  crmTasks: CrmTask[];
  triggers: CrmTrigger[];
  templates: EmailTemplate[];
  playbookNodes: PlaybookNode[];
  playbookEdges: PlaybookEdge[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useCrmData(): CrmData {
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [interactions, setInteractions] = useState<CrmInteraction[]>([]);
  const [crmTasks, setCrmTasks] = useState<CrmTask[]>([]);
  const [triggers, setTriggers] = useState<CrmTrigger[]>([]);
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [playbookNodes, setPlaybookNodes] = useState<PlaybookNode[]>([]);
  const [playbookEdges, setPlaybookEdges] = useState<PlaybookEdge[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [p, i, t, tr, te, pb] = await Promise.all([
        fetchProspects(),
        fetchInteractions(),
        fetchCrmTasks(),
        fetchCrmTriggers(),
        fetchEmailTemplates(),
        fetchPlaybook(),
      ]);
      setProspects(p);
      setInteractions(i);
      setCrmTasks(t);
      setTriggers(tr);
      setTemplates(te);
      setPlaybookNodes(pb.nodes);
      setPlaybookEdges(pb.edges);
    } catch (err) {
      setError((err as Error).message ?? 'Error cargando CRM');
    } finally {
      setLoading(false);
    }
  }, [tick]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [tick]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    prospects, interactions, crmTasks, triggers, templates,
    playbookNodes, playbookEdges,
    loading, error,
    refetch: () => setTick(t => t + 1),
  };
}
