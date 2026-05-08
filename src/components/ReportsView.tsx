'use client';
import { useState } from 'react';
import { STATUSES, PRIORITIES, PEOPLE, avatarBg } from '@/lib/data';
import { useUsers } from '@/lib/users-context';
import type { Task, Project, User } from '@/lib/types';

interface Props {
  tasks: Task[];
  projects: Project[];
  users?: User[];
}

// ─── helpers ──────────────────────────────────────────────────────────────────

function daysBetween(a: Date, b: Date) {
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

function parseDate(s: string) {
  return new Date(s + 'T00:00:00');
}

function clamp(v: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, v));
}

function fmt(n: number, dec = 1) {
  return n.toFixed(dec).replace(/\.0$/, '');
}

/** Week label: "Sem 1", "Sem 2", … counting back from now */
function weekLabel(weeksAgo: number) {
  return weeksAgo === 0 ? 'Esta sem.' : `Sem -${weeksAgo}`;
}

/** Returns the Monday of the week that contains `d` */
function monday(d: Date) {
  const copy = new Date(d);
  const day = copy.getDay(); // 0=Sun
  const diff = day === 0 ? -6 : 1 - day;
  copy.setDate(copy.getDate() + diff);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

// ─── sub-components ───────────────────────────────────────────────────────────

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-[12px] p-5 ${className}`}
      style={{ background: 'var(--surface)', border: '1px solid var(--line)', boxShadow: 'var(--shadow-1)' }}
    >
      {children}
    </div>
  );
}

function SectionTitle({ children, sub }: { children: React.ReactNode; sub?: string }) {
  return (
    <div className="mb-4">
      <div className="text-[13px] font-semibold" style={{ color: 'var(--ink)' }}>{children}</div>
      {sub && <div className="text-[11px] mt-[2px]" style={{ color: 'var(--ink-4)' }}>{sub}</div>}
    </div>
  );
}

function KpiCard({
  label,
  value,
  sub,
  accent,
  warn,
}: {
  label: string;
  value: string | number;
  sub?: string;
  accent?: boolean;
  warn?: boolean;
}) {
  const color = warn
    ? 'oklch(0.62 0.14 38)'
    : accent
    ? 'oklch(0.60 0.14 160)'
    : 'var(--ink)';
  return (
    <div
      className="rounded-[12px] p-5 flex flex-col gap-1"
      style={{ background: 'var(--surface)', border: '1px solid var(--line)', boxShadow: 'var(--shadow-1)' }}
    >
      <div className="text-[11px] font-medium uppercase tracking-wide" style={{ color: 'var(--ink-4)' }}>
        {label}
      </div>
      <div className="text-[32px] font-bold tabular-nums leading-none" style={{ color }}>
        {value}
      </div>
      {sub && (
        <div className="text-[11px] mt-1" style={{ color: 'var(--ink-3)' }}>
          {sub}
        </div>
      )}
    </div>
  );
}

function HBar({
  pct,
  color,
  height = 6,
  bg = 'var(--bg-3)',
}: {
  pct: number;
  color: string;
  height?: number;
  bg?: string;
}) {
  return (
    <div
      className="rounded-full overflow-hidden"
      style={{ height, background: bg, width: '100%' }}
    >
      <div
        className="h-full rounded-full transition-all"
        style={{ width: `${clamp(pct * 100, 0, 100)}%`, background: color }}
      />
    </div>
  );
}

// ─── main component ───────────────────────────────────────────────────────────

export function ReportsView({ tasks, projects, users: propUsers }: Props) {
  const ctxUsers = useUsers();
  const allPeople = (propUsers && propUsers.length > 0)
    ? propUsers
    : ctxUsers.length > 0
    ? ctxUsers
    : PEOPLE;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const total = tasks.length;
  const doneTasks = tasks.filter(t => t.status === 'done');
  const activeTasks = tasks.filter(t => t.status !== 'done');

  // ── KPI 1: tasa de completitud ──────────────────────────────────────────────
  const completionRate = total > 0 ? doneTasks.length / total : 0;

  // ── KPI 2: entregas a tiempo ────────────────────────────────────────────────
  // done tasks where due >= start of their due-date (i.e. not past due when marked done)
  // proxy: due date >= today OR due date was in the future relative to now
  const doneOnTime = doneTasks.filter(t => t.due && parseDate(t.due) >= today).length;
  const onTimeRate = doneTasks.length > 0 ? doneOnTime / doneTasks.length : null;

  // ── KPI 3: precisión de estimaciones ────────────────────────────────────────
  const estimable = tasks.filter(t => t.estimate && t.estimate > 0 && t.spent != null && t.spent > 0);
  const avgAccuracy =
    estimable.length > 0
      ? estimable.reduce((s, t) => s + t.spent! / t.estimate!, 0) / estimable.length
      : null;

  // ── KPI 4: tareas atrasadas ──────────────────────────────────────────────────
  const overdueTasks = activeTasks.filter(t => t.due && parseDate(t.due) < today);

  // ── project stats ────────────────────────────────────────────────────────────
  const projectStats = projects.map(p => {
    const pt = tasks.filter(t => t.project === p.id);
    const pdone = pt.filter(t => t.status === 'done');
    const pct = pt.length ? pdone.length / pt.length : 0;
    const totalEst = pt.reduce((a, t) => a + (t.estimate || 0), 0);
    const totalSpent = pt.reduce((a, t) => a + (t.spent || 0), 0);
    const ratio = totalEst > 0 ? totalSpent / totalEst : null;
    const overdue = pt.filter(t => t.status !== 'done' && t.due && parseDate(t.due) < today);
    return { ...p, total: pt.length, done: pdone.length, pct, totalEst, totalSpent, ratio, overdue };
  });

  // ── tiempo promedio en estado ────────────────────────────────────────────────
  // proxy: doing/review tasks with start → days since start; done tasks with start+due → (due-start)
  const timeInState = projects.map(p => {
    const pt = tasks.filter(t => t.project === p.id);

    const doingDays = (() => {
      const arr = pt.filter(t => t.status === 'doing' && t.start)
        .map(t => daysBetween(parseDate(t.start), today));
      return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null;
    })();

    const reviewDays = (() => {
      const arr = pt.filter(t => t.status === 'review' && t.start)
        .map(t => daysBetween(parseDate(t.start), today));
      return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null;
    })();

    const cycleDays = (() => {
      const arr = pt.filter(t => t.status === 'done' && t.start && t.due)
        .map(t => daysBetween(parseDate(t.start), parseDate(t.due)));
      return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null;
    })();

    return { projectId: p.id, doingDays, reviewDays, cycleDays };
  });

  const maxCycle = Math.max(...timeInState.map(t => t.cycleDays ?? 0), 1);
  const maxDoing = Math.max(...timeInState.map(t => t.doingDays ?? 0), 1);
  const maxReview = Math.max(...timeInState.map(t => t.reviewDays ?? 0), 1);

  // ── overdue by project & assignee ───────────────────────────────────────────
  const overdueByProject = projects
    .map(p => ({
      project: p,
      tasks: overdueTasks.filter(t => t.project === p.id),
    }))
    .filter(g => g.tasks.length > 0);

  const overdueByAssignee = allPeople
    .map(u => ({
      user: u,
      tasks: overdueTasks.filter(t => t.assignees.includes(u.id)),
    }))
    .filter(g => g.tasks.length > 0)
    .sort((a, b) => b.tasks.length - a.tasks.length);

  // ── workload ─────────────────────────────────────────────────────────────────
  const workload = allPeople
    .map(u => {
      const assigned = activeTasks.filter(t => t.assignees.includes(u.id));
      const urgentHigh = assigned.filter(t => t.priority === 'urgent' || t.priority === 'high').length;
      const hours = assigned.reduce((s, t) => s + (t.estimate || 0), 0);
      return { user: u, count: assigned.length, urgentHigh, hours };
    })
    .sort((a, b) => b.count - a.count);
  const maxWorkload = Math.max(...workload.map(w => w.count), 1);

  // ── priority distribution ────────────────────────────────────────────────────
  const priorityCounts = PRIORITIES.map(p => ({
    ...p,
    n: activeTasks.filter(t => t.priority === p.id).length,
  }));

  // ── velocidad semanal (last 8 weeks) ─────────────────────────────────────────
  const WEEKS = 8;
  const thisMonday = monday(today);
  const weeklyData = Array.from({ length: WEEKS }, (_, i) => {
    const weekStart = new Date(thisMonday);
    weekStart.setDate(weekStart.getDate() - i * 7);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);

    const done = tasks.filter(
      t => t.status === 'done' && t.due && parseDate(t.due) >= weekStart && parseDate(t.due) <= weekEnd,
    ).length;
    const due = tasks.filter(
      t => t.due && parseDate(t.due) >= weekStart && parseDate(t.due) <= weekEnd,
    ).length;

    return { weeksAgo: i, done, due, weekStart };
  }).reverse();

  const maxWeeklyDone = Math.max(...weeklyData.map(w => w.done), 1);
  const maxWeeklyDue = Math.max(...weeklyData.map(w => w.due), 1);

  // ── status counts (for stacked bar) ─────────────────────────────────────────
  const statusCounts = STATUSES.map(s => ({
    ...s,
    n: tasks.filter(t => t.status === s.id).length,
  }));

  // accuracy color helper
  function accuracyColor(ratio: number | null) {
    if (ratio === null) return 'var(--ink-4)';
    if (ratio <= 1.0) return 'oklch(0.55 0.14 160)';
    if (ratio <= 1.2) return 'oklch(0.62 0.14 38)';
    return 'oklch(0.58 0.18 25)';
  }

  function accuracyLabel(ratio: number | null) {
    if (ratio === null) return '—';
    return `${fmt(ratio)}x`;
  }

  return (
    <div className="p-6 max-w-[1100px]">
      {/* ── Page header ─────────────────────────────────────────────────────── */}
      <div className="mb-6">
        <h1 className="text-[24px] font-bold tracking-tight" style={{ color: 'var(--ink)' }}>
          Reportes
        </h1>
        <p className="text-[14px] mt-1" style={{ color: 'var(--ink-3)' }}>
          {total} tareas en total · {activeTasks.length} activas · {overdueTasks.length} atrasadas
        </p>
      </div>

      <div className="flex flex-col gap-5">

        {/* ── KPI row ─────────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard
            label="Tasa de completitud"
            value={`${Math.round(completionRate * 100)}%`}
            sub={`${doneTasks.length} de ${total} tareas completadas`}
            accent={completionRate >= 0.5}
          />
          <KpiCard
            label="Entregas a tiempo"
            value={onTimeRate !== null ? `${Math.round(onTimeRate * 100)}%` : '—'}
            sub={
              doneTasks.length > 0
                ? `${doneOnTime} de ${doneTasks.length} completadas`
                : 'Sin tareas completadas'
            }
            accent={(onTimeRate ?? 0) >= 0.7}
            warn={(onTimeRate ?? 1) < 0.5}
          />
          <KpiCard
            label="Precisión de estimaciones"
            value={avgAccuracy !== null ? `${Math.round((1 / Math.max(avgAccuracy, 0.01)) * 100)}%` : '—'}
            sub={
              avgAccuracy !== null
                ? `Ratio promedio ${fmt(avgAccuracy)}x · ${estimable.length} tareas`
                : 'Sin datos suficientes'
            }
            accent={(avgAccuracy ?? 2) <= 1.1}
            warn={(avgAccuracy ?? 0) > 1.3}
          />
          <KpiCard
            label="Tareas atrasadas"
            value={overdueTasks.length}
            sub={
              overdueTasks.length > 0
                ? `En ${new Set(overdueTasks.map(t => t.project)).size} proyecto(s)`
                : 'Sin atrasos activos'
            }
            warn={overdueTasks.length > 0}
            accent={overdueTasks.length === 0}
          />
        </div>

        {/* ── Estado general (stacked bar) ────────────────────────────────────── */}
        <Card>
          <SectionTitle>Estado del trabajo</SectionTitle>
          <div className="flex gap-6 mb-4 flex-wrap">
            {statusCounts.map(s => (
              <div key={s.id} className="flex flex-col gap-1">
                <div className="flex items-center gap-[6px]">
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: s.tone }} />
                  <span className="text-[12px]" style={{ color: 'var(--ink-3)' }}>{s.label}</span>
                </div>
                <span className="text-[28px] font-bold tabular-nums leading-none" style={{ color: 'var(--ink)' }}>
                  {s.n}
                </span>
                <span className="text-[11px]" style={{ color: 'var(--ink-4)' }}>
                  {total > 0 ? Math.round((s.n / total) * 100) : 0}%
                </span>
              </div>
            ))}
          </div>
          <div className="flex rounded-full overflow-hidden h-[8px]" style={{ background: 'var(--bg-3)' }}>
            {statusCounts.map(
              s =>
                s.n > 0 && (
                  <div
                    key={s.id}
                    style={{ flex: s.n, background: s.tone, transition: 'flex .3s' }}
                    title={`${s.label}: ${s.n}`}
                  />
                ),
            )}
          </div>
        </Card>

        {/* ── Progreso por proyecto ────────────────────────────────────────────── */}
        <Card>
          <SectionTitle sub="Porcentaje de tareas completadas · horas estimadas vs. registradas">
            Progreso por proyecto
          </SectionTitle>
          <div className="flex flex-col gap-5">
            {projectStats.map(p => {
              const ratioColor = accuracyColor(p.ratio);
              return (
                <div key={p.id} className="flex flex-col gap-[6px]">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className="w-[10px] h-[10px] rounded-[3px] flex-shrink-0"
                        style={{ background: p.color }}
                      />
                      <span className="text-[13px] font-medium truncate" style={{ color: 'var(--ink)' }}>
                        {p.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-[12px] flex-shrink-0" style={{ color: 'var(--ink-3)' }}>
                      <span>{p.done}/{p.total} tareas</span>
                      {p.totalEst > 0 && (
                        <span style={{ color: ratioColor }}>
                          {p.totalSpent}h / {p.totalEst}h
                          <span className="ml-1 font-semibold">({accuracyLabel(p.ratio)})</span>
                        </span>
                      )}
                      <span
                        className="font-semibold w-[36px] text-right"
                        style={{ color: 'var(--ink-2)' }}
                      >
                        {Math.round(p.pct * 100)}%
                      </span>
                    </div>
                  </div>
                  <HBar pct={p.pct} color={p.color} height={7} />
                </div>
              );
            })}
          </div>
        </Card>

        {/* ── Tiempo promedio en estado ────────────────────────────────────────── */}
        <Card>
          <SectionTitle sub="Promedio de días · proxy basado en fecha de inicio y entrega">
            Tiempo promedio en estado por proyecto
          </SectionTitle>
          <div className="overflow-x-auto">
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th
                    className="text-left text-[11px] font-semibold pb-3 pr-4"
                    style={{ color: 'var(--ink-4)', width: 200 }}
                  >
                    Proyecto
                  </th>
                  <th className="text-left text-[11px] font-semibold pb-3 pr-4" style={{ color: 'var(--ink-4)', minWidth: 160 }}>
                    En curso (días)
                  </th>
                  <th className="text-left text-[11px] font-semibold pb-3 pr-4" style={{ color: 'var(--ink-4)', minWidth: 160 }}>
                    En revisión (días)
                  </th>
                  <th className="text-left text-[11px] font-semibold pb-3" style={{ color: 'var(--ink-4)', minWidth: 180 }}>
                    Ciclo completo (días)
                  </th>
                </tr>
              </thead>
              <tbody>
                {timeInState.map((row, i) => {
                  const proj = projects.find(p => p.id === row.projectId)!;
                  return (
                    <tr key={row.projectId} style={{ borderTop: i > 0 ? '1px solid var(--line)' : undefined }}>
                      <td className="py-3 pr-4">
                        <div className="flex items-center gap-2">
                          <span
                            className="w-[8px] h-[8px] rounded-[2px] flex-shrink-0"
                            style={{ background: proj.color }}
                          />
                          <span className="text-[12px] font-medium" style={{ color: 'var(--ink)' }}>
                            {proj.name}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 pr-4">
                        <div className="flex items-center gap-2">
                          <span
                            className="text-[12px] tabular-nums w-[28px]"
                            style={{ color: 'var(--ink-2)' }}
                          >
                            {row.doingDays !== null ? fmt(row.doingDays) : '—'}
                          </span>
                          {row.doingDays !== null && (
                            <div style={{ flex: 1, maxWidth: 100 }}>
                              <HBar
                                pct={row.doingDays / maxDoing}
                                color="oklch(0.62 0.16 265)"
                                height={5}
                              />
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="py-3 pr-4">
                        <div className="flex items-center gap-2">
                          <span
                            className="text-[12px] tabular-nums w-[28px]"
                            style={{ color: 'var(--ink-2)' }}
                          >
                            {row.reviewDays !== null ? fmt(row.reviewDays) : '—'}
                          </span>
                          {row.reviewDays !== null && (
                            <div style={{ flex: 1, maxWidth: 100 }}>
                              <HBar
                                pct={row.reviewDays / maxReview}
                                color="oklch(0.68 0.13 38)"
                                height={5}
                              />
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="py-3">
                        <div className="flex items-center gap-2">
                          <span
                            className="text-[12px] tabular-nums w-[28px]"
                            style={{ color: 'var(--ink-2)' }}
                          >
                            {row.cycleDays !== null ? fmt(row.cycleDays) : '—'}
                          </span>
                          {row.cycleDays !== null && (
                            <div style={{ flex: 1, maxWidth: 120 }}>
                              <HBar
                                pct={row.cycleDays / maxCycle}
                                color="oklch(0.60 0.14 160)"
                                height={5}
                              />
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>

        {/* ── Precisión de estimaciones por proyecto ──────────────────────────── */}
        <Card>
          <SectionTitle sub="Horas estimadas (gris) vs. horas registradas · verde = dentro de presupuesto, naranja = hasta 20% sobre, rojo = más de 20% sobre">
            Precisión de estimaciones por proyecto
          </SectionTitle>
          <div className="flex flex-col gap-5">
            {projectStats
              .filter(p => p.totalEst > 0)
              .map(p => {
                const ratio = p.ratio ?? 0;
                const spentColor =
                  ratio <= 1.0
                    ? 'oklch(0.55 0.14 160)'
                    : ratio <= 1.2
                    ? 'oklch(0.62 0.14 38)'
                    : 'oklch(0.58 0.18 25)';
                const maxH = Math.max(p.totalEst, p.totalSpent);
                return (
                  <div key={p.id} className="flex flex-col gap-[8px]">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span
                          className="w-[8px] h-[8px] rounded-[2px] flex-shrink-0"
                          style={{ background: p.color }}
                        />
                        <span className="text-[13px] font-medium" style={{ color: 'var(--ink)' }}>
                          {p.name}
                        </span>
                      </div>
                      <span
                        className="text-[12px] font-semibold tabular-nums"
                        style={{ color: spentColor }}
                      >
                        {accuracyLabel(p.ratio)}
                      </span>
                    </div>
                    {/* estimate bar (background reference) */}
                    <div className="relative flex flex-col gap-[4px]">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] w-[72px] text-right tabular-nums" style={{ color: 'var(--ink-4)' }}>
                          {p.totalEst}h estim.
                        </span>
                        <div className="flex-1 rounded-full overflow-hidden" style={{ height: 7, background: 'var(--bg-3)' }}>
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${(p.totalEst / maxH) * 100}%`,
                              background: 'var(--line)',
                            }}
                          />
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] w-[72px] text-right tabular-nums" style={{ color: spentColor }}>
                          {p.totalSpent}h real
                        </span>
                        <div className="flex-1 rounded-full overflow-hidden" style={{ height: 7, background: 'var(--bg-3)' }}>
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${(p.totalSpent / maxH) * 100}%`,
                              background: spentColor,
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
        </Card>

        {/* ── Análisis de atrasos ──────────────────────────────────────────────── */}
        {overdueTasks.length > 0 ? (
          <Card>
            <SectionTitle sub={`${overdueTasks.length} tarea${overdueTasks.length !== 1 ? 's' : ''} activa${overdueTasks.length !== 1 ? 's' : ''} con fecha de entrega vencida`}>
              Análisis de atrasos
            </SectionTitle>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* by project */}
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-wide mb-3" style={{ color: 'var(--ink-4)' }}>
                  Por proyecto
                </div>
                <div className="flex flex-col gap-3">
                  {overdueByProject.map(({ project: p, tasks: pt }) => (
                    <div key={p.id} className="flex flex-col gap-[6px]">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span
                            className="w-[8px] h-[8px] rounded-[2px] flex-shrink-0"
                            style={{ background: p.color }}
                          />
                          <span className="text-[12px] font-medium" style={{ color: 'var(--ink)' }}>
                            {p.name}
                          </span>
                        </div>
                        <span
                          className="text-[12px] font-semibold tabular-nums px-2 py-[1px] rounded-full"
                          style={{ background: 'oklch(0.94 0.04 25)', color: 'oklch(0.42 0.14 25)' }}
                        >
                          {pt.length}
                        </span>
                      </div>
                      <div className="flex flex-col gap-[3px] pl-4">
                        {pt.slice(0, 3).map(t => (
                          <div key={t.id} className="flex items-center gap-2">
                            <span
                              className="w-[3px] h-[3px] rounded-full flex-shrink-0"
                              style={{ background: 'var(--ink-4)' }}
                            />
                            <span
                              className="text-[11px] truncate"
                              style={{ color: 'var(--ink-3)', maxWidth: 260 }}
                              title={t.title}
                            >
                              {t.title.length > 45 ? t.title.slice(0, 45) + '…' : t.title}
                            </span>
                            <span className="text-[10px] tabular-nums flex-shrink-0" style={{ color: 'oklch(0.58 0.18 25)' }}>
                              {daysBetween(parseDate(t.due), today)}d
                            </span>
                          </div>
                        ))}
                        {pt.length > 3 && (
                          <span className="text-[11px] pl-3" style={{ color: 'var(--ink-4)' }}>
                            +{pt.length - 3} más
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              {/* by assignee */}
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-wide mb-3" style={{ color: 'var(--ink-4)' }}>
                  Por responsable
                </div>
                <div className="flex flex-col gap-3">
                  {overdueByAssignee.length > 0 ? overdueByAssignee.map(({ user: u, tasks: ut }) => (
                    <div key={u.id} className="flex items-center gap-3">
                      <div
                        className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[11px] font-semibold flex-shrink-0"
                        style={{ background: avatarBg(u.hue) }}
                      >
                        {u.initials}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-[4px]">
                          <span className="text-[12px] font-medium truncate" style={{ color: 'var(--ink)' }}>
                            {u.name.split(' ')[0]}
                          </span>
                          <span
                            className="text-[11px] font-semibold tabular-nums px-2 py-[1px] rounded-full ml-2 flex-shrink-0"
                            style={{ background: 'oklch(0.94 0.04 25)', color: 'oklch(0.42 0.14 25)' }}
                          >
                            {ut.length}
                          </span>
                        </div>
                        <HBar
                          pct={ut.length / Math.max(...overdueByAssignee.map(g => g.tasks.length), 1)}
                          color="oklch(0.58 0.18 25)"
                          height={4}
                        />
                      </div>
                    </div>
                  )) : (
                    <p className="text-[12px]" style={{ color: 'var(--ink-4)' }}>
                      Tareas sin asignado
                    </p>
                  )}
                </div>
              </div>
            </div>
          </Card>
        ) : (
          <Card>
            <SectionTitle>Análisis de atrasos</SectionTitle>
            <div
              className="flex items-center justify-center py-8 rounded-[8px] text-[13px]"
              style={{ background: 'var(--bg-3)', color: 'var(--ink-4)' }}
            >
              Sin tareas atrasadas — ¡todo al día!
            </div>
          </Card>
        )}

        {/* ── Bottom row: workload + priority ─────────────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Carga de trabajo */}
          <Card>
            <SectionTitle sub="Tareas activas asignadas · barra azul = urgente/alta, verde = resto">
              Carga de trabajo
            </SectionTitle>
            <div className="flex flex-col gap-3">
              {workload.map(({ user: u, count, urgentHigh, hours }) => (
                <div key={u.id} className="flex items-center gap-3">
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[11px] font-semibold flex-shrink-0"
                    style={{ background: avatarBg(u.hue) }}
                  >
                    {u.initials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-[4px]">
                      <div className="min-w-0 flex items-center gap-2">
                        <span
                          className="text-[12.5px] font-medium truncate"
                          style={{ color: 'var(--ink)' }}
                        >
                          {u.name.split(' ')[0]}
                        </span>
                        <span className="text-[11px]" style={{ color: 'var(--ink-4)' }}>
                          {u.role}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                        {hours > 0 && (
                          <span className="text-[11px] tabular-nums" style={{ color: 'var(--ink-4)' }}>
                            {hours}h
                          </span>
                        )}
                        <span
                          className="text-[11px] tabular-nums"
                          style={{ color: 'var(--ink-3)' }}
                        >
                          {count} tarea{count !== 1 ? 's' : ''}
                        </span>
                      </div>
                    </div>
                    <HBar
                      pct={count / maxWorkload}
                      color={
                        urgentHigh > 0
                          ? 'oklch(0.62 0.16 265)'
                          : 'oklch(0.60 0.14 160)'
                      }
                      height={5}
                    />
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Distribución de prioridad */}
          <Card>
            <SectionTitle sub="Tareas activas por nivel de prioridad">
              Distribución de prioridad
            </SectionTitle>
            <div className="flex flex-col gap-4 mt-1">
              {priorityCounts.map(p => (
                <div key={p.id} className="flex flex-col gap-[6px]">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: p.tone }} />
                      <span className="text-[13px]" style={{ color: 'var(--ink-2)' }}>{p.label}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className="text-[11px] tabular-nums"
                        style={{ color: 'var(--ink-4)' }}
                      >
                        {activeTasks.length > 0 ? Math.round((p.n / activeTasks.length) * 100) : 0}%
                      </span>
                      <span
                        className="text-[13px] font-semibold tabular-nums w-[28px] text-right"
                        style={{ color: 'var(--ink)' }}
                      >
                        {p.n}
                      </span>
                    </div>
                  </div>
                  <HBar
                    pct={activeTasks.length > 0 ? p.n / activeTasks.length : 0}
                    color={p.tone}
                    height={6}
                  />
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* ── Velocidad semanal ────────────────────────────────────────────────── */}
        <Card>
          <SectionTitle sub="Tareas con entrega en la semana · azul = completadas, gris = total con vencimiento">
            Velocidad semanal — últimas 8 semanas
          </SectionTitle>
          <div className="flex items-end gap-[6px]" style={{ height: 120 }}>
            {weeklyData.map(w => {
              const doneH = maxWeeklyDue > 0 ? (w.done / maxWeeklyDue) * 100 : 0;
              const dueH = maxWeeklyDue > 0 ? (w.due / maxWeeklyDue) * 100 : 0;
              const isCurrentWeek = w.weeksAgo === 0;
              return (
                <div key={w.weeksAgo} className="flex-1 flex flex-col items-center gap-[4px]">
                  {/* bar group */}
                  <div
                    className="w-full flex items-end justify-center gap-[2px]"
                    style={{ height: 90 }}
                    title={`${weekLabel(w.weeksAgo)}: ${w.done} completadas / ${w.due} con vencimiento`}
                  >
                    {/* due bar (background) */}
                    <div
                      className="rounded-t-[3px] transition-all"
                      style={{
                        width: '42%',
                        height: `${dueH}%`,
                        minHeight: w.due > 0 ? 4 : 0,
                        background: isCurrentWeek ? 'oklch(0.80 0.04 265)' : 'var(--bg-3)',
                        border: '1px solid var(--line)',
                      }}
                    />
                    {/* done bar */}
                    <div
                      className="rounded-t-[3px] transition-all"
                      style={{
                        width: '42%',
                        height: `${doneH}%`,
                        minHeight: w.done > 0 ? 4 : 0,
                        background: isCurrentWeek
                          ? 'oklch(0.55 0.18 265)'
                          : 'oklch(0.62 0.16 265)',
                      }}
                    />
                  </div>
                  {/* label */}
                  <div
                    className="text-[10px] text-center tabular-nums leading-tight"
                    style={{
                      color: isCurrentWeek ? 'var(--ink-2)' : 'var(--ink-4)',
                      fontWeight: isCurrentWeek ? 600 : 400,
                    }}
                  >
                    {weekLabel(w.weeksAgo)}
                  </div>
                  {/* count */}
                  {w.done > 0 && (
                    <div className="text-[10px] tabular-nums font-semibold" style={{ color: 'oklch(0.55 0.18 265)' }}>
                      {w.done}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          {/* legend */}
          <div className="flex items-center gap-4 mt-3 pt-3" style={{ borderTop: '1px solid var(--line)' }}>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-[2px]" style={{ background: 'oklch(0.62 0.16 265)' }} />
              <span className="text-[11px]" style={{ color: 'var(--ink-3)' }}>Completadas</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-[2px]" style={{ background: 'var(--bg-3)', border: '1px solid var(--line)' }} />
              <span className="text-[11px]" style={{ color: 'var(--ink-3)' }}>Total con vencimiento</span>
            </div>
          </div>
        </Card>

      </div>
    </div>
  );
}
