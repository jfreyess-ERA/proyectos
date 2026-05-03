'use client';
import { useState, useEffect, useRef } from 'react';
import { X, Paperclip, Archive, MoreHorizontal, Plus, Send } from 'lucide-react';
import {
  getProject, getLabel, getUser, getPriority, getStatus,
  fmtDate, PEOPLE, STATUSES, PRIORITIES,
} from '@/lib/data';
import { updateTask, fetchComments, insertComment } from '@/lib/db';
import { useAuth } from '@/lib/auth-context';
import { Avatar, AvatarStack } from './Avatar';
import type { Task, Comment, User } from '@/lib/types';

interface Props {
  task: Task | null;
  users?: User[];
  onClose: () => void;
  onUpdated?: (t: Task) => void;
}

export function TaskDetail({ task, users = [], onClose, onUpdated }: Props) {
  const { profile } = useAuth();
  const allPeople = users.length > 0 ? users : PEOPLE;

  const [edited, setEdited] = useState<Task | null>(null);
  const [saving, setSaving] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [postingComment, setPostingComment] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [editingDesc, setEditingDesc] = useState(false);
  const titleRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!task) return;
    setEdited(task);
    setEditingTitle(false);
    setEditingDesc(false);
    fetchComments(task.id).then(setComments).catch(() => {});
  }, [task?.id]);

  if (!task || !edited) return null;

  const taskId = task.id;
  const project = getProject(edited.project);
  const labels = edited.labels.map(id => getLabel(id)).filter(Boolean);
  const spentPct = edited.estimate > 0 ? Math.min(100, (edited.spent / edited.estimate) * 100) : 0;
  const overBudget = edited.spent > edited.estimate;

  async function save(fields: Partial<Task>) {
    setSaving(true);
    try {
      const dbFields: Record<string, unknown> = {};
      if ('status' in fields)    dbFields.status    = fields.status;
      if ('priority' in fields)  dbFields.priority  = fields.priority;
      if ('due' in fields)       dbFields.due_date  = fields.due ?? null;
      if ('title' in fields)     dbFields.title     = fields.title;
      if ('description' in fields) dbFields.description = fields.description;
      if ('assignees' in fields) dbFields.assignees = fields.assignees;
      if ('estimate' in fields)  dbFields.estimate  = fields.estimate;
      if ('spent' in fields)     dbFields.spent     = fields.spent;

      const updated = await updateTask(taskId, dbFields as Parameters<typeof updateTask>[1]);
      setEdited(updated);
      onUpdated?.(updated);
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  }

  function patch(fields: Partial<Task>) {
    setEdited(prev => prev ? { ...prev, ...fields } : prev);
    save(fields);
  }

  function toggleAssignee(userId: string) {
    const current = edited!.assignees;
    const next = current.includes(userId)
      ? current.filter(id => id !== userId)
      : [...current, userId];
    patch({ assignees: next });
  }

  async function handleComment(e: React.FormEvent) {
    e.preventDefault();
    if (!newComment.trim() || !profile) return;
    setPostingComment(true);
    try {
      const c = await insertComment(taskId, profile.id, newComment.trim());
      setComments(prev => [...prev, c]);
      setNewComment('');
    } catch (e) {
      console.error(e);
    } finally {
      setPostingComment(false);
    }
  }

  const priorityColors: Record<string, string> = {
    urgent: 'oklch(0.58 0.18 25)',
    high:   'oklch(0.65 0.14 50)',
    med:    'oklch(0.62 0.05 250)',
    low:    'oklch(0.62 0.02 250)',
  };

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center"
      style={{ background: 'rgba(20,18,12,.32)', backdropFilter: 'blur(2px)' }}
      onClick={onClose}
    >
      <div
        className="flex flex-col overflow-hidden"
        style={{
          width: 'min(900px, 92vw)',
          maxHeight: '90vh',
          background: 'var(--surface)',
          border: '1px solid var(--line)',
          borderRadius: 14,
          boxShadow: 'var(--shadow-pop)',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-3 border-b flex-shrink-0"
          style={{ borderColor: 'var(--line)' }}
        >
          <div className="flex items-center gap-[10px]">
            <span className="w-2 h-2 rounded-[2px]" style={{ background: project?.color }} />
            <span className="text-[12.5px]" style={{ color: 'var(--ink-3)' }}>
              {project?.name} · {task.ref}
            </span>
            {saving && (
              <span className="text-[11px]" style={{ color: 'var(--ink-4)' }}>Guardando…</span>
            )}
          </div>
          <div className="flex items-center gap-1">
            <IconBtn><Paperclip size={15} /></IconBtn>
            <IconBtn><Archive size={15} /></IconBtn>
            <IconBtn><MoreHorizontal size={15} /></IconBtn>
            <IconBtn onClick={onClose}><X size={15} /></IconBtn>
          </div>
        </div>

        {/* Body */}
        <div className="flex flex-1 min-h-0 overflow-hidden">
          {/* Main */}
          <div className="flex-1 min-w-0 overflow-y-auto p-6 flex flex-col gap-6">

            {/* Editable title */}
            {editingTitle ? (
              <textarea
                ref={titleRef}
                value={edited.title}
                onChange={e => setEdited(prev => prev ? { ...prev, title: e.target.value } : prev)}
                onBlur={() => { setEditingTitle(false); save({ title: edited.title }); }}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); setEditingTitle(false); save({ title: edited.title }); }}}
                autoFocus
                rows={2}
                className="w-full text-[20px] font-semibold leading-tight tracking-tight resize-none border-0 bg-transparent outline-none rounded-[6px] p-1 -mx-1"
                style={{ color: 'var(--ink)', fontFamily: 'var(--font)' }}
              />
            ) : (
              <h2
                className="text-[20px] font-semibold leading-tight tracking-tight cursor-text rounded-[6px] p-1 -mx-1 -my-1 transition-colors"
                style={{ color: 'var(--ink)' }}
                onClick={() => setEditingTitle(true)}
                title="Click para editar"
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
                  onBlur={() => { setEditingDesc(false); save({ description: edited.description }); }}
                  autoFocus
                  rows={5}
                  className="w-full text-[13.5px] leading-relaxed resize-none rounded-[8px] px-3 py-2 border outline-none"
                  style={{
                    color: 'var(--ink-2)',
                    fontFamily: 'var(--font)',
                    background: 'var(--bg-2)',
                    borderColor: 'var(--accent)',
                  }}
                />
              ) : (
                <p
                  className="text-[13.5px] leading-relaxed min-h-[40px] rounded-[6px] p-1 -mx-1 cursor-text transition-colors"
                  style={{ color: edited.description ? 'var(--ink-2)' : 'var(--ink-4)' }}
                  onClick={() => setEditingDesc(true)}
                  title="Click para editar"
                >
                  {edited.description || 'Sin descripción. Click para agregar…'}
                </p>
              )}
            </Section>

            {/* Subtasks */}
            <Section
              title="Subtareas"
              right={
                <span className="text-[11px]" style={{ color: 'var(--ink-3)' }}>
                  {task.subtasks.done}/{task.subtasks.total}
                </span>
              }
            >
              <div className="flex flex-col gap-[6px]">
                {Array.from({ length: task.subtasks.total }).map((_, i) => {
                  const done = i < task.subtasks.done;
                  return (
                    <div key={i} className="flex items-center gap-3">
                      <span
                        className="w-4 h-4 rounded-[4px] border flex items-center justify-center flex-shrink-0 text-[10px]"
                        style={{
                          background: done ? 'var(--accent)' : 'transparent',
                          borderColor: done ? 'var(--accent)' : 'var(--line)',
                          color: 'white',
                        }}
                      >
                        {done && '✓'}
                      </span>
                      <span
                        className="text-[13px]"
                        style={{
                          color: done ? 'var(--ink-3)' : 'var(--ink)',
                          textDecoration: done ? 'line-through' : 'none',
                        }}
                      >
                        Subtarea {i + 1}
                      </span>
                    </div>
                  );
                })}
                <button
                  className="flex items-center gap-1 text-[12px] border-0 bg-transparent mt-1"
                  style={{ color: 'var(--ink-4)' }}
                >
                  <Plus size={12} /> Agregar subtarea
                </button>
              </div>
            </Section>

            {/* Comments */}
            <Section title={`Comentarios${comments.length > 0 ? ` (${comments.length})` : ''}`}>
              <div className="flex flex-col gap-4">
                {comments.length === 0 && (
                  <div className="text-[12px] py-1" style={{ color: 'var(--ink-4)' }}>
                    Aún no hay comentarios.
                  </div>
                )}
                {comments.map(c => {
                  const author = allPeople.find(u => u.id === c.user_id) ?? getUser(c.user_id);
                  const dt = new Date(c.created_at);
                  return (
                    <div key={c.id} className="flex gap-3">
                      <Avatar userId={c.user_id} size="md" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline gap-2 mb-1">
                          <span className="text-[12.5px] font-semibold" style={{ color: 'var(--ink)' }}>
                            {author?.name ?? 'Usuario'}
                          </span>
                          <span className="text-[11px]" style={{ color: 'var(--ink-4)' }}>
                            {dt.toLocaleDateString('es', { day: 'numeric', month: 'short' })} {dt.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <p className="text-[13px] leading-relaxed" style={{ color: 'var(--ink-2)' }}>
                          {c.content}
                        </p>
                      </div>
                    </div>
                  );
                })}

                {/* Comment input */}
                <form onSubmit={handleComment} className="flex gap-3">
                  {profile && <Avatar userId={profile.id} size="md" />}
                  <div
                    className="flex-1 rounded-[8px] border overflow-hidden"
                    style={{ borderColor: 'var(--line)', background: 'var(--surface-2)' }}
                  >
                    <textarea
                      value={newComment}
                      onChange={e => setNewComment(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { handleComment(e); }}}
                      placeholder="Escribe un comentario…"
                      rows={2}
                      className="w-full px-3 pt-2 text-[13px] resize-none border-0 bg-transparent outline-none"
                      style={{ color: 'var(--ink)', fontFamily: 'var(--font)' }}
                    />
                    <div
                      className="flex items-center justify-end px-2 py-[6px] border-t"
                      style={{ borderColor: 'var(--line-2)' }}
                    >
                      <button
                        type="submit"
                        disabled={!newComment.trim() || postingComment}
                        className="h-[26px] px-3 rounded-[6px] text-[12px] font-medium border-0 flex items-center gap-1 transition-opacity"
                        style={{
                          background: 'var(--accent)',
                          color: 'var(--on-accent)',
                          opacity: newComment.trim() && !postingComment ? 1 : 0.45,
                        }}
                      >
                        <Send size={11} />
                        {postingComment ? 'Enviando…' : 'Comentar'}
                      </button>
                    </div>
                  </div>
                </form>
              </div>
            </Section>
          </div>

          {/* Sidebar */}
          <aside
            className="w-[280px] flex-shrink-0 border-l overflow-y-auto p-5 flex flex-col gap-4"
            style={{ borderColor: 'var(--line)', background: 'var(--surface-2)' }}
          >
            {/* Status */}
            <Field label="Estado">
              <select
                value={edited.status}
                onChange={e => patch({ status: e.target.value as Task['status'] })}
                className="h-[28px] px-2 rounded-[6px] text-[12px] border outline-none w-full"
                style={{
                  background: 'var(--bg-2)',
                  borderColor: 'var(--line)',
                  color: 'var(--ink)',
                  fontFamily: 'var(--font)',
                }}
              >
                {STATUSES.map(s => (
                  <option key={s.id} value={s.id}>{s.label}</option>
                ))}
              </select>
            </Field>

            {/* Priority */}
            <Field label="Prioridad">
              <select
                value={edited.priority}
                onChange={e => patch({ priority: e.target.value as Task['priority'] })}
                className="h-[28px] px-2 rounded-[6px] text-[12px] border outline-none w-full"
                style={{
                  background: 'var(--bg-2)',
                  borderColor: 'var(--line)',
                  color: 'var(--ink)',
                  fontFamily: 'var(--font)',
                }}
              >
                {PRIORITIES.map(p => (
                  <option key={p.id} value={p.id}>{p.label}</option>
                ))}
              </select>
            </Field>

            {/* Assignees */}
            <Field label="Asignado">
              <div className="flex flex-wrap gap-[6px]">
                {allPeople.map(u => {
                  const active = edited.assignees.includes(u.id);
                  return (
                    <button
                      key={u.id}
                      onClick={() => toggleAssignee(u.id)}
                      title={u.name}
                      className="transition-opacity"
                      style={{ opacity: active ? 1 : 0.35, border: 'none', background: 'transparent', cursor: 'pointer' }}
                    >
                      <Avatar userId={u.id} size="md" />
                    </button>
                  );
                })}
              </div>
              {edited.assignees.length === 0 && (
                <span className="text-[11px]" style={{ color: 'var(--ink-4)' }}>Sin asignar</span>
              )}
            </Field>

            {/* Due date */}
            <Field label="Fecha límite">
              <input
                type="date"
                value={edited.due ?? ''}
                onChange={e => patch({ due: e.target.value || undefined })}
                className="h-[28px] px-2 rounded-[6px] text-[12px] border outline-none w-full"
                style={{
                  background: 'var(--bg-2)',
                  borderColor: 'var(--line)',
                  color: edited.due ? 'var(--ink)' : 'var(--ink-4)',
                  fontFamily: 'var(--font)',
                }}
              />
            </Field>

            {/* Estimate / Spent */}
            <Field label="Tiempo (h)">
              <div className="flex gap-2">
                <div className="flex flex-col gap-1 flex-1">
                  <span className="text-[10px]" style={{ color: 'var(--ink-4)' }}>Estimado</span>
                  <input
                    type="number"
                    min={0}
                    value={edited.estimate ?? 0}
                    onChange={e => setEdited(prev => prev ? { ...prev, estimate: +e.target.value } : prev)}
                    onBlur={() => save({ estimate: edited.estimate })}
                    className="h-[28px] px-2 rounded-[6px] text-[12px] border outline-none w-full"
                    style={{ background: 'var(--bg-2)', borderColor: 'var(--line)', color: 'var(--ink)', fontFamily: 'var(--font)' }}
                  />
                </div>
                <div className="flex flex-col gap-1 flex-1">
                  <span className="text-[10px]" style={{ color: 'var(--ink-4)' }}>Real</span>
                  <input
                    type="number"
                    min={0}
                    value={edited.spent ?? 0}
                    onChange={e => setEdited(prev => prev ? { ...prev, spent: +e.target.value } : prev)}
                    onBlur={() => save({ spent: edited.spent })}
                    className="h-[28px] px-2 rounded-[6px] text-[12px] border outline-none w-full"
                    style={{ background: 'var(--bg-2)', borderColor: 'var(--line)', color: 'var(--ink)', fontFamily: 'var(--font)' }}
                  />
                </div>
              </div>
              {edited.estimate > 0 && (
                <div className="h-[4px] rounded-full overflow-hidden mt-2" style={{ background: 'var(--bg-3)' }}>
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${spentPct}%`, background: overBudget ? 'var(--danger)' : 'var(--accent)' }}
                  />
                </div>
              )}
            </Field>

            {/* Labels */}
            <Field label="Etiquetas">
              <div className="flex flex-wrap gap-[6px]">
                {labels.map(l => l && (
                  <span
                    key={l.id}
                    className="inline-flex items-center h-5 px-2 rounded-[4px] text-[11px] font-medium"
                    style={{ background: l.bg, color: l.fg }}
                  >
                    {l.text}
                  </span>
                ))}
                <button
                  className="inline-flex items-center h-5 px-2 rounded-[4px] text-[11px] border-0 bg-transparent"
                  style={{ color: 'var(--ink-4)' }}
                >
                  + Etiqueta
                </button>
              </div>
            </Field>

            <hr style={{ border: 0, borderTop: '1px solid var(--line)', margin: '4px 0' }} />
            <div className="text-[11px]" style={{ color: 'var(--ink-4)' }}>
              {fmtDate(task.start)} · {task.ref}
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

function IconBtn({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-8 h-8 flex items-center justify-center rounded-[7px] border-0 bg-transparent transition-colors"
      style={{ color: 'var(--ink-2)' }}
    >
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
      <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--ink-4)' }}>
        {label}
      </span>
      <div>{children}</div>
    </div>
  );
}
