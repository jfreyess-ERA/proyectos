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
import { Plus, MoreHorizontal, Clock } from 'lucide-react';
import { STATUSES, getProject, getLabel, fmtDate, dueClass } from '@/lib/data';
import { updateTaskStatus } from '@/lib/db';
import { AvatarStack } from './Avatar';
import type { Task } from '@/lib/types';

interface Props {
  tasks: Task[];
  onOpenTask: (task: Task) => void;
  onCreateTask?: (defaultStatus: Task['status']) => void;
}

export function Board({ tasks: propTasks, onOpenTask, onCreateTask }: Props) {
  const [statusOverrides, setStatusOverrides] = useState<Record<string, string>>({});
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } })
  );

  const tasks = propTasks.map(t =>
    statusOverrides[t.id] ? { ...t, status: statusOverrides[t.id] as Task['status'] } : t
  );

  const activeTask = activeId ? tasks.find(t => t.id === activeId) ?? null : null;

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

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div
        className="h-full overflow-x-auto overflow-y-hidden"
        style={{ padding: '16px 24px 24px' }}
      >
        <div className="flex gap-[14px] h-full">
          {STATUSES.map(status => (
            <KanbanColumn
              key={status.id}
              status={status}
              tasks={tasks.filter(t => t.status === status.id)}
              onOpenTask={onOpenTask}
              onCreateTask={onCreateTask}
              activeId={activeId}
            />
          ))}
        </div>
      </div>

      <DragOverlay>
        {activeTask && <TaskCard task={activeTask} onOpen={() => {}} overlay />}
      </DragOverlay>
    </DndContext>
  );
}

/* ── Column ──────────────────────────────────────────────────── */

function KanbanColumn({
  status,
  tasks,
  onOpenTask,
  onCreateTask,
  activeId,
}: {
  status: (typeof STATUSES)[0];
  tasks: Task[];
  onOpenTask: (t: Task) => void;
  onCreateTask?: (defaultStatus: Task['status']) => void;
  activeId: string | null;
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
            className="w-6 h-6 flex items-center justify-center rounded-[5px] border-0 bg-transparent"
            style={{ color: 'var(--ink-3)' }}
          >
            <Plus size={13} />
          </button>
          <button
            className="w-6 h-6 flex items-center justify-center rounded-[5px] border-0 bg-transparent"
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
  task,
  onOpen,
  isDragging,
}: {
  task: Task;
  onOpen: (t: Task) => void;
  isDragging: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({ id: task.id });

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.4 : 1,
    cursor: isDragging ? 'grabbing' : 'grab',
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <TaskCard task={task} onOpen={onOpen} />
    </div>
  );
}

/* ── Task card ───────────────────────────────────────────────── */

function TaskCard({
  task,
  onOpen,
  overlay = false,
}: {
  task: Task;
  onOpen: (t: Task) => void;
  overlay?: boolean;
}) {
  const project = getProject(task.project);
  const labels = task.labels.map(id => getLabel(id)).filter(Boolean);
  const progress = task.subtasks.total > 0 ? task.subtasks.done / task.subtasks.total : 0;
  const dueCls = dueClass(task.due, task.status);

  const priorityColors: Record<string, string> = {
    urgent: 'oklch(0.58 0.18 25)',
    high:   'oklch(0.65 0.14 50)',
    med:    'oklch(0.62 0.05 250)',
    low:    'oklch(0.62 0.02 250)',
  };

  return (
    <div
      onClick={() => onOpen(task)}
      className="rounded-[10px] p-3 flex flex-col gap-[8px] border cursor-pointer transition-shadow"
      style={{
        background: 'var(--surface)',
        borderColor: 'var(--line)',
        boxShadow: overlay
          ? '0 8px 24px -8px rgba(40,30,80,.18), 0 2px 4px rgba(40,30,80,.06)'
          : 'var(--shadow-1)',
      }}
    >
      {/* Top: ref + priority */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-[6px]" style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-3)' }}>
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
      <div className="text-[13.5px] font-medium leading-[1.35]" style={{ color: 'var(--ink)' }}>
        {task.title}
      </div>

      {/* Labels */}
      {labels.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {labels.slice(0, 3).map(l => l && (
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
        </div>
      )}

      {/* Footer: due + assignees */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-[10px]">
          {task.due && (
            <span className={`flex items-center gap-1 text-[11.5px] ${dueCls}`}>
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
