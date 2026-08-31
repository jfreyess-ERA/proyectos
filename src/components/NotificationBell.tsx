'use client';
import { useEffect, useRef, useState } from 'react';
import { Bell, Check, Flame, RotateCcw } from 'lucide-react';
import { fetchNotifications, markNotificationsRead } from '@/lib/db';
import { useAuth } from '@/lib/auth-context';
import { buildCrmAlerts } from '@/lib/crm-alerts';
import type { Notification, CrmTask, Prospect } from '@/lib/types';

const TYPE_ICONS: Record<string, string> = {
  comment:  '💬',
  assigned: '👤',
  overdue:  '⏰',
};

interface Props {
  onOpenTask?: (taskId: string) => void;
  /** Alertas CRM: se derivan en vivo (mismo estado que la Bandeja), no son filas de `notifications`. */
  crmTasks?: CrmTask[];
  prospects?: Prospect[];
  onOpenProspect?: (p: Prospect) => void;
}

export function NotificationBell({ onOpenTask, crmTasks = [], prospects = [], onOpenProspect }: Props) {
  const { profile } = useAuth();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const ref = useRef<HTMLDivElement>(null);

  const unread = notifications.filter(n => !n.read);
  const crmAlerts = buildCrmAlerts(crmTasks, prospects);
  const prospectById = new Map(prospects.map(p => [p.id, p]));
  const totalBadge = unread.length + crmAlerts.length;

  useEffect(() => {
    if (!profile?.id) return;
    fetchNotifications(profile.id).then(setNotifications);
  }, [profile?.id]);

  // Poll every 30s
  useEffect(() => {
    if (!profile?.id) return;
    const interval = setInterval(() => {
      fetchNotifications(profile.id!).then(setNotifications);
    }, 30000);
    return () => clearInterval(interval);
  }, [profile?.id]);

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  async function handleOpen() {
    setOpen(o => !o);
    if (!open && unread.length > 0) {
      const ids = unread.map(n => n.id);
      await markNotificationsRead(ids);
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    }
  }

  function fmtTime(iso: string) {
    const d = new Date(iso);
    const now = new Date();
    const diff = (now.getTime() - d.getTime()) / 1000;
    if (diff < 60)   return 'Ahora';
    if (diff < 3600) return `Hace ${Math.floor(diff / 60)}m`;
    if (diff < 86400) return `Hace ${Math.floor(diff / 3600)}h`;
    return d.toLocaleDateString('es', { day: 'numeric', month: 'short' });
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={handleOpen}
        className="w-8 h-8 flex items-center justify-center rounded-[6px] border-0 bg-transparent relative"
        style={{ color: 'var(--ink-2)' }}
      >
        <Bell size={16} />
        {totalBadge > 0 && (
          <span
            className="absolute top-[5px] right-[5px] min-w-[8px] h-[8px] rounded-full flex items-center justify-center text-[9px] font-bold"
            style={{ background: 'var(--danger)', padding: totalBadge > 9 ? '0 2px' : 0 , color: 'var(--on-danger)'}}
          >
            {totalBadge > 9 ? '9+' : ''}
          </span>
        )}
      </button>

      {open && (
        <div
          className="absolute right-0 top-[calc(100%+6px)] z-50 flex flex-col rounded-[12px] overflow-hidden"
          style={{
            width: 320,
            maxHeight: 420,
            background: 'var(--surface)',
            border: '1px solid var(--line)',
            boxShadow: 'var(--shadow-pop)',
          }}
        >
          <div className="flex items-center justify-between px-4 py-3 border-b flex-shrink-0" style={{ borderColor: 'var(--line)' }}>
            <span className="text-[13px] font-semibold" style={{ color: 'var(--ink)' }}>Notificaciones</span>
            {notifications.some(n => !n.read) && (
              <button
                onClick={async () => {
                  const ids = notifications.filter(n => !n.read).map(n => n.id);
                  await markNotificationsRead(ids);
                  setNotifications(prev => prev.map(n => ({ ...n, read: true })));
                }}
                className="flex items-center gap-1 text-[11px] border-0 bg-transparent"
                style={{ color: 'var(--accent)' }}
              >
                <Check size={11} /> Marcar todas leídas
              </button>
            )}
          </div>

          <div className="overflow-y-auto flex-1">
            {crmAlerts.length > 0 && (
              <div>
                <div className="px-4 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--ink-4)', background: 'var(--bg-2)' }}>
                  Alertas CRM
                </div>
                {crmAlerts.map(a => (
                  <button
                    key={`${a.kind}-${a.id}`}
                    onClick={() => { const p = prospectById.get(a.prospectId); if (p) onOpenProspect?.(p); setOpen(false); }}
                    className="w-full flex items-start gap-3 px-4 py-3 text-left border-b transition-colors"
                    style={{ borderColor: 'var(--line)', background: 'var(--danger-bg)' }}
                  >
                    <span className="flex-shrink-0 mt-[1px]" style={{ color: 'var(--danger)' }}>
                      {a.kind === 'crm_overdue' ? <Flame size={15} /> : <RotateCcw size={15} />}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] leading-snug font-medium" style={{ color: 'var(--ink)' }}>{a.title}</p>
                      <span className="text-[11px]" style={{ color: 'var(--ink-4)' }}>{a.company}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
            {notifications.length === 0 && crmAlerts.length === 0 ? (
              <div className="py-10 text-center text-[13px]" style={{ color: 'var(--ink-4)' }}>
                Sin notificaciones
              </div>
            ) : (
              <>
                {crmAlerts.length > 0 && notifications.length > 0 && (
                  <div className="px-4 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--ink-4)' }}>
                    Notificaciones
                  </div>
                )}
                {notifications.map(n => (
                  <button
                    key={n.id}
                    onClick={() => { onOpenTask?.(n.task_id); setOpen(false); }}
                    className="w-full flex items-start gap-3 px-4 py-3 text-left border-b transition-colors"
                    style={{
                      borderColor: 'var(--line)',
                      background: n.read ? 'transparent' : 'var(--accent-bg)',
                      borderLeft: n.read ? 'none' : '3px solid var(--accent)',
                    }}
                  >
                    <span className="text-[16px] flex-shrink-0 mt-[1px]">{TYPE_ICONS[n.type] ?? '🔔'}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] leading-snug" style={{ color: 'var(--ink)' }}>{n.message}</p>
                      <span className="text-[11px]" style={{ color: 'var(--ink-4)' }}>{fmtTime(n.created_at)}</span>
                    </div>
                  </button>
                ))}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
