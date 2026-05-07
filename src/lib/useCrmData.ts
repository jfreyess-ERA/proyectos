'use client';
import { useState, useEffect, useCallback } from 'react';
import {
  fetchProspects, fetchInteractions, fetchCrmTasks,
  fetchCrmTriggers, fetchEmailTemplates,
} from './db';
import type { Prospect, CrmInteraction, CrmTask, CrmTrigger, EmailTemplate } from './types';

interface CrmData {
  prospects: Prospect[];
  interactions: CrmInteraction[];
  crmTasks: CrmTask[];
  triggers: CrmTrigger[];
  templates: EmailTemplate[];
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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [p, i, t, tr, te] = await Promise.all([
        fetchProspects(),
        fetchInteractions(),
        fetchCrmTasks(),
        fetchCrmTriggers(),
        fetchEmailTemplates(),
      ]);
      setProspects(p);
      setInteractions(i);
      setCrmTasks(t);
      setTriggers(tr);
      setTemplates(te);
    } catch (err) {
      setError((err as Error).message ?? 'Error cargando CRM');
    } finally {
      setLoading(false);
    }
  }, [tick]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [tick]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    prospects, interactions, crmTasks, triggers, templates,
    loading, error,
    refetch: () => setTick(t => t + 1),
  };
}
