'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { X, Paperclip, Archive, MoreHorizontal, Plus, Send, Trash2, FileText, Image as ImageIcon, Upload, Check } from 'lucide-react';
import {
  fmtDate, PEOPLE, STATUSES, PRIORITIES,
} from '@/lib/data';
import { useLabels } from '@/lib/labels-context';
import { useProjects } from '@/lib/projects-context';
import {
  updateTask, deleteTask, fetchComments, insertComment,
  logActivity, fetchActivity,
  fetchAttachments, uploadAttachment, deleteAttachment,
  fetchSubtasks, insertSubtask, toggleSubtask, deleteSubtask, updateSubtask,
} from '@/lib/db';
import { useAuth } from '@/lib/auth-context';
import { assignTaskToSprint } from '@/lib/db';
import { Avatar } from './Avatar';
import type { Task, Comment, Activity, Attachment, User, SubtaskItem, Sprint } from '@/lib/types';
import { PROJECT_STAGES } from './StageBoard';

interface Props {
  task: Task | null;
  users?: User[];
  sprints?: Sprint[];
  onClose: () => void;
  onUpdated?: (t: Task) => void;
  onDeleted?: (id: string) => void;
}

export function TaskDetail({ task, users = [], sprints = [], onClose, onUpdated, onDeleted }: Props) {
  const { profile } = useAuth();
  const allLabels = useLabels();
  const allProjects = useProjects();
  const allPeople = users.length > 0 ? users : PEOPLE;

  const [edited, setEdited]         = useState<Task | null>(null);
  const [saving, setSaving]         = useState(false);
  const [comments, setComments]     = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [postingComment, setPostingComment] = useState(false);
  const [editingTitle, setEditingTitle]     = useState(false);
  const [editingDesc, setEditingDesc]       = useState(false);
  const [activity, setActivity]     = useState<Activity[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [uploading, setUploading]   = useState(false);
  const [subtasks, setSubtasks]     = useState<SubtaskItem[]>([]);
  const [newSubtask, setNewSubtask] = useState('');
  const [addingSubtask, setAddingSubtask] = useState(false);
  const [showLabelPicker, setShowLabelPicker] = useState(false);
  const [showMenu, setShowMenu]     = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting]     = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const labelPickerRef = useRef<HTMLDivElement>(null);
  const menuRef         = useRef<HTMLDivElement>(null);
  const fileInputRef   = useRef<HTMLInputElement>(null);

  // ── Timer ──────────────────────────────────────────────────────────
  const [timerRunning, setTimerRunning] = useState(false);
  const [timerElapsed, setTimerElapsed] = useState(0); // seconds
  const timerStartRef  = useRef<number>(0);

  useEffect(() => {
    if (!task) return;
    setEdited(task);
    setEditingTitle(false);
    setEditingDesc(false);
    setShowLabelPicker(false);
    setShowMenu(false);
    setConfirmingDelete(false);
    setDeleteError(null);
    fetchComments(task.id).then(setComments).catch(() => {});
    fetchActivity(task.id).then(setActivity).catch(() => {});
    fetchAttachments(task.id).then(setAttachments).catch(() => {});
    fetchSubtasks(task.id).then(setSubtasks).catch(() => {});
  }, [task?.id]);

  // Close label picker / task menu on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (labelPickerRef.current && !labelPickerRef.current.contains(e.target as Node)) {
        setShowLabelPicker(false);
      }
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Stop timer when task changes
  useEffect(() => {
    setTimerRunning(false);
    setTimerElapsed(0);
  }, [task?.id]);

  useEffect(() => {
    if (!timerRunning) return;
    timerStartRef.current = Date.now() - timerElapsed * 1000;
    const interval = setInterval(() => {
      setTimerElapsed(Math.floor((Date.now() - timerStartRef.current) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [timerRunning]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!task || !edited) return null;

  const taskId  = task.id;
  const project = allProjects.find(p => p.id === edited.project);
  const labels  = edited.labels.map(id => allLabels.find(l => l.id === id)).filter(Boolean);
  const spentPct   = edited.estimate > 0 ? Math.min(100, (edited.spent / edited.estimate) * 100) : 0;
  const overBudget = edited.spent > edited.estimate;

  async function save(fields: Partial<Task>, activityMsg?: string) {
    setSaving(true);
    try {
      const dbFields: Record<string, unknown> = {};
      if ('status' in fields)      dbFields.status      = fields.status;
      if ('priority' in fields)    dbFields.priority    = fields.priority;
      if ('start' in fields)       dbFields.start_date  = fields.start ?? null;
      if ('due' in fields)         dbFields.due_date    = fields.due ?? null;
      if ('title' in fields)       dbFields.title       = fields.title;
      if ('description' in fields) dbFields.description = fields.description;
      if ('assignees' in fields)   dbFields.assignees   = fields.assignees;
      if ('labels' in fields)      dbFields.label_ids   = fields.labels;
      if ('estimate' in fields)      dbFields.estimate      = fields.estimate;
      if ('spent' in fields)         dbFields.spent         = fields.spent;
      if ('project_stage' in fields) dbFields.project_stage = fields.project_stage ?? null;

      const updated = await updateTask(taskId, dbFields as Parameters<typeof updateTask>[1]);
      setEdited(updated);
      onUpdated?.(updated);

      if (activityMsg && profile?.id) {
        await logActivity(taskId, profile.id, activityMsg);
        fetchActivity(taskId).then(setActivity).catch(() => {});
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!task) return;
    setDeleting(true);
    try {
      await deleteTask(task.id);
      onDeleted?.(task.id);
      onClose();
    } catch (e) {
      console.error(e);
      setDeleteError('No se pudo eliminar la tarea.');
      setDeleting(false);
    }
  }

  function patch(fields: Partial<Task>, activityMsg?: string) {
    setEdited(prev => prev ? { ...prev, ...fields } : prev);
    save(fields, activityMsg);
  }

  function toggleAssignee(userId: string) {
    const current = edited!.assignees;
    const next    = current.includes(userId) ? current.filter(id => id !== userId) : [...current, userId];
    const user    = allPeople.find(u => u.id === userId);
    const action  = current.includes(userId) ? `Removió a ${user?.name ?? userId}` : `Asignó a ${user?.name ?? userId}`;
    patch({ assignees: next }, action);
  }

  function toggleLabel(labelId: string) {
    const current = edited!.labels;
    const next    = current.includes(labelId) ? current.filter(id => id !== labelId) : [...current, labelId];
    const lbl     = allLabels.find(l => l.id === labelId);
    const action  = current.includes(labelId) ? `Quitó etiqueta "${lbl?.text}"` : `Agregó etiqueta "${lbl?.text}"`;
    setEdited(prev => prev ? { ...prev, labels: next } : prev);
    save({ labels: next }, action);
  }

  async function handleComment(e: React.FormEvent) {
    e.preventDefault();
    if (!newComment.trim() || !profile) return;
    setPostingComment(true);
    try {
      const c = await insertComment(taskId, profile.id, newComment.trim());
      setComments(prev => [...prev, c]);
      setNewComment('');
      await logActivity(taskId, profile.id, 'Agregó un comentario');
      fetchActivity(taskId).then(setActivity).catch(() => {});
    } catch (e) { console.error(e); } finally { setPostingComment(false); }
  }

  async function handleAddSubtask(e: React.FormEvent) {
    e.preventDefault();
    if (!newSubtask.trim()) return;
    setAddingSubtask(true);
    try {
      const item = await insertSubtask(taskId, newSubtask.trim());
      setSubtasks(prev => [...prev, item]);
      setNewSubtask('');
      // Update local task summary
      setEdited(prev => prev ? { ...prev, subtasks: { done: prev.subtasks.done, total: prev.subtasks.total + 1 } } : prev);
      if (task) onUpdated?.(task); // refresh parent rollup (subtask counts) in the app
    } catch (e) { console.error(e); } finally { setAddingSubtask(false); }
  }

  async function handleToggleSubtask(sub: SubtaskItem) {
    const next = !sub.done;
    setSubtasks(prev => prev.map(s => s.id === sub.id ? { ...s, done: next } : s));
    setEdited(prev => {
      if (!prev) return prev;
      const delta = next ? 1 : -1;
      return { ...prev, subtasks: { done: prev.subtasks.done + delta, total: prev.subtasks.total } };
    });
    await toggleSubtask(sub.id, next, taskId);
    if (task) onUpdated?.(task);
  }

  async function handleDeleteSubtask(sub: SubtaskItem) {
    setSubtasks(prev => prev.filter(s => s.id !== sub.id));
    setEdited(prev => {
      if (!prev) return prev;
      return { ...prev, subtasks: { done: sub.done ? prev.subtasks.done - 1 : prev.subtasks.done, total: prev.subtasks.total - 1 } };
    });
    await deleteSubtask(sub.id, taskId);
    if (task) onUpdated?.(task);
  }

  async function handleSubtaskField(sub: SubtaskItem, fields: Partial<{ due_date: string | null; assignee: string | null }>) {
    setSubtasks(prev => prev.map(s => s.id === sub.id ? { ...s, ...fields } : s));
    await updateSubtask(sub.id, taskId, fields);
    if (task) onUpdated?.(task);
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !profile) return;
    setUploading(true);
    try {
      const att = await uploadAttachment(taskId, profile.id, file);
      setAttachments(prev => [...prev, att]);
      await logActivity(taskId, profile.id, `Adjuntó ${file.name}`);
      fetchActivity(taskId).then(setActivity).catch(() => {});
    } catch (err) { console.error(err); } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function handleDeleteAttachment(att: Attachment) {
    try {
      await deleteAttachment(att.id, att.storage_path);
      setAttachments(prev => prev.filter(a => a.id !== att.id));
      if (profile?.id) {
        await logActivity(taskId, profile.id, `Eliminó adjunto ${att.name}`);
        fetchActivity(taskId).then(setActivity).catch(() => {});
      }
    } catch (err) { console.error(err); }
  }

  function fmtTimer(secs: number): string {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  async function stopTimerAndLog() {
    if (!timerRunning) return;
    setTimerRunning(false);
    const hoursAdded = timerElapsed / 3600;
    if (hoursAdded < 0.001) return;
    const newSpent = Math.round(((edited!.spent ?? 0) + hoursAdded) * 100) / 100;
    setEdited(prev => prev ? { ...prev, spent: newSpent } : prev);
    await save({ spent: newSpent }, `Registró ${fmtTimer(timerElapsed)} de trabajo`);
    setTimerElapsed(0);
  }

  function fmtSize(bytes?: number) {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  function isImage(name: string) { return /\.(png|jpe?g|gif|webp|svg)$/i.test(name); }

  function fmtActivityTime(iso: string) {
    const d = new Date(iso);
    const diff = (Date.now() - d.getTime()) / 1000;
    if (diff < 60)    return 'Ahora';
    if (diff < 3600)  return `Hace ${Math.floor(diff / 60)}m`;
    if (diff < 86400) return `Hace ${Math.floor(diff / 3600)}h`;
    return d.toLocaleDateString('es', { day: 'numeric', month: 'short' });
  }

  return (
    <>
    <div
      className="fixed inset-0 z-50 grid place-items-center"
      style={{ background: 'rgba(20,18,12,.32)', backdropFilter: 'blur(2px)' }}
      onClick={onClose}
    >
      <div
        className="flex flex-col overflow-hidden"
        style={{
          width: 'min(900px, 92vw)', maxHeight: '90vh',
          background: 'var(--surface)', border: '1px solid var(--line)',
          borderRadius: 14, boxShadow: 'var(--shadow-pop)',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b flex-shrink-0" style={{ borderColor: 'var(--line)' }}>
          <div className="flex items-center gap-[10px]">
            <span className="w-2 h-2 rounded-[2px]" style={{ background: project?.color }} />
            <span className="text-[12.5px]" style={{ color: 'var(--ink-3)' }}>
              {project?.client && `${project.client} · `}{project?.name} · {task.ref}
            </span>
            {saving && <span className="text-[11px]" style={{ color: 'var(--ink-4)' }}>Guardando…</span>}
          </div>
          <div className="flex items-center gap-1">
            <IconBtn onClick={() => fileInputRef.current?.click()}><Paperclip size={15} /></IconBtn>
            <IconBtn><Archive size={15} /></IconBtn>
            <div className="relative" ref={menuRef}>
              <IconBtn onClick={() => setShowMenu(o => !o)}><MoreHorizontal size={15} /></IconBtn>
              {showMenu && (
                <div
                  className="absolute right-0 top-[calc(100%+4px)] z-10 rounded-[10px] overflow-hidden flex flex-col py-1"
                  style={{ width: 180, background: 'var(--surface)', border: '1px solid var(--line)', boxShadow: 'var(--shadow-pop)' }}
                >
                  <button
                    onClick={() => { setShowMenu(false); setDeleteError(null); setConfirmingDelete(true); }}
                    className="flex items-center gap-2 px-3 py-[7px] text-left text-[12.5px] border-0 bg-transparent transition-colors"
                    style={{ color: 'var(--danger)' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--danger-bg)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <Trash2 size={13} />
                    Eliminar tarea
                  </button>
                </div>
              )}
            </div>
            <IconBtn onClick={onClose}><X size={15} /></IconBtn>
          </div>
        </div>

        {/* Body */}
        <div className="flex flex-1 min-h-0 overflow-hidden">
          {/* Main */}
          <div className="flex-1 min-w-0 overflow-y-auto p-6 flex flex-col gap-6">

            {/* Title */}
            {editingTitle ? (
              <textarea
                value={edited.title}
                onChange={e => setEdited(prev => prev ? { ...prev, title: e.target.value } : prev)}
                onBlur={() => { setEditingTitle(false); save({ title: edited.title }, 'Actualizó el título'); }}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); setEditingTitle(false); save({ title: edited.title }, 'Actualizó el título'); }}}
                autoFocus rows={2}
                className="w-full text-[20px] font-semibold leading-tight tracking-tight resize-none border-0 bg-transparent outline-none rounded-[6px] p-1 -mx-1"
                style={{ color: 'var(--ink)', fontFamily: 'var(--font)' }}
              />
            ) : (
              <h2
                className="text-[20px] font-semibold leading-tight tracking-tight cursor-text rounded-[6px] p-1 -mx-1 -my-1"
                style={{ color: 'var(--ink)' }}
                onClick={() => setEditingTitle(true)}
              >
                {edited.title}
              </h2>
            )}

            {/* Description */}
            <Section title="Descripción">
              {editingDesc ? (
                <textarea
                  value={edited.description ?? ''}
                  onChange={e => setEdited(prev => prev ? { ...prev, description: e.target.value } : prev)}
                  onBlur={() => { setEditingDesc(false); save({ description: edited.description }, 'Actualizó la descripción'); }}
                  autoFocus rows={5}
                  className="w-full text-[13.5px] leading-relaxed resize-none rounded-[8px] px-3 py-2 border outline-none"
                  style={{ color: 'var(--ink-2)', fontFamily: 'var(--font)', background: 'var(--bg-2)', borderColor: 'var(--accent)' }}
                />
              ) : (
                <p
                  className="text-[13.5px] leading-relaxed min-h-[40px] rounded-[6px] p-1 -mx-1 cursor-text"
                  style={{ color: edited.description ? 'var(--ink-2)' : 'var(--ink-4)' }}
                  onClick={() => setEditingDesc(true)}
                >
                  {edited.description || 'Sin descripción. Click para agregar…'}
                </p>
              )}
            </Section>

            {/* Subtasks */}
            <Section
              title="Subtareas"
              right={
                (() => {
                  const todayISO = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
                  const overdue = subtasks.filter(s => !s.done && s.due_date && s.due_date < todayISO).length;
                  return (
                    <div className="flex items-center gap-2">
                      {overdue > 0 && (
                        <span className="text-[11px] font-medium px-2 py-[1px] rounded-full" style={{ background: 'var(--danger-bg)', color: 'var(--danger)' }}>
                          {overdue} atrasada{overdue > 1 ? 's' : ''}
                        </span>
                      )}
                      <span className="text-[11px]" style={{ color: 'var(--ink-3)' }}>
                        {subtasks.filter(s => s.done).length}/{subtasks.length}
                      </span>
                    </div>
                  );
                })()
              }
            >
              <div className="flex flex-col gap-[8px]">
                {subtasks.map(sub => {
                  const todayISO = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
                  const isOverdue = !sub.done && sub.due_date && sub.due_date < todayISO;
                  return (
                    <div key={sub.id} className="flex items-center gap-2 group">
                      <button
                        onClick={() => handleToggleSubtask(sub)}
                        className="w-4 h-4 rounded-[4px] border flex items-center justify-center flex-shrink-0 transition-colors"
                        style={{
                          background: sub.done ? 'var(--accent)' : 'transparent',
                          borderColor: sub.done ? 'var(--accent)' : 'var(--line)',
                          color: 'white',
                        }}
                      >
                        {sub.done && <Check size={10} />}
                      </button>
                      <span
                        className="text-[13px] flex-1 min-w-0 truncate"
                        style={{ color: sub.done ? 'var(--ink-3)' : 'var(--ink)', textDecoration: sub.done ? 'line-through' : 'none' }}
                        title={sub.title}
                      >
                        {sub.title}
                      </span>
                      {/* Assignee */}
                      <select
                        value={sub.assignee ?? ''}
                        onChange={e => handleSubtaskField(sub, { assignee: e.target.value || null })}
                        className="h-[24px] max-w-[110px] pl-1 pr-1 rounded-[5px] text-[11px] border outline-none flex-shrink-0"
                        style={{ background: 'var(--bg-2)', borderColor: 'var(--line)', color: sub.assignee ? 'var(--ink-2)' : 'var(--ink-4)', fontFamily: 'var(--font)' }}
                        title="Responsable"
                      >
                        <option value="">Sin resp.</option>
                        {allPeople.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                      </select>
                      {/* Due date */}
                      <input
                        type="date"
                        value={sub.due_date ?? ''}
                        onChange={e => handleSubtaskField(sub, { due_date: e.target.value || null })}
                        className="h-[24px] px-1 rounded-[5px] text-[11px] border outline-none flex-shrink-0"
                        style={{
                          background: isOverdue ? 'var(--danger-bg)' : 'var(--bg-2)',
                          borderColor: isOverdue ? 'var(--danger)' : 'var(--line)',
                          color: isOverdue ? 'var(--danger)' : (sub.due_date ? 'var(--ink-2)' : 'var(--ink-4)'),
                        }}
                        title="Fecha límite"
                      />
                      <button
                        onClick={() => handleDeleteSubtask(sub)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity border-0 bg-transparent flex-shrink-0"
                        style={{ color: 'var(--ink-4)' }}
                      >
                        <X size={12} />
                      </button>
                    </div>
                  );
                })}

                {/* Add subtask */}
                <form onSubmit={handleAddSubtask} className="flex items-center gap-2 mt-1">
                  <span className="w-4 h-4 rounded-[4px] border flex-shrink-0" style={{ borderColor: 'var(--line)' }} />
                  <input
                    value={newSubtask}
                    onChange={e => setNewSubtask(e.target.value)}
                    placeholder="Agregar subtarea…"
                    className="flex-1 text-[12.5px] border-0 bg-transparent outline-none"
                    style={{ color: 'var(--ink)', fontFamily: 'var(--font)' }}
                    disabled={addingSubtask}
                  />
                  {newSubtask.trim() && (
                    <button
                      type="submit"
                      disabled={addingSubtask}
                      className="text-[11px] border-0 bg-transparent"
                      style={{ color: 'var(--accent)' }}
                    >
                      Agregar
                    </button>
                  )}
                </form>
              </div>
            </Section>

            {/* Attachments */}
            <Section
              title={`Adjuntos${attachments.length > 0 ? ` (${attachments.length})` : ''}`}
              right={
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="flex items-center gap-1 text-[11px] border-0 bg-transparent"
                  style={{ color: 'var(--accent)' }}
                >
                  <Upload size={11} />{uploading ? 'Subiendo…' : 'Subir archivo'}
                </button>
              }
            >
              <input ref={fileInputRef} type="file" className="hidden" onChange={handleUpload} />
              {attachments.length === 0 && !uploading ? (
                <div
                  className="flex flex-col items-center justify-center gap-2 rounded-[8px] border-2 border-dashed py-5 cursor-pointer text-[12px]"
                  style={{ borderColor: 'var(--line)', color: 'var(--ink-4)' }}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Paperclip size={16} />
                  Arrastra archivos o haz click para subir
                </div>
              ) : (
                <div className="flex flex-col gap-[6px]">
                  {attachments.map(att => (
                    <div
                      key={att.id}
                      className="flex items-center gap-3 px-3 py-2 rounded-[8px] group"
                      style={{ background: 'var(--bg-2)', border: '1px solid var(--line)' }}
                    >
                      <span style={{ color: 'var(--ink-3)' }}>
                        {isImage(att.name) ? <ImageIcon size={14} /> : <FileText size={14} />}
                      </span>
                      <a href={att.url} target="_blank" rel="noopener noreferrer" className="flex-1 min-w-0 truncate text-[12.5px]" style={{ color: 'var(--accent)' }}>
                        {att.name}
                      </a>
                      {att.size && <span className="text-[11px] flex-shrink-0" style={{ color: 'var(--ink-4)' }}>{fmtSize(att.size)}</span>}
                      <button onClick={() => handleDeleteAttachment(att)} className="opacity-0 group-hover:opacity-100 transition-opacity border-0 bg-transparent" style={{ color: 'var(--danger)' }}>
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ))}
                  {uploading && <div className="flex items-center gap-2 px-3 py-2 text-[12px]" style={{ color: 'var(--ink-4)' }}><span className="animate-pulse">Subiendo…</span></div>}
                </div>
              )}
            </Section>

            {/* Comments */}
            <Section title={`Comentarios${comments.length > 0 ? ` (${comments.length})` : ''}`}>
              <div className="flex flex-col gap-4">
                {comments.length === 0 && <div className="text-[12px] py-1" style={{ color: 'var(--ink-4)' }}>Aún no hay comentarios.</div>}
                {comments.map(c => {
                  const author = allPeople.find(u => u.id === c.user_id) ?? undefined;
                  const dt = new Date(c.created_at);
                  return (
                    <div key={c.id} className="flex gap-3">
                      <Avatar userId={c.user_id} size="md" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline gap-2 mb-1">
                          <span className="text-[12.5px] font-semibold" style={{ color: 'var(--ink)' }}>{author?.name ?? 'Usuario'}</span>
                          <span className="text-[11px]" style={{ color: 'var(--ink-4)' }}>
                            {dt.toLocaleDateString('es', { day: 'numeric', month: 'short' })} {dt.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <p className="text-[13px] leading-relaxed" style={{ color: 'var(--ink-2)' }}>{c.content}</p>
                      </div>
                    </div>
                  );
                })}
                <form onSubmit={handleComment} className="flex gap-3">
                  {profile && <Avatar userId={profile.id} size="md" />}
                  <div className="flex-1 rounded-[8px] border overflow-hidden" style={{ borderColor: 'var(--line)', background: 'var(--surface-2)' }}>
                    <textarea
                      value={newComment}
                      onChange={e => setNewComment(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleComment(e); }}
                      placeholder="Escribe un comentario…" rows={2}
                      className="w-full px-3 pt-2 text-[13px] resize-none border-0 bg-transparent outline-none"
                      style={{ color: 'var(--ink)', fontFamily: 'var(--font)' }}
                    />
                    <div className="flex items-center justify-end px-2 py-[6px] border-t" style={{ borderColor: 'var(--line-2)' }}>
                      <button
                        type="submit" disabled={!newComment.trim() || postingComment}
                        className="h-[26px] px-3 rounded-[6px] text-[12px] font-medium border-0 flex items-center gap-1 transition-opacity"
                        style={{ background: 'var(--accent)', color: 'var(--on-accent)', opacity: newComment.trim() && !postingComment ? 1 : 0.45 }}
                      >
                        <Send size={11} />{postingComment ? 'Enviando…' : 'Comentar'}
                      </button>
                    </div>
                  </div>
                </form>
              </div>
            </Section>

            {/* Activity */}
            {activity.length > 0 && (
              <Section title="Actividad">
                <div className="flex flex-col gap-[10px]">
                  {activity.map(a => {
                    const actor = allPeople.find(u => u.id === a.user_id) ?? undefined;
                    return (
                      <div key={a.id} className="flex items-start gap-2">
                        <Avatar userId={a.user_id} size="sm" />
                        <div className="flex-1 min-w-0 pt-[1px]">
                          <span className="text-[12px]" style={{ color: 'var(--ink-2)' }}>
                            <span className="font-medium" style={{ color: 'var(--ink)' }}>{actor?.name ?? 'Usuario'}</span>
                            {' '}{a.action}
                          </span>
                          <span className="ml-2 text-[11px]" style={{ color: 'var(--ink-4)' }}>{fmtActivityTime(a.created_at)}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Section>
            )}
          </div>

          {/* Sidebar */}
          <aside className="w-[280px] flex-shrink-0 border-l overflow-y-auto p-5 flex flex-col gap-4" style={{ borderColor: 'var(--line)', background: 'var(--surface-2)' }}>

            {/* Status */}
            <Field label="Estado">
              <select
                value={edited.status}
                onChange={e => {
                  const val = e.target.value as Task['status'];
                  const lbl = STATUSES.find(s => s.id === val)?.label ?? val;
                  patch({ status: val }, `Cambió el estado a "${lbl}"`);
                }}
                className="h-[28px] px-2 rounded-[6px] text-[12px] border outline-none w-full"
                style={{ background: 'var(--bg-2)', borderColor: 'var(--line)', color: 'var(--ink)', fontFamily: 'var(--font)' }}
              >
                {STATUSES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
            </Field>

            {/* Priority */}
            <Field label="Prioridad">
              <select
                value={edited.priority}
                onChange={e => {
                  const val = e.target.value as Task['priority'];
                  const lbl = PRIORITIES.find(p => p.id === val)?.label ?? val;
                  patch({ priority: val }, `Cambió la prioridad a "${lbl}"`);
                }}
                className="h-[28px] px-2 rounded-[6px] text-[12px] border outline-none w-full"
                style={{ background: 'var(--bg-2)', borderColor: 'var(--line)', color: 'var(--ink)', fontFamily: 'var(--font)' }}
              >
                {PRIORITIES.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
              </select>
            </Field>

            {/* Assignees */}
            <Field label="Asignado">
              <div className="flex flex-wrap gap-[6px]">
                {allPeople.map(u => {
                  const active = edited.assignees.includes(u.id);
                  return (
                    <button key={u.id} onClick={() => toggleAssignee(u.id)} title={u.name}
                      style={{ opacity: active ? 1 : 0.35, border: 'none', background: 'transparent', cursor: 'pointer' }}>
                      <Avatar userId={u.id} size="md" />
                    </button>
                  );
                })}
              </div>
              {edited.assignees.length === 0 && <span className="text-[11px]" style={{ color: 'var(--ink-4)' }}>Sin asignar</span>}
            </Field>

            {/* Labels */}
            <Field label="Etiquetas">
              <div className="flex flex-wrap gap-[6px]" ref={labelPickerRef}>
                {labels.map(l => l && (
                  <button
                    key={l.id}
                    onClick={() => toggleLabel(l.id)}
                    className="inline-flex items-center h-5 px-2 rounded-[4px] text-[11px] font-medium border-0"
                    style={{ background: l.bg, color: l.fg }}
                    title="Click para quitar"
                  >
                    {l.text} ×
                  </button>
                ))}
                <div className="relative">
                  <button
                    onClick={() => setShowLabelPicker(o => !o)}
                    className="inline-flex items-center h-5 px-2 rounded-[4px] text-[11px] border-0 bg-transparent"
                    style={{ color: 'var(--ink-4)' }}
                  >
                    <Plus size={10} /> Etiqueta
                  </button>
                  {showLabelPicker && (
                    <div
                      className="absolute left-0 top-[calc(100%+4px)] z-10 rounded-[10px] overflow-hidden flex flex-col py-1"
                      style={{ width: 180, background: 'var(--surface)', border: '1px solid var(--line)', boxShadow: 'var(--shadow-pop)' }}
                    >
                      {allLabels.map(l => {
                        const active = edited.labels.includes(l.id);
                        return (
                          <button
                            key={l.id}
                            onClick={() => toggleLabel(l.id)}
                            className="flex items-center gap-2 px-3 py-[6px] text-left text-[12px] border-0 bg-transparent transition-colors"
                            style={{ color: 'var(--ink)' }}
                            onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-2)')}
                            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                          >
                            <span className="w-[8px] h-[8px] rounded-full flex-shrink-0" style={{ background: l.fg }} />
                            <span className="flex-1">{l.text}</span>
                            {active && <Check size={11} style={{ color: 'var(--accent)' }} />}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </Field>

            {/* Start date */}
            <Field label="Fecha inicio">
              <input
                type="date" value={edited.start ?? ''}
                onChange={e => patch({ start: e.target.value || undefined }, e.target.value ? `Fijó inicio el ${e.target.value}` : 'Quitó la fecha de inicio')}
                className="h-[28px] px-2 rounded-[6px] text-[12px] border outline-none w-full"
                style={{ background: 'var(--bg-2)', borderColor: 'var(--line)', color: edited.start ? 'var(--ink)' : 'var(--ink-4)', fontFamily: 'var(--font)' }}
              />
            </Field>

            {/* Due date */}
            <Field label="Fecha límite">
              <input
                type="date" value={edited.due ?? ''}
                onChange={e => patch({ due: e.target.value || undefined }, e.target.value ? `Fijó vencimiento el ${e.target.value}` : 'Quitó la fecha límite')}
                className="h-[28px] px-2 rounded-[6px] text-[12px] border outline-none w-full"
                style={{ background: 'var(--bg-2)', borderColor: 'var(--line)', color: edited.due ? 'var(--ink)' : 'var(--ink-4)', fontFamily: 'var(--font)' }}
              />
            </Field>

            {/* Estimate / Spent */}
            <Field label="Tiempo (h)">
              <div className="flex gap-2">
                <div className="flex flex-col gap-1 flex-1">
                  <span className="text-[10px]" style={{ color: 'var(--ink-4)' }}>Estimado</span>
                  <input type="number" min={0} value={edited.estimate ?? 0}
                    onChange={e => setEdited(prev => prev ? { ...prev, estimate: +e.target.value } : prev)}
                    onBlur={() => save({ estimate: edited.estimate }, `Actualizó estimado a ${edited.estimate}h`)}
                    className="h-[28px] px-2 rounded-[6px] text-[12px] border outline-none w-full"
                    style={{ background: 'var(--bg-2)', borderColor: 'var(--line)', color: 'var(--ink)', fontFamily: 'var(--font)' }}
                  />
                </div>
                <div className="flex flex-col gap-1 flex-1">
                  <span className="text-[10px]" style={{ color: 'var(--ink-4)' }}>Real</span>
                  <input type="number" min={0} value={edited.spent ?? 0}
                    onChange={e => setEdited(prev => prev ? { ...prev, spent: +e.target.value } : prev)}
                    onBlur={() => save({ spent: edited.spent }, `Actualizó tiempo real a ${edited.spent}h`)}
                    className="h-[28px] px-2 rounded-[6px] text-[12px] border outline-none w-full"
                    style={{ background: 'var(--bg-2)', borderColor: 'var(--line)', color: 'var(--ink)', fontFamily: 'var(--font)' }}
                  />
                </div>
              </div>
              {edited.estimate > 0 && (
                <div className="h-[4px] rounded-full overflow-hidden mt-2" style={{ background: 'var(--bg-3)' }}>
                  <div className="h-full rounded-full transition-all" style={{ width: `${spentPct}%`, background: overBudget ? 'var(--danger)' : 'var(--accent)' }} />
                </div>
              )}
            </Field>

            {/* Timer */}
            <Field label="Temporizador">
              <div className="flex flex-col gap-2">
                <div
                  className="text-[20px] font-mono font-semibold tabular-nums text-center py-2 rounded-[8px]"
                  style={{
                    background: timerRunning ? 'oklch(0.95 0.06 160)' : 'var(--bg-2)',
                    color: timerRunning ? 'oklch(0.38 0.14 160)' : 'var(--ink)',
                    border: `1px solid ${timerRunning ? 'oklch(0.80 0.10 160)' : 'var(--line)'}`,
                    transition: 'all 0.2s',
                  }}
                >
                  {fmtTimer(timerElapsed)}
                </div>
                <div className="flex gap-2">
                  {!timerRunning ? (
                    <button
                      onClick={() => setTimerRunning(true)}
                      className="flex-1 h-8 rounded-[7px] text-[12px] font-medium border-0 transition-colors"
                      style={{ background: 'var(--accent)', color: 'var(--on-accent)' }}
                    >
                      ▶ Iniciar
                    </button>
                  ) : (
                    <>
                      <button
                        onClick={stopTimerAndLog}
                        className="flex-1 h-8 rounded-[7px] text-[12px] font-medium border-0"
                        style={{ background: 'oklch(0.55 0.14 160)', color: 'white' }}
                      >
                        ■ Parar y guardar
                      </button>
                      <button
                        onClick={() => { setTimerRunning(false); setTimerElapsed(0); }}
                        className="h-8 px-3 rounded-[7px] text-[12px] border-0"
                        style={{ background: 'var(--bg-3)', color: 'var(--ink-3)' }}
                        title="Cancelar"
                      >
                        ✕
                      </button>
                    </>
                  )}
                </div>
                {timerRunning && timerElapsed > 0 && (
                  <div className="text-[11px] text-center" style={{ color: 'var(--ink-4)' }}>
                    Se añadirá {(timerElapsed / 3600).toFixed(2)}h al tiempo real
                  </div>
                )}
              </div>
            </Field>

            {/* Project Stage */}
            <Field label="Etapa ERA">
              <select
                value={edited.project_stage ?? ''}
                onChange={async e => {
                  const val = (e.target.value || undefined) as Task['project_stage'] | undefined;
                  setEdited(prev => prev ? { ...prev, project_stage: val } : prev);
                  const stageLabel = PROJECT_STAGES.find(s => s.id === val)?.label;
                  await save(
                    { project_stage: val },
                    val ? `Cambió la etapa a "${stageLabel}"` : 'Quitó la etapa del proyecto',
                  );
                }}
                className="h-[28px] px-2 rounded-[6px] text-[12px] border outline-none w-full"
                style={{ background: 'var(--bg-2)', borderColor: 'var(--line)', color: 'var(--ink)', fontFamily: 'var(--font)' }}
              >
                <option value="">Sin etapa</option>
                {PROJECT_STAGES.map(s => (
                  <option key={s.id} value={s.id}>{s.label}</option>
                ))}
              </select>
            </Field>

            {/* Sprint */}
            {sprints.length > 0 && (
              <Field label="Sprint">
                <select
                  value={edited.sprint_id ?? ''}
                  onChange={async e => {
                    const val = e.target.value || null;
                    setEdited(prev => prev ? { ...prev, sprint_id: val ?? undefined } : prev);
                    await assignTaskToSprint(taskId, val);
                    const sp = sprints.find(s => s.id === val);
                    if (profile?.id) {
                      const msg = val ? `Asignó al sprint "${sp?.name}"` : 'Quitó del sprint';
                      await logActivity(taskId, profile.id, msg);
                      fetchActivity(taskId).then(setActivity).catch(() => {});
                    }
                  }}
                  className="h-[28px] px-2 rounded-[6px] text-[12px] border outline-none w-full"
                  style={{ background: 'var(--bg-2)', borderColor: 'var(--line)', color: 'var(--ink)', fontFamily: 'var(--font)' }}
                >
                  <option value="">Sin sprint</option>
                  {sprints.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </Field>
            )}

            <hr style={{ border: 0, borderTop: '1px solid var(--line)', margin: '4px 0' }} />
            <div className="text-[11px]" style={{ color: 'var(--ink-4)' }}>{fmtDate(task.start)} · {task.ref}</div>
          </aside>
        </div>
      </div>
    </div>

    {confirmingDelete && (
      <div
        className="fixed inset-0 z-[60] grid place-items-center"
        style={{ background: 'rgba(20,18,12,.32)', backdropFilter: 'blur(2px)' }}
        onClick={() => !deleting && setConfirmingDelete(false)}
      >
        <div
          onClick={e => e.stopPropagation()}
          className="flex flex-col gap-4 p-5"
          style={{
            width: 340, background: 'var(--surface)', border: '1px solid var(--line)',
            borderRadius: 14, boxShadow: 'var(--shadow-pop)',
          }}
        >
          <div className="flex items-center gap-2">
            <Trash2 size={16} style={{ color: 'var(--danger)' }} />
            <h3 className="text-[14.5px] font-semibold" style={{ color: 'var(--ink)' }}>Eliminar tarea</h3>
          </div>
          <p className="text-[13px] leading-relaxed" style={{ color: 'var(--ink-2)' }}>
            ¿Eliminar &quot;{task.title}&quot;? Esta acción no se puede deshacer.
          </p>
          {deleteError && (
            <p className="text-[12px]" style={{ color: 'var(--danger)' }}>{deleteError}</p>
          )}
          <div className="flex items-center justify-end gap-2">
            <button
              onClick={() => setConfirmingDelete(false)}
              disabled={deleting}
              className="h-8 px-3 rounded-[7px] text-[13px] font-medium border-0 disabled:opacity-50"
              style={{ background: 'var(--bg-2)', color: 'var(--ink-2)' }}
            >
              Cancelar
            </button>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="h-8 px-3 rounded-[7px] text-[13px] font-medium border-0 text-white disabled:opacity-50"
              style={{ background: 'var(--danger)' }}
            >
              {deleting ? 'Eliminando…' : 'Eliminar'}
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}

function IconBtn({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) {
  return (
    <button onClick={onClick} className="w-8 h-8 flex items-center justify-center rounded-[7px] border-0 bg-transparent transition-colors" style={{ color: 'var(--ink-2)' }}>
      {children}
    </button>
  );
}

function Section({ title, right, children }: { title: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h4 className="text-[13px] font-semibold" style={{ color: 'var(--ink)' }}>{title}</h4>
        {right}
      </div>
      {children}
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-[6px]">
      <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--ink-4)' }}>{label}</span>
      <div>{children}</div>
    </div>
  );
}
