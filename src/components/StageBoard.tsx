'use client';
import { useState } from 'react';
import {
  DndContext, DragOverlay, PointerSensor,
  useSensor, useSensors, useDroppable, useDraggable,
  type DragEndEvent, type DragStartEvent,
} from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { ArrowLeft, Clock, Plus, Users, CheckCircle2, CircleDashed } from 'lucide-react';
import { STATUSES, fmtDate, dueClass, avatarBg } from '@/lib/data';
import { useProjects } from '@/lib/projects-context';
import { useLabels } from '@/lib/labels-context';
import { updateTask } from '@/lib/db';
import { AvatarStack } from './Avatar';
import type { Task, ProjectStage, User } from '@/lib/types';

// ── Stage definitions ────────────────────────────────────────────

export const PROJECT_STAGES: {
  id: ProjectStage;
  label: string;
  color: string;
  description: string;
}[] = [
  { id: 'situacion',      label: 'Situación',     color: 'oklch(0.55 0.16 250)', description: 'Diagnóstico y análisis de la situación actual' },
  { id: 'opciones',       label: 'Opciones',       color: 'oklch(0.55 0.16 160)', description: 'Evaluación y selección de alternativas' },
  { id: 'implementacion', label: 'Implementación', color: 'oklch(0.58 0.16 50)',  description: 'Ejecución e implementación de la solución' },
  { id: 'seguimiento',    label: 'Seguimiento',    color: 'var(--sem-purple)', description: 'Seguimiento y monitoreo de resultados' },
];

// ── Main component ───────────────────────────────────────────────

interface Props {
  tasks: Task[];
  users?: User[];
  onOpenTask: (task: Task) => void;
  onCreateTask?: (defaultStatus: Task['status']) => void;
}

export function StageBoard({ tasks, users = [], onOpenTask, onCreateTask }: Props) {
  const [activeStage, setActiveStage] = useState<ProjectStage | null>(null);

  if (activeStage) {
    const stageDef = PROJECT_STAGES.find(s => s.id === activeStage)!;
    const stageTasks = tasks.filter(t => t.project_stage === activeStage);
    return (
      <StageKanban
        stage={stageDef}
        tasks={stageTasks}
        allTasks={tasks}
        users={users}
        onOpenTask={onOpenTask}
        onCreateTask={onCreateTask}
        onBack={() => setActiveStage(null)}
      />
    );
  }

  return (
    <StageOverview
      tasks={tasks}
      users={users}
      onSelectStage={setActiveStage}
      onCreateTask={onCreateTask}
    />
  );
}

// ── Stage overview cards ─────────────────────────────────────────

