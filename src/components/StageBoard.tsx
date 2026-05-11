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
import { ChevronDown, ChevronRight, Plus, Clock } from 'lucide-react';
import { STATUSES, PRIORITIES, getProject, getLabel, fmtDate, dueClass, avatarBg } from '@/lib/data';
import { updateTask } from '@/lib/db';
import { AvatarStack } from './Avatar';
import type { Task, ProjectStage, User } from '@/lib/types';

// ── Stage definitions ────────────────────────────────────────────

export const PROJECT_STAGES: { id: ProjectStage; label: string; color: string; description: string }[] = [
  { id: 'situacion',      label: 'Situación',      color: 'oklch(0.60 0.14 250)', description: 'Diagnóstico y análisis de la situación actual' },
  { id: 'opciones',       label: 'Opciones',        color: 'oklch(0.65 0.14 160)', description: 'Evaluación y selección de alternativas' },
  { id: 'implementacion', label: 'Implementación',  color: 'oklch(0.65 0.14 50)',  description: 'Ejecución e implementación de la solución' },
  { id: 'seguimiento',    label: 'Seguimiento',     color: 'oklch(0.60 0.10 300)', description: 'Seguimiento y monitoreo de resultados' },
];

// ── Drag-drop ID helpers ─────────────────────────────────────────
// Droppable column ID format: `stage:${stageId}:status:${statusId}`
// This lets us decode both stage and status from a single drop zone ID

function encodeDropId(stage: string, status: string) {
  return `stage:${stage}:status:${status}`;
}

function decodeDropId(id: string): { stage: string; status: string } | null {
  const m = id.match(/^stage:(.+):status:(.+)$/);
  if (!m) return null;
  return { stage: m[1], status: m[2] };
}

// ── Main component ───────────────────────────────────────────────

interface Props {
  tasks: Task[];
  users?: User[];
  onOpenTask: (task: Task) => void;
  onCreateTask?: (defaultStatus: Task['status']) => void;
}

