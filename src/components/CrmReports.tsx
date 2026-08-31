'use client';
import { useState } from 'react';
import type { Prospect, CrmInteraction, CrmTask, CrmTrigger, User } from '@/lib/types';
import { calcWarmthScore } from './ProspectsView';

interface Props {
  prospects: Prospect[];
  interactions: CrmInteraction[];
  crmTasks: CrmTask[];
  triggers: CrmTrigger[];
  users?: User[];
}

const STAGES = ['New', 'Contacted', 'Meeting Requested', 'Meeting Held', 'Proposal', 'Negotiation', 'Won'];
const STAGE_COLOR: Record<string, string> = {
  'New': 'var(--sem-gray-2)', 'Contacted': 'var(--sem-blue)',
  'Meeting Requested': 'var(--sem-amber-3)', 'Meeting Held': 'var(--sem-orange-2)',
  'Proposal': 'var(--sem-purple)', 'Negotiation': 'var(--sem-indigo-3)',
  'Won': 'var(--sem-green)',
};
const CHANNELS = ['Email', 'LinkedIn', 'Phone', 'WhatsApp', 'Meeting', 'Event', 'Referral'];
const CHANNEL_EMOJI: Record<string, string> = {
  Email: '📧', LinkedIn: '💼', Phone: '📞', WhatsApp: '💬', Meeting: '🤝', Event: '🎪', Referral: '👥',
};

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

function Title({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[13px] font-semibold mb-4" style={{ color: 'var(--ink)' }}>
      {children}
    </div>
  );
}

function last6Months(): string[] {
  const months: string[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    d.setDate(1);
    months.push(d.toISOString().slice(0, 7));
  }
  return months;
}

function daysBetween(a: string, b: string): number {
  return Math.round(Math.abs(new Date(b).getTime() - new Date(a).getTime()) / 86400000);
}

function monthLabel(m: string): string {
  return new Date(m + '-15').toLocaleString('es-CL', { month: 'short' });
}