function StageOverview({
  tasks, users, onSelectStage, onCreateTask,
}: {
  tasks: Task[];
  users: User[];
  onSelectStage: (s: ProjectStage) => void;
  onCreateTask?: (s: Task['status']) => void;
}) {
  const unassigned = tasks.filter(t => !t.project_stage);

  return (
    <div className="flex flex-col h-full min-h-0 overflow-y-auto" style={{ padding: '28px 32px 48px' }}>
      {/* Section title */}
      <div className="mb-6">
        <h2 className="text-[18px] font-bold" style={{ color: 'var(--ink)' }}>Etapas del proyecto</h2>
        <p className="text-[13px] mt-1" style={{ color: 'var(--ink-3)' }}>
          Selecciona una etapa para ver y gestionar sus tareas
        </p>
      </div>

      {/* Stage cards grid */}
      <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))' }}>
        {PROJECT_STAGES.map(stage => {
          const stageTasks = tasks.filter(t => t.project_stage === stage.id);
          const done  = stageTasks.filter(t => t.status === 'done').length;
          const total = stageTasks.length;
          const pct   = total > 0 ? Math.round((done / total) * 100) : 0;

          // Unique assignees
          const assigneeIds = [...new Set(stageTasks.flatMap(t => t.assignees))];
          const assigneeUsers = assigneeIds
            .map(id => users.find(u => u.id === id))
            .filter(Boolean) as User[];

          // Status breakdown
          const statusCounts = STATUSES.map(s => ({
            ...s,
            count: stageTasks.filter(t => t.status === s.id).length,
          }));

          return (
            <button
              key={stage.id}
              onClick={() => onSelectStage(stage.id)}
              className="flex flex-col rounded-[16px] border text-left transition-all group"
              style={{
                background: 'var(--surface)',
                borderColor: 'var(--line)',
                cursor: 'pointer',
                overflow: 'hidden',
              }}
            >
              {/* Color top bar */}
              <div
                className="h-[5px] w-full flex-shrink-0 transition-all group-hover:h-[6px]"
                style={{ background: stage.color }}
              />

              <div className="flex flex-col gap-4 p-5">
                {/* Header */}
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-[16px] font-bold" style={{ color: 'var(--ink)' }}>
                      {stage.label}
                    </div>
                    <div className="text-[12px] mt-[3px]" style={{ color: 'var(--ink-3)' }}>
                      {stage.description}
                    </div>
                  </div>
                  <span
                    className="flex-shrink-0 text-[22px] font-bold tabular-nums leading-none mt-[2px]"
                    style={{ color: total === 0 ? 'var(--ink-4)' : stage.color }}
                  >
                    {total}
                  </span>
                </div>

                {/* Progress bar */}
                <div>
                  <div className="flex items-center justify-between mb-[6px]">
                    <span className="text-[11px]" style={{ color: 'var(--ink-4)' }}>Avance</span>
                    <span className="text-[12px] font-semibold tabular-nums" style={{ color: pct === 100 ? 'var(--success, #22c55e)' : 'var(--ink-2)' }}>
                      {pct}%
                    </span>
                  </div>
                  <div className="h-[6px] rounded-full overflow-hidden" style={{ background: 'var(--bg-3)' }}>
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${pct}%`,
                        background: pct === 100 ? 'var(--success, #22c55e)' : stage.color,
                      }}
                    />
                  </div>
                </div>

                {/* Status breakdown */}
                <div className="flex flex-wrap gap-x-3 gap-y-[6px]">
                  {statusCounts.filter(s => s.count > 0).map(s => (
                    <span
                      key={s.id}
                      className="flex items-center gap-[5px] text-[11.5px]"
                      style={{ color: 'var(--ink-3)' }}
                    >
                      <span className="w-[7px] h-[7px] rounded-full flex-shrink-0" style={{ background: s.tone }} />
                      {s.label}
                      <span className="font-semibold tabular-nums" style={{ color: 'var(--ink-2)' }}>{s.count}</span>
                    </span>
                  ))}
                  {total === 0 && (
                    <span className="text-[11.5px]" style={{ color: 'var(--ink-4)' }}>Sin tareas aún</span>
                  )}
                </div>

                {/* Footer: people + done count */}
                <div className="flex items-center justify-between pt-1 border-t" style={{ borderColor: 'var(--line)' }}>
                  <div className="flex items-center gap-2">
                    {assigneeUsers.length > 0
                      ? (
                        <div className="flex items-center gap-[6px]">
                          <div className="flex -space-x-[6px]">
                            {assigneeUsers.slice(0, 5).map(u => (
                              <div
                                key={u.id}
                                title={u.name}
                                className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-semibold border-2 flex-shrink-0"
                                style={{ background: avatarBg(u.hue), borderColor: 'var(--surface)' }}
                              >
                                {u.initials.slice(0, 1)}
                              </div>
                            ))}
                            {assigneeUsers.length > 5 && (
                              <div
                                className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-semibold border-2 flex-shrink-0"
                                style={{ background: 'var(--bg-3)', color: 'var(--ink-3)', borderColor: 'var(--surface)' }}
                              >
                                +{assigneeUsers.length - 5}
                              </div>
                            )}
                          </div>
                          <span className="text-[11px]" style={{ color: 'var(--ink-4)' }}>
                            {assigneeUsers.length} {assigneeUsers.length === 1 ? 'persona' : 'personas'}
                          </span>
                        </div>
                      )
                      : (
                        <span className="flex items-center gap-1 text-[11px]" style={{ color: 'var(--ink-4)' }}>
                          <Users size={12} /> Sin asignados
                        </span>
                      )
                    }
                  </div>

                  <span className="flex items-center gap-1 text-[11.5px]" style={{ color: done > 0 ? 'var(--success, #22c55e)' : 'var(--ink-4)' }}>
                    <CheckCircle2 size={13} />
                    {done}/{total} completadas
                  </span>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Unassigned tasks warning */}
      {unassigned.length > 0 && (
        <div
          className="mt-6 flex items-center gap-3 px-4 py-3 rounded-[10px] border text-[13px]"
          style={{ borderColor: 'var(--line)', background: 'var(--bg-2)', color: 'var(--ink-3)' }}
        >
          <CircleDashed size={16} style={{ color: 'var(--ink-4)', flexShrink: 0 }} />
          <span>
            <span className="font-semibold" style={{ color: 'var(--ink-2)' }}>{unassigned.length} {unassigned.length === 1 ? 'tarea' : 'tareas'}</span>
            {' '}sin etapa asignada — ábrelas y asígnalas desde el campo &quot;Etapa ERA&quot;
          </span>
        </div>
      )}
    </div>
  );
}

// ── Stage kanban (drill-down) ────────────────────────────────────

function StageKanban({
  stage, tasks, allTasks, users, onOpenTask, onCreateTask, onBack,
}: {
  stage: (typeof PROJECT_STAGES)[0];
  tasks: Task[];
  allTasks: Task[];
  users: User[];
  onOpenTask: (t: Task) => void;
  onCreateTask?: (s: Task['status']) => void;
  onBack: () => void;
}) {
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } })
  );

  const resolvedTasks = tasks.map(t =>
    overrides[t.id] ? { ...t, status: overrides[t.id] as Task['status'] } : t
  );
  const activeTask = activeId ? resolvedTasks.find(t => t.id === activeId) ?? null : null;

  // Stage progress summary
  const done  = resolvedTasks.filter(t => t.status === 'done').length;
  const total = resolvedTasks.length;
  const pct   = total > 0 ? Math.round((done / total) * 100) : 0;

  function handleDragStart({ active }: DragStartEvent) {
    setActiveId(active.id as string);
  }

  function handleDragEnd({ active, over }: DragEndEvent) {
    setActiveId(null);
    if (!over) return;
    const newStatus = over.id as string;
    const validStatuses = STATUSES.map(s => s.id as string);
    if (validStatuses.includes(newStatus)) {
      setOverrides(prev => ({ ...prev, [active.id as string]: newStatus }));
      updateTask(active.id as string, { status: newStatus as Task['status'] }).catch(console.error);
    }
  }

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="flex flex-col h-full min-h-0">
        {/* Stage header bar */}
        <div
          className="flex items-center gap-4 px-6 py-3 border-b flex-shrink-0"
          style={{ borderColor: 'var(--line)', background: 'var(--bg)' }}
        >
          <button
            onClick={onBack}
            className="flex items-center gap-2 h-8 px-3 rounded-[8px] text-[13px] border-0 transition-colors"
            style={{ background: 'var(--bg-2)', color: 'var(--ink-2)', cursor: 'pointer', border: '1px solid var(--line)' }}
          >
            <ArrowLeft size={14} />
            Etapas
          </button>

          {/* Stage indicator */}
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-[3px]" style={{ background: stage.color }} />
            <span className="text-[15px] font-bold" style={{ color: 'var(--ink)' }}>{stage.label}</span>
          </div>

          {/* Progress pill */}
          <div className="flex items-center gap-2 ml-2">
            <div className="w-[120px] h-[6px] rounded-full overflow-hidden" style={{ background: 'var(--bg-3)' }}>
              <div
                className="h-full rounded-full"
                style={{ width: `${pct}%`, background: pct === 100 ? 'var(--success, #22c55e)' : stage.color }}
              />
            </div>
            <span className="text-[12px] tabular-nums font-semibold" style={{ color: 'var(--ink-3)' }}>
              {done}/{total}
            </span>
            <span className="text-[12px]" style={{ color: 'var(--ink-4)' }}>completadas</span>
          </div>

          {/* Stage navigation pills */}
          <div className="ml-auto flex items-center gap-1">
            {PROJECT_STAGES.map(s => (
              <span
                key={s.id}
                className="h-6 px-3 rounded-full text-[11px] font-medium flex items-center"
                style={{
                  background: s.id === stage.id ? stage.color + '22' : 'transparent',
                  color: s.id === stage.id ? stage.color : 'var(--ink-4)',
                  border: `1px solid ${s.id === stage.id ? stage.color + '66' : 'transparent'}`,
                }}
              >
                {s.label}
              </span>
            ))}
          </div>
        </div>

        {/* Kanban columns */}
        <div className="flex-1 overflow-x-auto overflow-y-hidden min-h-0" style={{ padding: '16px 24px 24px' }}>
          <div className="flex gap-[14px] h-full">
            {STATUSES.map(status => (
              <KanbanColumn
                key={status.id}
                status={status}
                tasks={resolvedTasks.filter(t => t.status === status.id)}
                onOpenTask={onOpenTask}
                onCreateTask={onCreateTask}
                activeId={activeId}
                stageColor={stage.color}
              />
            ))}
          </div>
        </div>
      </div>

      <DragOverlay>
        {activeTask && <MiniCard task={activeTask} onOpen={() => {}} overlay />}
      </DragOverlay>
    </DndContext>
  );
}

// ── Kanban column ────────────────────────────────────────────────

function KanbanColumn({
  status, tasks, onOpenTask, onCreateTask, activeId, stageColor,
}: {
  status: (typeof STATUSES)[0];
  tasks: Task[];
  onOpenTask: (t: Task) => void;
  onCreateTask?: (s: Task['status']) => void;
  activeId: string | null;
  stageColor: string;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status.id });

  return (
    <div
      ref={setNodeRef}
      className="w-[300px] flex-shrink-0 flex flex-col rounded-[12px] border transition-colors"
      style={{
        background: isOver ? 'var(--accent-bg)' : 'var(--bg-2)',
        borderColor: isOver ? stageColor : 'var(--line)',
        minHeight: 0,
      }}
    >
      <div className="flex items-center justify-between px-3 py-[10px] flex-shrink-0">
        <div className="flex items-center gap-2 text-[13px] font-semibold" style={{ color: 'var(--ink)' }}>
          <span className="w-2 h-2 rounded-full" style={{ background: status.tone }} />
          {status.label}
          <span
            className="text-[11px] px-[7px] py-px rounded-full tabular-nums"
            style={{ background: 'var(--bg-3)', color: 'var(--ink-4)' }}
          >
            {tasks.length}
          </span>
        </div>
        <button
          onClick={() => onCreateTask?.(status.id)}
          className="w-6 h-6 flex items-center justify-center rounded-[5px] border-0 bg-transparent"
          style={{ color: 'var(--ink-3)', cursor: 'pointer' }}
        >
          <Plus size={13} />
        </button>
      </div>

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
          style={{ borderColor: 'var(--line)', color: 'var(--ink-3)', background: 'transparent', cursor: 'pointer' }}
        >
          <Plus size={13} /> Nueva tarea
        </button>
      </div>
    </div>
  );
}

// ── Draggable wrapper ────────────────────────────────────────────

function DraggableCard({ task, onOpen, isDragging }: { task: Task; onOpen: (t: Task) => void; isDragging: boolean }) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({ id: task.id });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), opacity: isDragging ? 0.4 : 1, cursor: isDragging ? 'grabbing' : 'grab' }}
      {...attributes}
      {...listeners}
    >
      <MiniCard task={task} onOpen={onOpen} />
    </div>
  );
}

// ── Task card ────────────────────────────────────────────────────

function MiniCard({ task, onOpen, overlay = false }: { task: Task; onOpen: (t: Task) => void; overlay?: boolean }) {
  const project  = useProjects().find(p => p.id === task.project);
  const labelDefs = useLabels();
  const labels   = task.labels.map(id => labelDefs.find(l => l.id === id)).filter(Boolean);
  const dueCls   = dueClass(task.due, task.status);
  const progress = task.subtasks.total > 0 ? task.subtasks.done / task.subtasks.total : 0;

  const priorityColors: Record<string, string> = {
    urgent: 'var(--sem-red-2)',
    high:   'var(--sem-orange)',
    med:    'var(--sem-blue-gray-med)',
    low:    'var(--sem-blue-gray-low)',
  };

  return (
    <div
      onClick={() => onOpen(task)}
      className="rounded-[10px] p-3 flex flex-col gap-[8px] border cursor-pointer transition-shadow"
      style={{
        background: 'var(--surface)',
        borderColor: 'var(--line)',
        boxShadow: overlay ? '0 8px 24px -8px rgba(40,30,80,.18)' : 'var(--shadow-1)',
      }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-[6px]" style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-3)' }}>
          <span className="w-2 h-2 rounded-[2px] flex-shrink-0" style={{ background: project?.color }} />
          {task.ref}
        </div>
        <span className="w-2 h-2 rounded-full" style={{ background: priorityColors[task.priority] }} />
      </div>

      <div className="text-[13.5px] font-medium leading-[1.35]" style={{ color: 'var(--ink)' }}>
        {task.title}
      </div>

      {labels.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {labels.slice(0, 3).map(l => l && (
            <span key={l.id} className="inline-flex items-center h-5 px-2 rounded-[4px] text-[11px] font-medium" style={{ background: l.bg, color: l.fg }}>
              {l.text}
            </span>
          ))}
        </div>
      )}

      {task.subtasks.total > 0 && (
        <div className="flex items-center gap-2">
          <div className="flex-1 h-[4px] rounded-full overflow-hidden" style={{ background: 'var(--bg-3)' }}>
            <div className="h-full rounded-full" style={{ width: `${progress * 100}%`, background: 'var(--accent)' }} />
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

      <div className="flex items-center justify-between">
        {task.due
          ? <span className={`flex items-center gap-1 text-[11.5px] ${dueCls}`}><Clock size={12} />{fmtDate(task.due, { relative: true })}</span>
          : <span />
        }
        <AvatarStack userIds={task.assignees} max={2} />
      </div>
    </div>
  );
}
