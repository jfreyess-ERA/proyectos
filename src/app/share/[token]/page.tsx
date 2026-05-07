'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Clock, CheckSquare } from 'lucide-react';

const STATUSES: Record<string, { label: string; tone: string }> = {
  backlog: { label: 'Backlog',    tone: 'oklch(0.62 0.02 250)' },
  todo:    { label: 'Por hacer',  tone: 'oklch(0.62 0.05 250)' },
  doing:   { label: 'En curso',   tone: 'oklch(0.62 0.16 265)' },
  review:  { label: 'Revisión',   tone: 'oklch(0.65 0.14 50)'  },
  done:    { label: 'Completado', tone: 'oklch(0.60 0.14 160)' },
};

const PRIORITIES: Record<string, string> = {
  urgent: 'oklch(0.58 0.18 25)',
  high:   'oklch(0.65 0.14 50)',
  med:    'oklch(0.62 0.05 250)',
  low:    'oklch(0.62 0.02 250)',
};

interface TaskRow {
  id: string; ref: string; title: string; status: string; priority: string;
  due_date?: string; assignees: string[]; subtasks_done: number; subtasks_total: number;
}

interface Project { id: string; name: string; color: string; key: string; }

export default function SharePage() {
  const { token } = useParams<{ token: string }>();
  const [project, setProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(`/api/share?token=${encodeURIComponent(token)}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) { setError(d.error); return; }
        setProject(d.project);
        setTasks(d.tasks);
      })
      .catch(() => setError('Error al cargar'))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) return (
    <div className="flex items-center justify-center h-screen" style={{ background: '#fafaf8' }}>
      <div style={{ color: '#888', fontSize: 14 }}>Cargando…</div>
    </div>
  );

  if (error) return (
    <div className="flex flex-col items-center justify-center h-screen gap-3" style={{ background: '#fafaf8' }}>
      <div style={{ fontSize: 32 }}>🔒</div>
      <div style={{ fontSize: 16, fontWeight: 600, color: '#333' }}>Enlace inválido</div>
      <div style={{ fontSize: 13, color: '#888' }}>{error}</div>
    </div>
  );

  const statusGroups = Object.entries(STATUSES).map(([id, def]) => ({
    id, ...def, tasks: tasks.filter(t => t.status === id),
  }));

  const done   = tasks.filter(t => t.status === 'done').length;
  const pct    = tasks.length ? Math.round(done / tasks.length * 100) : 0;
  const today  = new Date(); today.setHours(0,0,0,0);
  const overdue = tasks.filter(t => t.status !== 'done' && t.due_date && new Date(t.due_date + 'T00:00:00') < today).length;

  function fmtDate(d?: string) {
    if (!d) return '';
    return new Date(d + 'T00:00:00').toLocaleDateString('es', { day: 'numeric', month: 'short' });
  }

  return (
    <div style={{ minHeight: '100vh', background: '#fafaf8', fontFamily: 'system-ui, sans-serif' }}>
      {/* Header */}
      <div style={{ borderBottom: '1px solid #e8e5de', background: '#fff', padding: '16px 32px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 12, height: 12, borderRadius: 3, background: project?.color, flexShrink: 0 }} />
          <div>
            <div style={{ fontWeight: 700, fontSize: 18, color: '#1a1a14' }}>{project?.name}</div>
            <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>
              Vista compartida · {tasks.length} tareas · {done} completadas ({pct}%)
              {overdue > 0 && <span style={{ color: '#e53935', marginLeft: 8 }}>· {overdue} atrasadas</span>}
            </div>
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ background: '#f0ede6', borderRadius: 8, padding: '4px 12px', fontSize: 12, color: '#666' }}>
              ERA Group Chile · Sistema de Gestión
            </div>
          </div>
        </div>
        {/* Progress bar */}
        <div style={{ maxWidth: 1100, margin: '12px auto 0' }}>
          <div style={{ height: 4, background: '#e8e5de', borderRadius: 4, overflow: 'hidden' }}>
            <div style={{ height: '100%', background: project?.color, width: `${pct}%`, transition: 'width .3s' }} />
          </div>
        </div>
      </div>

      {/* Board */}
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 32px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${statusGroups.length}, 1fr)`, gap: 16 }}>
          {statusGroups.map(col => (
            <div key={col.id}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10, padding: '0 2px' }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: col.tone, display: 'inline-block' }} />
                <span style={{ fontSize: 12, fontWeight: 600, color: '#555', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {col.label}
                </span>
                <span style={{ fontSize: 11, color: '#aaa', marginLeft: 'auto' }}>{col.tasks.length}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {col.tasks.map(t => {
                  const isOverdue = t.status !== 'done' && t.due_date && new Date(t.due_date + 'T00:00:00') < today;
                  return (
                    <div
                      key={t.id}
                      style={{
                        background: '#fff',
                        border: '1px solid #e8e5de',
                        borderRadius: 10,
                        padding: '10px 12px',
                        fontSize: 13,
                      }}
                    >
                      <div style={{ fontWeight: 500, color: '#1a1a14', lineHeight: 1.35, marginBottom: 6 }}>{t.title}</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 10, color: '#aaa', fontFamily: 'monospace' }}>{t.ref}</span>
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: PRIORITIES[t.priority] ?? '#ccc', flexShrink: 0 }} />
                        {t.due_date && (
                          <span style={{ fontSize: 11, color: isOverdue ? '#e53935' : '#888', display: 'flex', alignItems: 'center', gap: 3, marginLeft: 'auto' }}>
                            <Clock size={10} />
                            {fmtDate(t.due_date)}
                          </span>
                        )}
                        {t.subtasks_total > 0 && (
                          <span style={{ fontSize: 11, color: '#aaa', display: 'flex', alignItems: 'center', gap: 2 }}>
                            <CheckSquare size={10} />
                            {t.subtasks_done}/{t.subtasks_total}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
                {col.tasks.length === 0 && (
                  <div style={{ fontSize: 12, color: '#ccc', textAlign: 'center', padding: '20px 0' }}>—</div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ textAlign: 'center', padding: '24px', fontSize: 11, color: '#bbb', borderTop: '1px solid #e8e5de' }}>
        Vista de solo lectura · ERA Group Chile
      </div>
    </div>
  );
}