export function StageBoard({ tasks: propTasks, users = [], onOpenTask, onCreateTask }: Props) {
  const [overrides, setOverrides] = useState<Record<string, { status?: string; project_stage?: string }>>({});
  const [activeId, setActiveId] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } })
  );

  // Apply local overrides
  const tasks = propTasks.map(t => {
    const ov = overrides[t.id];
    if (!ov) return t;
    return {
      ...t,
      status:        (ov.status        ?? t.status)        as Task['status'],
      project_stage: (ov.project_stage ?? t.project_stage) as Task['project_stage'],
    };
  });

  const activeTask = activeId ? tasks.find(t => t.id === activeId) ?? null : null;

  function toggleCollapse(stageId: string) {
    setCollapsed(prev => {
      const next = new Set(prev);
      next.has(stageId) ? next.delete(stageId) : next.add(stageId);
      return next;
    });
  }

  function handleDragStart({ active }: DragStartEvent) {
    setActiveId(active.id as string);
  }

  function handleDragEnd({ active, over }: DragEndEvent) {
    setActiveId(null);
    if (!over) return;

    const decoded = decodeDropId(over.id as string);
    if (!decoded) return;

    const { stage: newStage, status: newStatus } = decoded;
    const taskId = active.id as string;

    setOverrides(prev => ({
      ...prev,
      [taskId]: { status: newStatus, project_stage: newStage },
    }));

    updateTask(taskId, {
      status:        newStatus as Task['status'],
      project_stage: newStage as Task['project_stage'],
    }).catch(console.error);
  }

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="flex flex-col h-full min-h-0 overflow-y-auto" style={{ padding: '16px 24px 40px' }}>

        {PROJECT_STAGES.map(stage => {
          const stageTasks = tasks.filter(t => t.project_stage === stage.id);
          const isCollapsed = collapsed.has(stage.id);

          return (
            <div
              key={stage.id}
              className="mb-4 rounded-[14px] border overflow-hidden"
              style={{ borderColor: 'var(--line)', background: 'var(--bg-2)' }}
            >
              {/* Stage header */}
              <button
                onClick={() => toggleCollapse(stage.id)}
                className="w-full flex items-center gap-3 px-4 py-3 border-0 text-left transition-colors"
                style={{
                  background: 'transparent',
                  cursor: 'pointer',
                  borderBottom: isCollapsed ? 'none' : `1px solid var(--line)`,
                }}
              >
                <span
                  className="flex items-center justify-center w-5 h-5 rounded-[4px] flex-shrink-0"
                  style={{ color: 'var(--ink-3)' }}
                >
                  {isCollapsed
                    ? <ChevronRight size={14} />
                    : <ChevronDown size={14} />
                  }
                </span>

                {/* Stage color dot */}
                <span
                  className="w-3 h-3 rounded-[3px] flex-shrink-0"
                  style={{ background: stage.color }}
                />

                <span className="text-[14px] font-semibold" style={{ color: 'var(--ink)' }}>
                  {stage.label}
                </span>

                <span
                  className="text-[11px] px-2 py-px rounded-full tabular-nums ml-1"
                  style={{ background: 'var(--bg-3)', color: 'var(--ink-4)' }}
                >
                  {stageTasks.length}
                </span>

                <span className="text-[12px] ml-2 hidden sm:block" style={{ color: 'var(--ink-4)' }}>
                  {stage.description}
                </span>

                {/* Status mini-summary */}
                {!isCollapsed && (
                  <div className="ml-auto flex items-center gap-2 flex-shrink-0">
                    {STATUSES.map(s => {
                      const count = stageTasks.filter(t => t.status === s.id).length;
                      if (count === 0) return null;
                      return (
                        <span
                          key={s.id}
                          className="flex items-center gap-1 text-[11px] tabular-nums"
                          style={{ color: 'var(--ink-4)' }}
                        >
                          <span className="w-2 h-2 rounded-full" style={{ background: s.tone }} />
                          {count}
                        </span>
                      );
                    })}
                  </div>
                )}
              </button>

              {/* Stage columns — hidden when collapsed */}
              {!isCollapsed && (
                <div className="overflow-x-auto" style={{ padding: '12px 12px 16px' }}>
                  <div className="flex gap-3" style={{ minWidth: 'max-content' }}>
                    {STATUSES.map(status => (
                      <StageColumn
                        key={status.id}
                        stage={stage.id}
                        status={status}
                        tasks={stageTasks.filter(t => t.status === status.id)}
                        onOpenTask={onOpenTask}
                        onCreateTask={onCreateTask}
                        activeId={activeId}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Collapsed state: flat task strip */}
              {isCollapsed && stageTasks.length > 0 && (
                <div
                  className="flex flex-wrap gap-2 px-4 py-3"
                  style={{ borderTop: '1px solid var(--line)' }}
                >
                  {stageTasks.slice(0, 8).map(t => (
                    <button
                      key={t.id}
                      onClick={() => onOpenTask(t)}
                      className="flex items-center gap-2 h-7 px-3 rounded-[6px] text-[12px] border-0"
                      style={{ background: 'var(--surface)', color: 'var(--ink)', cursor: 'pointer', border: '1px solid var(--line)' }}
                    >
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: STATUSES.find(s => s.id === t.status)?.tone }} />
                      <span className="font-mono text-[10px]" style={{ color: 'var(--ink-4)' }}>{t.ref}</span>
                      <span className="max-w-[180px] truncate">{t.title}</span>
                    </button>
                  ))}
                  {stageTasks.length > 8 && (
                    <span className="flex items-center h-7 px-2 text-[12px]" style={{ color: 'var(--ink-4)' }}>
                      +{stageTasks.length - 8} más
                    </span>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {/* Tasks without a stage */}
        <NoStageSection
          tasks={tasks.filter(t => !t.project_stage)}
          onOpenTask={onOpenTask}
          onCreateTask={onCreateTask}
          activeId={activeId}
        />
      </div>

      <DragOverlay>
        {activeTask && <StageMiniCard task={activeTask} onOpen={() => {}} overlay />}
      </DragOverlay>
    </DndContext>
  );
}

// ── Column within a stage ────────────────────────────────────────

function StageColumn({
  stage, status, tasks, onOpenTask, onCreateTask, activeId,
}: {
  stage: string;
  status: (typeof STATUSES)[0];
  tasks: Task[];
  onOpenTask: (t: Task) => void;
  onCreateTask?: (defaultStatus: Task['status']) => void;
  activeId: string | null;
}) {
  const dropId = encodeDropId(stage, status.id);
  const { setNodeRef, isOver } = useDroppable({ id: dropId });

  return (
    <div
      ref={setNodeRef}
      className="flex flex-col rounded-[10px] border transition-colors"
      style={{
        width: 240,
        minHeight: 120,
        background: isOver ? 'var(--accent-bg)' : 'var(--surface)',
        borderColor: isOver ? 'var(--accent-line)' : 'var(--line)',
      }}
    >
      {/* Column header */}
      <div className="flex items-center justify-between px-3 py-2 flex-shrink-0">
        <div className="flex items-center gap-2 text-[12px] font-semibold" style={{ color: 'var(--ink)' }}>
          <span className="w-2 h-2 rounded-full" style={{ background: status.tone }} />
          <span>{status.label}</span>
          <span
            className="text-[10px] px-[6px] py-px rounded-full tabular-nums"
            style={{ background: 'var(--bg-3)', color: 'var(--ink-4)' }}
          >
            {tasks.length}
          </span>
        </div>
        <button
          onClick={() => onCreateTask?.(status.id)}
          className="w-5 h-5 flex items-center justify-center rounded-[4px] border-0 bg-transparent"
          style={{ color: 'var(--ink-4)', cursor: 'pointer' }}
          title="Nueva tarea"
        >
          <Plus size={12} />
        </button>
      </div>

      {/* Cards */}
      <div className="flex-1 flex flex-col gap-[6px] px-2 pb-2 min-h-0">
        {tasks.map(task => (
          <DraggableStageCard
            key={task.id}
            task={task}
            onOpen={onOpenTask}
            isDragging={task.id === activeId}
          />
        ))}

        {isOver && tasks.length === 0 && (
          <div
            className="border-[1.5px] border-dashed rounded-[6px] p-3 text-center text-[11px]"
            style={{ borderColor: 'var(--accent)', color: 'var(--accent)' }}
          >
            Soltar aquí
          </div>
        )}
      </div>
    </div>
  );
}

// ── No-stage section ─────────────────────────────────────────────

function NoStageSection({
  tasks, onOpenTask, onCreateTask, activeId,
}: {
  tasks: Task[];
  onOpenTask: (t: Task) => void;
  onCreateTask?: (defaultStatus: Task['status']) => void;
  activeId: string | null;
}) {
  const [collapsed, setCollapsed] = useState(tasks.length === 0);

  if (tasks.length === 0) return null;

  return (
    <div
      className="rounded-[14px] border overflow-hidden"
      style={{ borderColor: 'var(--line)', background: 'var(--bg-2)' }}
    >
      <button
        onClick={() => setCollapsed(v => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 border-0 text-left"
        style={{
          background: 'transparent',
          cursor: 'pointer',
          borderBottom: collapsed ? 'none' : '1px solid var(--line)',
        }}
      >
        <span className="flex items-center justify-center w-5 h-5 rounded-[4px] flex-shrink-0" style={{ color: 'var(--ink-3)' }}>
          {collapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
        </span>
        <span className="w-3 h-3 rounded-[3px] flex-shrink-0" style={{ background: 'var(--line)' }} />
        <span className="text-[14px] font-semibold" style={{ color: 'var(--ink-3)' }}>Sin etapa</span>
        <span className="text-[11px] px-2 py-px rounded-full tabular-nums ml-1" style={{ background: 'var(--bg-3)', color: 'var(--ink-4)' }}>
          {tasks.length}
        </span>
      </button>

      {!collapsed && (
        <div className="overflow-x-auto" style={{ padding: '12px 12px 16px' }}>
          <div className="flex gap-3" style={{ minWidth: 'max-content' }}>
            {STATUSES.map(status => (
              <StageColumn
                key={status.id}
                stage="none"
                status={status}
                tasks={tasks.filter(t => t.status === status.id)}
                onOpenTask={onOpenTask}
                onCreateTask={onCreateTask}
                activeId={activeId}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Draggable wrapper ────────────────────────────────────────────

function DraggableStageCard({
  task, onOpen, isDragging,
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
      <StageMiniCard task={task} onOpen={onOpen} />
    </div>
  );
}

// ── Compact task card ────────────────────────────────────────────

function StageMiniCard({
  task, onOpen, overlay = false,
}: {
  task: Task;
  onOpen: (t: Task) => void;
  overlay?: boolean;
}) {
  const project = getProject(task.project);
  const labels = task.labels.map(id => getLabel(id)).filter(Boolean);
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
      className="rounded-[8px] p-[10px] flex flex-col gap-[6px] border cursor-pointer transition-shadow"
      style={{
        background: 'var(--bg)',
        borderColor: 'var(--line)',
        boxShadow: overlay
          ? '0 8px 24px -8px rgba(40,30,80,.18)'
          : 'var(--shadow-1)',
      }}
    >
      {/* Ref + priority */}
      <div className="flex items-center justify-between">
        <div
          className="flex items-center gap-[5px]"
          style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-4)' }}
        >
          <span className="w-[7px] h-[7px] rounded-[2px] flex-shrink-0" style={{ background: project?.color }} />
          {task.ref}
        </div>
        <span className="w-2 h-2 rounded-full" style={{ background: priorityColors[task.priority] }} />
      </div>

      {/* Title */}
      <div className="text-[12.5px] font-medium leading-[1.3]" style={{ color: 'var(--ink)' }}>
        {task.title}
      </div>

      {/* Labels (max 2) */}
      {labels.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {labels.slice(0, 2).map(l => l && (
            <span
              key={l.id}
              className="inline-flex items-center h-[18px] px-[6px] rounded-[3px] text-[10px] font-medium"
              style={{ background: l.bg, color: l.fg }}
            >
              {l.text}
            </span>
          ))}
        </div>
      )}

      {/* Subtask progress */}
      {task.subtasks.total > 0 && (
        <div className="flex items-center gap-2">
          <div className="flex-1 h-[3px] rounded-full overflow-hidden" style={{ background: 'var(--bg-3)' }}>
            <div
              className="h-full rounded-full"
              style={{
                width: `${(task.subtasks.done / task.subtasks.total) * 100}%`,
                background: 'var(--accent)',
              }}
            />
          </div>
          <span className="text-[10px] tabular-nums" style={{ color: 'var(--ink-4)' }}>
            {task.subtasks.done}/{task.subtasks.total}
          </span>
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between">
        {task.due ? (
          <span className={`flex items-center gap-1 text-[11px] ${dueCls}`}>
            <Clock size={11} />
            {fmtDate(task.due, { relative: true })}
          </span>
        ) : <span />}
        <AvatarStack userIds={task.assignees} max={2} />
      </div>
    </div>
  );
}
