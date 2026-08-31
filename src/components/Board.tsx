'use client';
import { useState } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { Plus, MoreHorizontal, Clock, X, CheckSquare } from 'lucide-react';
import { STATUSES, PRIORITIES, fmtDate, dueClass, avatarBg } from '@/lib/data';
import { useProjects } from '@/lib/projects-context';
import { useLabels } from '@/lib/labels-context';
import { updateTaskStatus, bulkUpdateTasks } from '@/lib/db';
import { AvatarStack } from './Avatar';
import type { Task, User } from '@/lib/types';

interface Props {
  tasks: Task[];
  users?: User[];
  onOpenTask: (task: Task) => void;
  onCreateTask?: (defaultStatus: Task['status']) => void;
}

export function Board({ tasks: propTasks, users = [], onOpenTask, onCreateTask }: Props) {
  const [statusOverrides, setStatusOverrides] = useState<Record<string, string>>({});
  const [activeId, setActiveId] = useState<string | null>(null);
  const [filterAssignees, setFilterAssignees] = useState<string[]>([]);
  const [filterPriorities, setFilterPriorities] = useState<string[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkSaving, setBulkSaving] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } })
  );

  const tasks = propTasks.map(t =>
    statusOverrides[t.id] ? { ...t, status: statusOverrides[t.id] as Task['status'] } : t
  );

  const filteredTasks = tasks.filter(t => {
    if (filterAssignees.length > 0 && !filterAssignees.some(id => t.assignees.includes(id))) return false;
    if (filterPriorities.length > 0 && !filterPriorities.includes(t.priority)) return false;
    return true;
  });

  const activeTask = activeId ? tasks.find(t => t.id === activeId) ?? null : null;
  const hasFilters = filterAssignees.length > 0 || filterPriorities.length > 0;

  function toggleAssigneeFilter(id: string) {
    setFilterAssignees(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }
  function togglePriorityFilter(id: string) {
    setFilterPriorities(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }

  function toggleSelect(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function handleBulkStatus(status: Task['status']) {
    const ids = [...selectedIds];
    setBulkSaving(true);
    try {
      await bulkUpdateTasks(ids, { status });
      setStatusOverrides(prev => {
        const next = { ...prev };
        ids.forEach(id => { next[id] = status; });
        return next;
      });
      setSelectedIds(new Set());
    } finally { setBulkSaving(false); }
  }

  async function handleBulkPriority(priority: Task['priority']) {
    const ids = [...selectedIds];
    setBulkSaving(true);
    try {
      await bulkUpdateTasks(ids, { priority });
      setSelectedIds(new Set());
    } finally { setBulkSaving(false); }
  }

  function handleDragStart({ active }: DragStartEvent) {
    setActiveId(active.id as string);
  }

  function handleDragEnd({ active, over }: DragEndEvent) {
    setActiveId(null);
    if (!over) return;
    const newStatus = over.id as string;
    const validStatuses: string[] = STATUSES.map(s => s.id);
    if (validStatuses.includes(newStatus)) {
      setStatusOverrides(prev => ({ ...prev, [active.id as string]: newStatus }));
      updateTaskStatus(active.id as string, newStatus as Task['status']).catch(console.error);
    }
  }

  const priorityColors: Record<string, string> = {
    urgent: 'var(--sem-red-2)',
    high:   'var(--sem-orange)',
    med:    'var(--sem-blue-gray-med)',
    low:    'var(--sem-blue-gray-low)',
  };

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="flex flex-col h-full min-h-0 relative">
        {/* Filter bar */}
        <div
          className="flex items-center gap-3 px-6 py-2 border-b flex-shrink-0 flex-wrap"
          style={{ borderColor: 'var(--line)', background: 'var(--bg)' }}
        >
          <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--ink-4)' }}>
            Filtrar
          </span>
          {/* Assignee filters */}
          {users.map(u => (
            <button
              key={u.id}
              onClick={() => toggleAssigneeFilter(u.id)}
              title={u.name}
              className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-semibold transition-opacity border-0"
              style={{
                background: avatarBg(u.hue),
                opacity: filterAssignees.length === 0 || filterAssignees.includes(u.id) ? 1 : 0.3,
                outline: filterAssignees.includes(u.id) ? `2px solid ${avatarBg(u.hue)}` : 'none',
                outlineOffset: 2,
                cursor: 'pointer',
              }}
            >
              {u.initials.slice(0, 1)}
            </button>
          ))}

          <div className="w-px h-4 flex-shrink-0" style={{ background: 'var(--line)' }} />

          {/* Priority filters */}
          {PRIORITIES.map(p => (
            <button
              key={p.id}
              onClick={() => togglePriorityFilter(p.id)}
              className="flex items-center gap-[5px] h-6 px-2 rounded-full text-[11px] border transition-colors"
              style={{
                borderColor: filterPriorities.includes(p.id) ? p.tone : 'var(--line)',
                background: filterPriorities.includes(p.id) ? p.tone + '22' : 'transparent',
                color: filterPriorities.includes(p.id) ? p.tone : 'var(--ink-3)',
                cursor: 'pointer',
              }}
            >
              <span className="w-[6px] h-[6px] rounded-full flex-shrink-0" style={{ background: priorityColors[p.id] }} />
              {p.label}
            </button>
          ))}

          {hasFilters && (
            <button
              onClick={() => { setFilterAssignees([]); setFilterPriorities([]); }}
              className="flex items-center gap-1 h-6 px-2 rounded-full text-[11px] border-0 ml-auto"
              style={{ background: 'var(--bg-3)', color: 'var(--ink-3)', cursor: 'pointer' }}
            >
              <X size={11} /> Limpiar
            </button>
          )}
        </div>

        {/* Board columns */}
        <div
          className="flex-1 overflow-x-auto overflow-y-hidden min-h-0"
          style={{ padding: '16px 24px 24px' }}
        >
          <div className="flex gap-[14px] h-full">
            {STATUSES.map(status => (
              <KanbanColumn
                key={status.id}
                status={status}
                tasks={filteredTasks.filter(t => t.status === status.id)}
                onOpenTask={onOpenTask}
                onCreateTask={onCreateTask}
                activeId={activeId}
                selectedIds={selectedIds}
                onToggleSelect={toggleSelect}
              />
            ))}
          </div>
        </div>

        {/* Bulk action toolbar */}
        {selectedIds.size > 0 && (
          <div
            className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 px-4 py-2 rounded-[12px] shadow-lg z-40"
            style={{ background: 'var(--ink)', color: 'var(--bg)', border: '1px solid var(--ink-2)', minWidth: 340 }}
          >
            <CheckSquare size={14} style={{ color: 'var(--accent)' }} />
            <span className="text-[12px] font-semibold mr-1">{selectedIds.size} seleccionada{selectedIds.size !== 1 ? 's' : ''}</span>

            <div className="w-px h-4 mx-1" style={{ background: 'rgba(255,255,255,.2)' }} />

            <span className="text-[11px] opacity-60">Estado:</span>
            <select
              onChange={e => e.target.value && handleBulkStatus(e.target.value as Task['status'])}
              value=""
              disabled={bulkSaving}
              className="h-6 px-2 rounded-[4px] text-[11px] border-0 cursor-pointer"
              style={{ background: 'rgba(255,255,255,.12)', color: 'var(--bg)', fontFamily: 'var(--font)' }}
            >
              <option value="">Cambiar…</option>
              {STATUSES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>

            <span className="text-[11px] opacity-60">Prioridad:</span>
            <select
              onChange={e => e.target.value && handleBulkPriority(e.target.value as Task['priority'])}
              value=""
              disabled={bulkSaving}
              className="h-6 px-2 rounded-[4px] text-[11px] border-0 cursor-pointer"
              style={{ background: 'rgba(255,255,255,.12)', color: 'var(--bg)', fontFamily: 'var(--font)' }}
            >
              <option value="">Cambiar…</option>
              {PRIORITIES.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
            </select>

            <button
              onClick={() => setSelectedIds(new Set())}
              className="ml-auto w-6 h-6 flex items-center justify-center rounded-[4px] border-0"
              style={{ background: 'rgba(255,255,255,.12)', color: 'var(--bg)', cursor: 'pointer' }}
            >
              <X size={12} />
            </button>
          </div>
        )}
      </div>

      <DragOverlay>
        {activeTask && <TaskCard task={activeTask} onOpen={() => {}} overlay />}
      </DragOverlay>
    </DndContext>
  );
}

/* ── Column ──────────────────────────────────────────────────── */

function KanbanColumn({
  status, tasks, onOpenTask, onCreateTask, activeId, selectedIds, onToggleSelect,
}: {
  status: (typeof STATUSES)[0];
  tasks: Task[];
  onOpenTask: (t: Task) => void;
  onCreateTask?: (defaultStatus: Task['status']) => void;
  activeId: string | null;
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status.id });

  return (
    <div
      ref={setNodeRef}
      className="w-[300px] flex-shrink-0 flex flex-col rounded-[12px] border transition-colors"
      style={{
        background: isOver ? 'var(--accent-bg)' : 'var(--bg-2)',
        borderColor: isOver ? 'var(--accent-line)' : 'var(--line)',
        minHeight: 0,
      }}
    >
      {/* Column header */}
      <div className="flex items-center justify-between px-3 py-[10px] flex-shrink-0">
        <div className="flex items-center gap-2 text-[13px] font-semibold" style={{ color: 'var(--ink)' }}>
          <span className="w-2 h-2 rounded-full" style={{ background: status.tone }} />
          <span>{status.label}</span>
          <span
            className="text-[11px] px-[7px] py-px rounded-full tabular-nums"
            style={{ background: 'var(--bg-3)', color: 'var(--ink-4)' }}
          >
            {tasks.length}
          </span>
        </div>
        <div className="flex gap-[2px]">
          <button
            className="w-6 h-6 flex items-center justify-center rounded-[4px] border-0 bg-transparent"
            style={{ color: 'var(--ink-3)' }}
          >
            <Plus size={13} />
          </button>
          <button
            className="w-6 h-6 flex items-center justify-center rounded-[4px] border-0 bg-transparent"
            style={{ color: 'var(--ink-3)' }}
          >
            <MoreHorizontal size={13} />
          </button>
        </div>
      </div>

      {/* Cards */}
      <div className="flex-1 min-h-0 overflow-y-auto px-2 pb-[10px] flex flex-col gap-2">
        {tasks.map(task => (
          <DraggableCard
            key={task.id}
            task={task}
            onOpen={onOpenTask}
            isDragging={task.id === activeId}
            selected={selectedIds.has(task.id)}
            onToggleSelect={onToggleSelect}
          />
        ))}

        {isOver && tasks.length === 0 && (
          <div
            className="border-[1.5px] border-dashed rounded-[8px] p-4 text-center text-[12px]"
            style={{ borderColor: 'var(--accent)', color: 'var(--accent)', background: 'var(--surface)' }}
          >
            Soltar aquí
          </div>
        )}

        <button
          onClick={() => onCreateTask?.(status.id)}
          className="border border-dashed rounded-[8px] p-2 text-[12px] flex items-center justify-center gap-1 mt-auto transition-colors"
          style={{ borderColor: 'var(--line)', color: 'var(--ink-3)', background: 'transparent' }}
        >
          <Plus size={13} /> Nueva tarea
        </button>
      </div>
    </div>
  );
}

/* ── Draggable wrapper ───────────────────────────────────────── */

function DraggableCard({
  task, onOpen, isDragging, selected, onToggleSelect,
}: {
  task: Task;
  onOpen: (t: Task) => void;
  isDragging: boolean;
  selected: boolean;
  onToggleSelect: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({ id: task.id });

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.4 : 1,
    cursor: isDragging ? 'grabbing' : 'grab',
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <TaskCard task={task} onOpen={onOpen} selected={selected} onToggleSelect={onToggleSelect} />
    </div>
  );
}

/* ── Task card ───────────────────────────────────────────────── */

function TaskCard({
  task, onOpen, overlay = false, selected = false, onToggleSelect,
}: {
  task: Task;
  onOpen: (t: Task) => void;
  overlay?: boolean;
  selected?: boolean;
  onToggleSelect?: (id: string) => void;
}) {
  const project = useProjects().find(p => p.id === task.project);
  const labels = useLabels();
  const taskLabels = task.labels.map(id => labels.find(l => l.id === id)).filter(Boolean);
  const progress = task.subtasks.total > 0 ? task.subtasks.done / task.subtasks.total : 0;
  const dueCls = dueClass(task.due, task.status);

  const priorityColors: Record<string, string> = {
    urgent: 'var(--sem-red-2)',
    high:   'var(--sem-orange)',
    med:    'var(--sem-blue-gray-med)',
    low:    'var(--sem-blue-gray-low)',
  };

  return (
    <div
      onClick={() => onOpen(task)}
      className="rounded-[10px] p-3 flex flex-col gap-[8px] border cursor-pointer transition-shadow group"
      style={{
        background: selected ? 'var(--accent-bg)' : 'var(--surface)',
        borderColor: selected ? 'var(--accent)' : 'var(--line)',
        boxShadow: overlay
          ? '0 8px 24px -8px rgba(40,30,80,.18), 0 2px 4px rgba(40,30,80,.06)'
          : 'var(--shadow-1)',
      }}
    >
      {/* Top: ref + priority + checkbox */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-[6px]" style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-3)' }}>
          {/* Checkbox */}
          <button
            onClick={e => { e.stopPropagation(); onToggleSelect?.(task.id); }}
            className="w-4 h-4 rounded-[2px] border flex items-center justify-center flex-shrink-0 transition-all opacity-0 group-hover:opacity-100"
            style={{
              borderColor: selected ? 'var(--accent)' : 'var(--line)',
              background: selected ? 'var(--accent)' : 'transparent',
              opacity: selected ? 1 : undefined,
            }}
          >
            {selected && <span style={{ color: 'white', fontSize: 9, lineHeight: 1 }}>✓</span>}
          </button>
          <span
            className="w-2 h-2 rounded-[2px] flex-shrink-0"
            style={{ background: project?.color }}
          />
          {task.ref}
        </div>
        <span
          className="w-2 h-2 rounded-full"
          style={{ background: priorityColors[task.priority] }}
        />
      </div>

      {/* Title */}
      <div className="text-[13px] font-medium leading-[1.35]" style={{ color: 'var(--ink)' }}>
        {task.title}
      </div>

      {/* Labels */}
      {taskLabels.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {taskLabels.slice(0, 3).map(l => l && (
            <span
              key={l.id}
              className="inline-flex items-center h-5 px-2 rounded-[4px] text-[11px] font-medium"
              style={{ background: l.bg, color: l.fg }}
            >
              {l.text}
            </span>
          ))}
        </div>
      )}

      {/* Progress */}
      {task.subtasks.total > 0 && (
        <div className="flex items-center gap-2">
          <div className="flex-1 h-[4px] rounded-full overflow-hidden" style={{ background: 'var(--bg-3)' }}>
            <div
              className="h-full rounded-full"
              style={{ width: `${progress * 100}%`, background: 'var(--accent)' }}
            />
          </div>
          <span className="text-[11px] tabular-nums" style={{ color: 'var(--ink-3)' }}>
            {task.subtasks.done}/{task.subtasks.total}
          </span>
          {(task.subtasks.overdue ?? 0) > 0 && (
            <span className="text-[10px] font-medium px-[6px] py-px rounded-full flex-shrink-0" style={{ background: 'var(--danger-bg)', color: 'var(--danger)' }}>
              {task.subtasks.overdue}⚠
            </span>
          )}
        </div>
      )}

      {/* Footer: due + assignees */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-[10px]">
          {task.due && (
            <span className={`flex items-center gap-1 text-[11px] ${dueCls}`}>
              <Clock size={12} />
              {fmtDate(task.due, { relative: true })}
            </span>
          )}
        </div>
        <AvatarStack userIds={task.assignees} max={2} />
      </div>
    </div>
  );
}