export function CrmReports({ prospects, interactions, crmTasks, triggers, users = [] }: Props) {
  const today = new Date().toISOString().slice(0, 10);

  // ── Derived sets ─────────────────────────────────────────────────
  const closedWon = prospects.filter(p => p.status === 'Closed Won');
  const closedLost = prospects.filter(p => p.status === 'Closed Lost');
  const activeProspects = prospects.filter(p => p.status !== 'Closed Won' && p.status !== 'Closed Lost');

  // ── KPI 1: Tasa de cierre ─────────────────────────────────────────
  const wonCount = closedWon.length;
  const lostCount = closedLost.length;
  const closedTotal = wonCount + lostCount;
  const closingRate = closedTotal > 0 ? Math.round((wonCount / closedTotal) * 100) : null;

  // ── KPI 2: Ciclo de venta promedio (Won) ─────────────────────────
  const wonCycles = closedWon
    .filter(p => p.created_at && p.updated_at)
    .map(p => daysBetween(p.created_at, p.updated_at!));
  const avgWonCycle = wonCycles.length > 0
    ? Math.round(wonCycles.reduce((a, b) => a + b, 0) / wonCycles.length)
    : null;

  // ── KPI 3: Tiempo al primer contacto ─────────────────────────────
  const firstContactTimes: number[] = [];
  for (const p of prospects) {
    const pInter = interactions.filter(i => i.prospect_id === p.id && i.date);
    if (pInter.length === 0) continue;
    const firstDate = pInter.map(i => i.date).sort()[0];
    if (firstDate && p.created_at) {
      const days = daysBetween(p.created_at.slice(0, 10), firstDate);
      firstContactTimes.push(days);
    }
  }
  const avgFirstContact = firstContactTimes.length > 0
    ? Math.round(firstContactTimes.reduce((a, b) => a + b, 0) / firstContactTimes.length)
    : null;

  // ── KPI 4: Interacciones por cierre (Won) ────────────────────────
  const wonInteractions = closedWon.map(p => interactions.filter(i => i.prospect_id === p.id).length);
  const avgInterPerClose = wonInteractions.length > 0
    ? Math.round((wonInteractions.reduce((a, b) => a + b, 0) / wonInteractions.length) * 10) / 10
    : null;

  // ── KPI 5: Tasa de respuesta positiva ────────────────────────────
  const POSITIVE_OUTCOMES = new Set(['Positive', 'Interested', 'Meeting booked']);
  const withOutcome = interactions.filter(i => i.outcome);
  const positiveCount = withOutcome.filter(i => POSITIVE_OUTCOMES.has(i.outcome!)).length;
  const positiveRate = withOutcome.length > 0
    ? Math.round((positiveCount / withOutcome.length) * 100)
    : null;

  // ── Section 1: Funnel de conversión ──────────────────────────────
  const funnelData = STAGES.map((stage, i) => {
    const atOrBeyond = activeProspects.filter(p => STAGES.indexOf(p.stage) >= i).length;
    const lostHere = closedLost.filter(p => p.stage === stage).length;
    const lostPct = closedTotal > 0 ? Math.round((lostHere / Math.max(closedTotal, 1)) * 100) : 0;
    return { stage, n: atOrBeyond, lostHere, lostPct };
  });
  const funnelMax = funnelData[0]?.n || 1;
  const funnelConvRates = funnelData.map((s, i) => {
    if (i === 0) return 100;
    const prev = funnelData[i - 1].n;
    return prev > 0 ? Math.round((s.n / prev) * 100) : 0;
  });
  const newToWonPct = prospects.length > 0
    ? Math.round((wonCount / prospects.length) * 100)
    : 0;

  // ── Section 2: Tiempo entre etapas (proxy: avg days since updated_at) ──
  const stageTimings = STAGES.map(stage => {
    const atStage = activeProspects.filter(p => p.stage === stage && p.updated_at);
    if (atStage.length === 0) return { stage, avgDays: null };
    const days = atStage.map(p => daysBetween(p.updated_at!.slice(0, 10), today));
    const avg = Math.round(days.reduce((a, b) => a + b, 0) / days.length);
    return { stage, avgDays: avg };
  });

  // ── Section 3: Won vs Lost por mes (últimos 6 meses) ─────────────
  const months6 = last6Months();
  const wonLostByMonth = months6.map(m => {
    const w = closedWon.filter(p => p.updated_at?.startsWith(m)).length;
    const l = closedLost.filter(p => p.updated_at?.startsWith(m)).length;
    const rate = w + l > 0 ? Math.round((w / (w + l)) * 100) : null;
    return { month: m, label: monthLabel(m), won: w, lost: l, rate };
  });
  const maxWonLost = Math.max(...wonLostByMonth.map(m => Math.max(m.won, m.lost)), 1);

  // ── Section 4: Distribución ciclo de venta ───────────────────────
  type Bucket = { label: string; won: number; lost: number };
  const cycleBuckets: Bucket[] = [
    { label: '<30d', won: 0, lost: 0 },
    { label: '30-60d', won: 0, lost: 0 },
    { label: '60-90d', won: 0, lost: 0 },
    { label: '90-180d', won: 0, lost: 0 },
    { label: '>180d', won: 0, lost: 0 },
  ];
  for (const p of [...closedWon, ...closedLost]) {
    if (!p.created_at || !p.updated_at) continue;
    const days = daysBetween(p.created_at, p.updated_at);
    const isWon = p.status === 'Closed Won';
    const bucket =
      days < 30 ? 0 :
      days < 60 ? 1 :
      days < 90 ? 2 :
      days < 180 ? 3 : 4;
    if (isWon) cycleBuckets[bucket].won++;
    else cycleBuckets[bucket].lost++;
  }
  const maxCycleBucket = Math.max(...cycleBuckets.map(b => b.won + b.lost), 1);

  // ── Section 5: Tiempo al primer contacto por fuente ──────────────
  const sourceMap: Record<string, number[]> = {};
  for (const p of prospects) {
    if (!p.source) continue;
    const pInter = interactions.filter(i => i.prospect_id === p.id && i.date);
    if (pInter.length === 0) continue;
    const firstDate = pInter.map(i => i.date).sort()[0];
    if (firstDate && p.created_at) {
      const days = daysBetween(p.created_at.slice(0, 10), firstDate);
      if (!sourceMap[p.source]) sourceMap[p.source] = [];
      sourceMap[p.source].push(days);
    }
  }
  const sourceTimings = Object.entries(sourceMap)
    .map(([source, arr]) => ({
      source,
      avgDays: Math.round(arr.reduce((a, b) => a + b, 0) / arr.length),
      n: arr.length,
    }))
    .sort((a, b) => a.avgDays - b.avgDays);
  const maxSourceDays = Math.max(...sourceTimings.map(s => s.avgDays), 1);

  // ── Section 6: Interacciones por canal ───────────────────────────
  const byChannel = CHANNELS.map(ch => ({
    channel: ch,
    n: interactions.filter(i => i.channel === ch).length,
  })).filter(c => c.n > 0).sort((a, b) => b.n - a.n);
  const maxChannel = Math.max(...byChannel.map(c => c.n), 1);

  // ── Section 7: Resultados por canal ──────────────────────────────
  const channelResults = CHANNELS.map(ch => {
    const chInter = interactions.filter(i => i.channel === ch && i.outcome);
    if (chInter.length === 0) return null;
    const pos = chInter.filter(i => POSITIVE_OUTCOMES.has(i.outcome!)).length;
    return {
      channel: ch,
      positiveRate: Math.round((pos / chInter.length) * 100),
      total: chInter.length,
      positive: pos,
    };
  }).filter(Boolean).sort((a, b) => b!.positiveRate - a!.positiveRate) as {
    channel: string; positiveRate: number; total: number; positive: number;
  }[];

  // ── Section 8: Tendencia mensual ─────────────────────────────────
  const trendData = months6.map(m => ({
    month: m,
    label: monthLabel(m),
    newProspects: prospects.filter(p => p.created_at?.startsWith(m)).length,
    interactions: interactions.filter(i => i.date.startsWith(m)).length,
  }));
  const maxTrendNew = Math.max(...trendData.map(d => d.newProspects), 1);
  const maxTrendInter = Math.max(...trendData.map(d => d.interactions), 1);

  // ── Section 9: Por responsable ───────────────────────────────────
  const userMap = Object.fromEntries(users.map(u => [u.id, u]));
  const ownerIds = [...new Set(prospects.map(p => p.owner_id).filter(Boolean))] as string[];
  const byOwner = ownerIds.map(id => {
    const mine = prospects.filter(p => p.owner_id === id);
    const myWon = mine.filter(p => p.status === 'Closed Won');
    const cycles = myWon
      .filter(p => p.created_at && p.updated_at)
      .map(p => daysBetween(p.created_at, p.updated_at!));
    const avgCycle = cycles.length > 0
      ? Math.round(cycles.reduce((a, b) => a + b, 0) / cycles.length)
      : null;
    return {
      id,
      name: userMap[id]?.name ?? id,
      total: mine.length,
      active: mine.filter(p => p.status !== 'Closed Won' && p.status !== 'Closed Lost').length,
      won: myWon.length,
      lost: mine.filter(p => p.status === 'Closed Lost').length,
      winRate: myWon.length + mine.filter(p => p.status === 'Closed Lost').length > 0
        ? Math.round(myWon.length / (myWon.length + mine.filter(p => p.status === 'Closed Lost').length) * 100)
        : null,
      avgCycle,
    };
  }).sort((a, b) => b.total - a.total);

  // ── Tasks ────────────────────────────────────────────────────────
  const doneTasks = crmTasks.filter(t => t.status === 'Done').length;
  const taskPct = crmTasks.length > 0 ? Math.round(doneTasks / crmTasks.length * 100) : 0;
  const overdueTasks = crmTasks.filter(
    t => (t.status === 'Pending' || t.status === 'In Progress') && t.due_date && t.due_date < today
  ).length;

  return (
    <div className="p-6 max-w-[1200px]">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-[24px] font-bold tracking-tight" style={{ color: 'var(--ink)' }}>
          Reportes CRM
        </h1>
        <p className="text-[14px] mt-1" style={{ color: 'var(--ink-3)' }}>
          {prospects.length} prospectos · {interactions.length} interacciones · {triggers.filter(t => t.status === 'Open').length} triggers abiertos
        </p>
      </div>

      {/* ── Header KPIs (5 cards) ─────────────────────────────────── */}
      <div className="grid grid-cols-5 gap-3 mb-6">
        {/* 1. Tasa de cierre */}
        <Card>
          <div
            className="text-[28px] font-bold tabular-nums leading-none mb-1"
            style={{ color: closingRate !== null && closingRate >= 50 ? 'var(--sem-green-dark-2)' : 'var(--sem-red)' }}
          >
            {closingRate !== null ? `${closingRate}%` : '—'}
          </div>
          <div className="text-[12px] font-medium" style={{ color: 'var(--ink)' }}>Tasa de cierre</div>
          <div className="text-[11px] mt-[2px]" style={{ color: 'var(--ink-4)' }}>
            {wonCount}G / {lostCount}P
          </div>
        </Card>

        {/* 2. Ciclo de venta promedio */}
        <Card>
          <div
            className="text-[28px] font-bold tabular-nums leading-none mb-1"
            style={{ color: 'var(--sem-blue)' }}
          >
            {avgWonCycle !== null ? `${avgWonCycle}d` : '—'}
          </div>
          <div className="text-[12px] font-medium" style={{ color: 'var(--ink)' }}>Ciclo prom. (ganados)</div>
          <div className="text-[11px] mt-[2px]" style={{ color: 'var(--ink-4)' }}>
            {wonCycles.length} casos
          </div>
        </Card>

        {/* 3. Tiempo al primer contacto */}
        <Card>
          <div
            className="text-[28px] font-bold tabular-nums leading-none mb-1"
            style={{ color: 'var(--sem-orange-2)' }}
          >
            {avgFirstContact !== null ? `${avgFirstContact}d` : '—'}
          </div>
          <div className="text-[12px] font-medium" style={{ color: 'var(--ink)' }}>Tiempo 1er contacto</div>
          <div className="text-[11px] mt-[2px]" style={{ color: 'var(--ink-4)' }}>
            {firstContactTimes.length} prospectos
          </div>
        </Card>

        {/* 4. Interacciones por cierre */}
        <Card>
          <div
            className="text-[28px] font-bold tabular-nums leading-none mb-1"
            style={{ color: 'var(--sem-purple)' }}
          >
            {avgInterPerClose !== null ? avgInterPerClose : '—'}
          </div>
          <div className="text-[12px] font-medium" style={{ color: 'var(--ink)' }}>Interacciones/cierre</div>
          <div className="text-[11px] mt-[2px]" style={{ color: 'var(--ink-4)' }}>
            promedio ganados
          </div>
        </Card>

        {/* 5. Tasa de respuesta positiva */}
        <Card>
          <div
            className="text-[28px] font-bold tabular-nums leading-none mb-1"
            style={{ color: positiveRate !== null && positiveRate >= 40 ? 'var(--sem-green-dark-2)' : 'oklch(0.65 0.14 55)' }}
          >
            {positiveRate !== null ? `${positiveRate}%` : '—'}
          </div>
          <div className="text-[12px] font-medium" style={{ color: 'var(--ink)' }}>Tasa resp. positiva</div>
          <div className="text-[11px] mt-[2px]" style={{ color: 'var(--ink-4)' }}>
            {positiveCount} / {withOutcome.length} con resultado
          </div>
        </Card>
      </div>

      {/* ── Section 1: Funnel de conversión ──────────────────────── */}
      <Card className="mb-4">
        <Title>Funnel de conversión con tasas</Title>
        <div className="flex flex-col gap-2">
          {funnelData.map((s, i) => (
            <div key={s.stage} className="flex items-center gap-3">
              <div className="w-[145px] text-[12px] truncate flex-shrink-0" style={{ color: 'var(--ink-2)' }}>
                {s.stage}
              </div>
              <div className="flex-1 h-[22px] rounded-[4px] overflow-hidden" style={{ background: 'var(--bg-3)' }}>
                <div
                  className="h-full rounded-[4px] flex items-center pl-2 transition-all"
                  style={{
                    width: `${(s.n / funnelMax) * 100}%`,
                    background: STAGE_COLOR[s.stage],
                    minWidth: s.n > 0 ? 24 : 0,
                  }}
                >
                  {s.n > 0 && <span className="text-[11px] font-semibold text-white">{s.n}</span>}
                </div>
              </div>
              {/* Conv desde anterior */}
              {i > 0 ? (
                <div
                  className="w-[42px] text-[11px] text-right flex-shrink-0 font-medium"
                  style={{
                    color: funnelConvRates[i] >= 50
                      ? 'var(--sem-green-dark-2)'
                      : funnelConvRates[i] >= 25
                      ? 'var(--sem-amber-2)'
                      : 'var(--sem-red)',
                  }}
                >
                  {funnelConvRates[i]}%
                </div>
              ) : (
                <div className="w-[42px] text-[11px] flex-shrink-0" style={{ color: 'var(--ink-4)' }}>base</div>
              )}
              {/* % abandona aquí */}
              <div className="w-[90px] text-[11px] text-right flex-shrink-0" style={{ color: 'var(--ink-4)' }}>
                {s.lostHere > 0 ? (
                  <span style={{ color: 'var(--sem-red)' }}>
                    {s.lostPct}% abandona ({s.lostHere})
                  </span>
                ) : (
                  <span>—</span>
                )}
              </div>
            </div>
          ))}
        </div>
        <div
          className="mt-3 pt-3 text-[11px] flex gap-6"
          style={{ borderTop: '1px solid var(--line)', color: 'var(--ink-4)' }}
        >
          <span>
            Conversión global New→Won:{' '}
            <strong style={{ color: 'var(--ink-2)' }}>{newToWonPct}%</strong>
          </span>
          <span style={{ color: 'var(--ink-4)' }}>
            Tasa conversión = columna izquierda · % abandona = perdidos en esa etapa
          </span>
        </div>
      </Card>

      {/* ── Section 2: Tiempo entre etapas ───────────────────────── */}
      <Card className="mb-4">
        <Title>Tiempo estimado por etapa (días en etapa actual · prospectos activos)</Title>
        <div className="flex items-center gap-0 overflow-x-auto pb-2">
          {stageTimings.map((s, i) => (
            <div key={s.stage} className="flex items-center flex-shrink-0">
              <div
                className="flex flex-col items-center px-3 py-2 rounded-[8px] min-w-[100px]"
                style={{ background: 'var(--bg-3)', border: '1px solid var(--line)' }}
              >
                <div
                  className="text-[10.5px] font-semibold text-center mb-1 truncate max-w-[90px]"
                  style={{ color: STAGE_COLOR[s.stage] }}
                >
                  {s.stage}
                </div>
                <div className="text-[18px] font-bold tabular-nums" style={{ color: 'var(--ink)' }}>
                  {s.avgDays !== null ? `${s.avgDays}d` : '—'}
                </div>
                <div className="text-[10px]" style={{ color: 'var(--ink-4)' }}>prom.</div>
              </div>
              {i < stageTimings.length - 1 && (
                <div
                  className="text-[16px] px-1 flex-shrink-0"
                  style={{ color: 'var(--ink-4)' }}
                >
                  →
                </div>
              )}
            </div>
          ))}
        </div>
        <p className="text-[11px] mt-2" style={{ color: 'var(--ink-4)' }}>
          Aproximación: días desde última actualización para prospectos activos en cada etapa.
        </p>
      </Card>

      {/* ── Section 3: Won vs Lost por mes ───────────────────────── */}
      <Card className="mb-4">
        <Title>Ganados vs Perdidos por mes (últimos 6 meses)</Title>
        <div className="flex items-end gap-4">
          {wonLostByMonth.map(m => (
            <div key={m.month} className="flex-1 flex flex-col items-center gap-1">
              {m.rate !== null && (
                <div className="text-[11px] font-semibold" style={{ color: 'var(--sem-green-dark-2)' }}>
                  {m.rate}%
                </div>
              )}
              <div className="w-full flex gap-[3px] items-end h-[80px]">
                {/* Won bar */}
                <div className="flex-1 rounded-t-[3px] transition-all" style={{
                  height: `${(m.won / maxWonLost) * 72}px`,
                  minHeight: m.won > 0 ? 4 : 0,
                  background: 'var(--sem-green-3)',
                }} />
                {/* Lost bar */}
                <div className="flex-1 rounded-t-[3px] transition-all" style={{
                  height: `${(m.lost / maxWonLost) * 72}px`,
                  minHeight: m.lost > 0 ? 4 : 0,
                  background: 'var(--sem-red)',
                }} />
              </div>
              <div className="text-[11px] font-medium" style={{ color: 'var(--ink-3)' }}>{m.label}</div>
              <div className="text-[10px]" style={{ color: 'var(--ink-4)' }}>
                {m.won}G · {m.lost}P
              </div>
            </div>
          ))}
        </div>
        <div className="mt-3 flex gap-4" style={{ color: 'var(--ink-4)' }}>
          <span className="flex items-center gap-1 text-[11px]">
            <span className="w-3 h-3 rounded-[2px] inline-block" style={{ background: 'var(--sem-green-3)' }} />
            Ganados
          </span>
          <span className="flex items-center gap-1 text-[11px]">
            <span className="w-3 h-3 rounded-[2px] inline-block" style={{ background: 'var(--sem-red)' }} />
            Perdidos
          </span>
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-4 mb-4">
        {/* ── Section 4: Ciclo de venta — distribución ──────────── */}
        <Card>
          <Title>Distribución ciclo de venta (ganados y perdidos)</Title>
          {cycleBuckets.every(b => b.won + b.lost === 0) ? (
            <div className="text-[12px]" style={{ color: 'var(--ink-4)' }}>Sin datos suficientes</div>
          ) : (
            <div className="flex flex-col gap-3">
              {cycleBuckets.map(b => (
                <div key={b.label} className="flex items-center gap-3">
                  <div className="w-[55px] text-[12px] flex-shrink-0" style={{ color: 'var(--ink-2)' }}>
                    {b.label}
                  </div>
                  <div className="flex-1 flex flex-col gap-[3px]">
                    {/* Won */}
                    <div
                      className="h-[7px] rounded-full transition-all"
                      style={{
                        width: `${(b.won / maxCycleBucket) * 100}%`,
                        minWidth: b.won > 0 ? 6 : 0,
                        background: 'var(--sem-green-3)',
                      }}
                    />
                    {/* Lost */}
                    <div
                      className="h-[7px] rounded-full transition-all"
                      style={{
                        width: `${(b.lost / maxCycleBucket) * 100}%`,
                        minWidth: b.lost > 0 ? 6 : 0,
                        background: 'var(--sem-red)',
                      }}
                    />
                  </div>
                  <div className="text-[11px] tabular-nums flex-shrink-0 w-[50px] text-right" style={{ color: 'var(--ink-3)' }}>
                    {b.won}G · {b.lost}P
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="mt-3 flex gap-4" style={{ color: 'var(--ink-4)' }}>
            <span className="flex items-center gap-1 text-[11px]">
              <span className="w-3 h-2 rounded-full inline-block" style={{ background: 'var(--sem-green-3)' }} />
              Ganados
            </span>
            <span className="flex items-center gap-1 text-[11px]">
              <span className="w-3 h-2 rounded-full inline-block" style={{ background: 'var(--sem-red)' }} />
              Perdidos
            </span>
          </div>
        </Card>

        {/* ── Section 5: Tiempo al primer contacto por fuente ────── */}
        <Card>
          <Title>Tiempo al primer contacto por fuente</Title>
          {sourceTimings.length === 0 ? (
            <div className="text-[12px]" style={{ color: 'var(--ink-4)' }}>Sin datos de fuente</div>
          ) : (
            <div className="flex flex-col gap-3">
              {sourceTimings.map(s => (
                <div key={s.source} className="flex items-center gap-3">
                  <div className="w-[90px] text-[12px] truncate flex-shrink-0" style={{ color: 'var(--ink-2)' }}>
                    {s.source}
                  </div>
                  <div className="flex-1 h-[8px] rounded-full overflow-hidden" style={{ background: 'var(--bg-3)' }}>
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${(s.avgDays / maxSourceDays) * 100}%`,
                        background: 'var(--sem-orange-2)',
                      }}
                    />
                  </div>
                  <div className="text-[12px] font-semibold tabular-nums w-[36px] text-right flex-shrink-0" style={{ color: 'var(--ink)' }}>
                    {s.avgDays}d
                  </div>
                  <div className="text-[11px] w-[20px] text-right flex-shrink-0" style={{ color: 'var(--ink-4)' }}>
                    n={s.n}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        {/* ── Section 6: Interacciones por canal ──────────────────── */}
        <Card>
          <Title>Interacciones por canal</Title>
          <div className="flex flex-col gap-3">
            {byChannel.length === 0 && (
              <div className="text-[12px]" style={{ color: 'var(--ink-4)' }}>Sin datos aún</div>
            )}
            {byChannel.map(c => (
              <div key={c.channel} className="flex items-center gap-3">
                <span className="text-[16px] flex-shrink-0">{CHANNEL_EMOJI[c.channel] ?? '📋'}</span>
                <span className="text-[12.5px] w-[80px]" style={{ color: 'var(--ink-2)' }}>{c.channel}</span>
                <div className="flex-1 h-[8px] rounded-full overflow-hidden" style={{ background: 'var(--bg-3)' }}>
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${(c.n / maxChannel) * 100}%`, background: 'var(--accent)' }}
                  />
                </div>
                <span
                  className="text-[12px] font-semibold tabular-nums w-6 text-right"
                  style={{ color: 'var(--ink)' }}
                >
                  {c.n}
                </span>
              </div>
            ))}
          </div>
        </Card>

        {/* ── Section 7: Resultados por canal ─────────────────────── */}
        <Card>
          <Title>Tasa de respuesta positiva por canal</Title>
          {channelResults.length === 0 ? (
            <div className="text-[12px]" style={{ color: 'var(--ink-4)' }}>Sin datos de resultados</div>
          ) : (
            <div className="flex flex-col gap-3">
              {channelResults.map(c => (
                <div key={c.channel} className="flex items-center gap-3">
                  <span className="text-[16px] flex-shrink-0">{CHANNEL_EMOJI[c.channel] ?? '📋'}</span>
                  <span className="text-[12.5px] w-[80px]" style={{ color: 'var(--ink-2)' }}>{c.channel}</span>
                  <div className="flex-1 h-[8px] rounded-full overflow-hidden" style={{ background: 'var(--bg-3)' }}>
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${c.positiveRate}%`,
                        background: c.positiveRate >= 60
                          ? 'var(--sem-green-dark-2)'
                          : c.positiveRate >= 35
                          ? 'oklch(0.60 0.16 85)'
                          : 'oklch(0.65 0.14 25)',
                      }}
                    />
                  </div>
                  <span
                    className="text-[12px] font-semibold tabular-nums w-[36px] text-right"
                    style={{ color: 'var(--ink)' }}
                  >
                    {c.positiveRate}%
                  </span>
                  <span className="text-[11px] w-[28px] text-right" style={{ color: 'var(--ink-4)' }}>
                    n={c.total}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* ── Section 8: Tendencia mensual ─────────────────────────── */}
      <Card className="mb-4">
        <Title>Tendencia mensual — nuevos prospectos e interacciones (últimos 6 meses)</Title>
        <div className="flex items-end gap-4">
          {trendData.map((d, i) => (
            <div key={d.month} className="flex-1 flex flex-col items-center gap-1">
              <div className="w-full flex gap-[3px] items-end h-[100px]">
                {/* Nuevos prospectos */}
                <div
                  className="flex-1 rounded-t-[3px] transition-all"
                  style={{
                    height: `${(d.newProspects / maxTrendNew) * 90}px`,
                    minHeight: d.newProspects > 0 ? 4 : 0,
                    background: i === 5 ? 'var(--accent)' : 'oklch(0.65 0.14 245)',
                  }}
                />
                {/* Interacciones */}
                <div
                  className="flex-1 rounded-t-[3px] transition-all"
                  style={{
                    height: `${(d.interactions / maxTrendInter) * 90}px`,
                    minHeight: d.interactions > 0 ? 4 : 0,
                    background: i === 5 ? 'var(--sem-purple)' : 'var(--sem-purple-2)',
                  }}
                />
              </div>
              <div className="text-[11px] font-medium" style={{ color: 'var(--ink-3)' }}>{d.label}</div>
              <div className="text-[10px]" style={{ color: 'var(--ink-4)' }}>
                {d.newProspects}P · {d.interactions}I
              </div>
            </div>
          ))}
        </div>
        <div className="mt-3 flex gap-4" style={{ color: 'var(--ink-4)' }}>
          <span className="flex items-center gap-1 text-[11px]">
            <span className="w-3 h-3 rounded-[2px] inline-block" style={{ background: 'oklch(0.65 0.14 245)' }} />
            Nuevos prospectos
          </span>
          <span className="flex items-center gap-1 text-[11px]">
            <span className="w-3 h-3 rounded-[2px] inline-block" style={{ background: 'var(--sem-purple-2)' }} />
            Interacciones
          </span>
        </div>
      </Card>

      {/* ── Section 9: Por responsable ────────────────────────────── */}
      <Card className="mb-4">
        <Title>Desempeño por responsable</Title>
        {byOwner.length === 0 ? (
          <div className="text-[12px]" style={{ color: 'var(--ink-4)' }}>Sin datos de asignación</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[12px]" style={{ borderCollapse: 'separate', borderSpacing: '0 3px' }}>
              <thead>
                <tr>
                  {['Responsable', 'Total', 'Activos', 'Ganados', 'Perdidos', 'Tasa cierre', 'Ciclo prom.'].map(h => (
                    <th
                      key={h}
                      className="text-left py-1 px-2 text-[11px] font-semibold"
                      style={{ color: 'var(--ink-4)', borderBottom: '1px solid var(--line)' }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {byOwner.map(o => (
                  <tr key={o.id} className="group">
                    <td className="py-2 px-2">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-semibold text-white flex-shrink-0"
                          style={{ background: 'var(--accent)' }}
                        >
                          {o.name.slice(0, 2).toUpperCase()}
                        </div>
                        <span className="font-medium truncate max-w-[120px]" style={{ color: 'var(--ink)' }}>
                          {o.name}
                        </span>
                      </div>
                    </td>
                    <td className="py-2 px-2 tabular-nums text-center" style={{ color: 'var(--ink-2)' }}>
                      {o.total}
                    </td>
                    <td className="py-2 px-2 tabular-nums text-center" style={{ color: 'var(--sem-blue)' }}>
                      {o.active}
                    </td>
                    <td className="py-2 px-2 tabular-nums text-center" style={{ color: 'var(--sem-green-dark-2)' }}>
                      {o.won}
                    </td>
                    <td className="py-2 px-2 tabular-nums text-center" style={{ color: 'var(--sem-red)' }}>
                      {o.lost}
                    </td>
                    <td className="py-2 px-2 tabular-nums text-center font-semibold">
                      {o.winRate !== null ? (
                        <span
                          style={{
                            color: o.winRate >= 50
                              ? 'var(--sem-green-dark-2)'
                              : o.winRate >= 30
                              ? 'var(--sem-amber-2)'
                              : 'var(--sem-red)',
                          }}
                        >
                          {o.winRate}%
                        </span>
                      ) : '—'}
                    </td>
                    <td className="py-2 px-2 tabular-nums text-center" style={{ color: 'var(--ink-3)' }}>
                      {o.avgCycle !== null ? `${o.avgCycle}d` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* ── Tasks summary row ─────────────────────────────────────── */}
      <div className="grid grid-cols-4 gap-3">
        {[
          {
            label: 'Tareas completadas',
            value: `${taskPct}%`,
            color: taskPct >= 70 ? 'var(--sem-green-dark-2)' : 'var(--sem-orange-2)',
            sub: `${doneTasks} / ${crmTasks.length}`,
          },
          {
            label: 'Tareas vencidas',
            value: overdueTasks,
            color: overdueTasks > 0 ? 'var(--sem-red)' : 'var(--ink-4)',
            sub: 'pendientes/en curso',
          },
          {
            label: 'Triggers abiertos',
            value: triggers.filter(t => t.status === 'Open').length,
            color: 'var(--sem-amber-2)',
            sub: `${triggers.filter(t => t.status === 'Monitoring').length} monitoreando`,
          },
          {
            label: 'Total prospectos',
            value: prospects.length,
            color: 'var(--ink)',
            sub: `${activeProspects.length} activos`,
          },
        ].map(kpi => (
          <Card key={kpi.label}>
            <div
              className="text-[28px] font-bold tabular-nums leading-none mb-1"
              style={{ color: kpi.color }}
            >
              {kpi.value}
            </div>
            <div className="text-[12px] font-medium" style={{ color: 'var(--ink)' }}>{kpi.label}</div>
            <div className="text-[11px] mt-[2px]" style={{ color: 'var(--ink-4)' }}>{kpi.sub}</div>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────
export function fmtDate(iso: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function channelEmoji(channel?: string): string {
  return channel ? (CHANNEL_EMOJI[channel] ?? '📋') : '📋';
}

export function outcomeBg(outcome?: string): string {
  if (!outcome) return 'var(--bg-3)';
  if (['Meeting booked', 'Interested', 'Positive'].includes(outcome)) return 'oklch(0.92 0.06 160)';
  if (['Not now'].includes(outcome)) return 'oklch(0.92 0.06 85)';
  if (['Lost'].includes(outcome)) return 'oklch(0.92 0.06 25)';
  return 'var(--bg-3)';
}

export function outcomeFg(outcome?: string): string {
  if (!outcome) return 'var(--ink-4)';
  if (['Meeting booked', 'Interested', 'Positive'].includes(outcome)) return 'oklch(0.35 0.14 160)';
  if (['Not now'].includes(outcome)) return 'oklch(0.40 0.12 85)';
  if (['Lost'].includes(outcome)) return 'oklch(0.40 0.16 25)';
  return 'var(--ink-3)';
}
