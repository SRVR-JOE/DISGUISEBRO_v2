import React, { useMemo, useState } from 'react';
import { useAppContext } from '@/store/AppContext';
import ServerCard from '@/components/ServerCard/ServerCard';
import HealthRing from '@/components/HealthRing/HealthRing';
import VFCPanel from '@/components/VFCPanel/VFCPanel';
import TemperatureBars from '@/components/TemperatureBars/TemperatureBars';
import NotificationFeed from '@/components/NotificationFeed/NotificationFeed';
import type {
  Machine,
  HealthData,
  VFCData,
  ChassisStats,
  D3Notification,
} from '@/types';

// ── Demo / mock data for when no live servers are connected ──────────────

const DEMO_MACHINES: Machine[] = [
  {
    id: 'demo-1',
    hostname: 'd3-director-01',
    type: 'gx 3',
    ipAddress: '10.0.0.10',
    firstSeen: '2026-03-19T08:00:00Z',
    lastSeen: '2026-03-20T12:00:00Z',
    isOnline: true,
    runningDesigner: true,
    runningService: true,
    runningManager: true,
  },
  {
    id: 'demo-2',
    hostname: 'd3-actor-01',
    type: 'gx 2c',
    ipAddress: '10.0.0.11',
    firstSeen: '2026-03-19T08:00:00Z',
    lastSeen: '2026-03-20T12:00:00Z',
    isOnline: true,
    runningDesigner: true,
    runningService: true,
    runningManager: false,
  },
  {
    id: 'demo-3',
    hostname: 'd3-actor-02',
    type: 'gx 2c',
    ipAddress: '10.0.0.12',
    firstSeen: '2026-03-19T08:00:00Z',
    lastSeen: '2026-03-20T12:00:00Z',
    isOnline: true,
    runningDesigner: true,
    runningService: true,
    runningManager: false,
  },
  {
    id: 'demo-4',
    hostname: 'd3-understudy',
    type: 'gx 2c',
    ipAddress: '10.0.0.13',
    firstSeen: '2026-03-19T08:00:00Z',
    lastSeen: '2026-03-20T11:55:00Z',
    isOnline: false,
    runningDesigner: false,
    runningService: false,
    runningManager: false,
  },
];

const DEMO_HEALTH: Record<string, HealthData> = {
  'demo-1': {
    machineId: 'demo-1',
    hostname: 'd3-director-01',
    averageFPS: 59.94,
    videoDroppedFrames: 0,
    videoMissedFrames: 2,
    states: [
      { name: 'Genlock', detail: 'Locked to house sync', category: 'Video', severity: 'good' },
      { name: 'Project', detail: 'WORLD_TOUR_2026', category: 'Session', severity: 'good' },
      { name: 'Role', detail: 'Director', category: 'Session', severity: 'good' },
    ],
  },
  'demo-2': {
    machineId: 'demo-2',
    hostname: 'd3-actor-01',
    averageFPS: 59.87,
    videoDroppedFrames: 3,
    videoMissedFrames: 0,
    states: [
      { name: 'Genlock', detail: 'Locked to house sync', category: 'Video', severity: 'good' },
      { name: 'Project', detail: 'WORLD_TOUR_2026', category: 'Session', severity: 'good' },
      { name: 'Role', detail: 'Actor', category: 'Session', severity: 'good' },
      { name: 'GPU Temp', detail: 'GPU at 72°C', category: 'Hardware', severity: 'warning' },
    ],
  },
  'demo-3': {
    machineId: 'demo-3',
    hostname: 'd3-actor-02',
    averageFPS: 54.21,
    videoDroppedFrames: 47,
    videoMissedFrames: 12,
    states: [
      { name: 'Genlock', detail: 'Unlocked — free-running', category: 'Video', severity: 'critical' },
      { name: 'Project', detail: 'WORLD_TOUR_2026', category: 'Session', severity: 'good' },
      { name: 'Role', detail: 'Actor', category: 'Session', severity: 'good' },
      { name: 'Frame Drop', detail: 'Excessive frame drops detected', category: 'Video', severity: 'critical' },
    ],
  },
  'demo-4': {
    machineId: 'demo-4',
    hostname: 'd3-understudy',
    averageFPS: 0,
    videoDroppedFrames: 0,
    videoMissedFrames: 0,
    states: [
      { name: 'Role', detail: 'Understudy', category: 'Session', severity: 'info' },
    ],
  },
};

const DEMO_VFC: Record<string, VFCData> = {
  'demo-1': {
    hostname: 'd3-director-01',
    backplaneVersion: '2.1.4',
    cards: [
      {
        slot: 1,
        type: 'VFC HDI-SDI',
        firmwareVersion: '3.2.1',
        fpgaVersion: '1.0.5',
        splitMode: 'quad',
        generation: 'Gen2',
        ports: {
          a: { resolution: { width: 1920, height: 1080 }, refreshRate: 59.94, name: 'LED Wall A' },
          b: { resolution: { width: 1920, height: 1080 }, refreshRate: 59.94, name: 'LED Wall B' },
          c: { resolution: { width: 3840, height: 2160 }, refreshRate: 59.94, name: 'Projector 1' },
          d: { resolution: { width: 0, height: 0 }, refreshRate: 0, name: '' },
        },
      },
      {
        slot: 2,
        type: 'VFC DP 1.2',
        firmwareVersion: '3.1.0',
        fpgaVersion: '1.0.3',
        splitMode: 'dual',
        generation: 'Gen2',
        ports: {
          a: { resolution: { width: 1920, height: 1200 }, refreshRate: 60.0, name: 'Monitor FOH' },
          b: { resolution: { width: 1920, height: 1080 }, refreshRate: 59.94, name: 'Preview' },
          c: { resolution: { width: 0, height: 0 }, refreshRate: 0, name: '' },
          d: { resolution: { width: 0, height: 0 }, refreshRate: 0, name: '' },
        },
      },
    ],
  },
};

const DEMO_CHASSIS: Record<string, ChassisStats> = {
  'demo-1': {
    temperatures: [
      { name: 'CPU Package', value: 52.0, unit: 'C' },
      { name: 'GPU Core', value: 64.0, unit: 'C' },
      { name: 'GPU Hotspot', value: 71.5, unit: 'C' },
      { name: 'System Intake', value: 28.0, unit: 'C' },
      { name: 'System Exhaust', value: 38.0, unit: 'C' },
      { name: 'NVMe SSD', value: 45.0, unit: 'C' },
    ],
    fans: [
      { name: 'CPU Fan', rpm: 1200 },
      { name: 'System Fan 1', rpm: 900 },
      { name: 'System Fan 2', rpm: 920 },
    ],
    voltages: [],
    powerDraw: 485,
  },
};

const DEMO_NOTIFICATIONS: D3Notification[] = [
  {
    id: 1,
    machineId: 'demo-3',
    hostname: 'd3-actor-02',
    timestamp: '2026-03-20T11:58:32Z',
    summary: 'Genlock lost — free-running detected',
    detail: 'Genlock sync lost on d3-actor-02. Machine is now free-running.',
    severity: 'critical',
  },
  {
    id: 2,
    machineId: 'demo-3',
    hostname: 'd3-actor-02',
    timestamp: '2026-03-20T11:58:30Z',
    summary: '47 frames dropped in last 60 seconds',
    detail: 'Excessive frame drops detected on d3-actor-02.',
    severity: 'critical',
  },
  {
    id: 3,
    machineId: 'demo-2',
    hostname: 'd3-actor-01',
    timestamp: '2026-03-20T11:55:10Z',
    summary: 'GPU temperature above 70°C threshold',
    detail: 'GPU core temperature is 72°C on d3-actor-01.',
    severity: 'warning',
  },
  {
    id: 4,
    machineId: 'demo-4',
    hostname: 'd3-understudy',
    timestamp: '2026-03-20T11:50:00Z',
    summary: 'Machine went offline — no heartbeat',
    detail: 'd3-understudy has not responded for 5 minutes.',
    severity: 'warning',
  },
  {
    id: 5,
    machineId: 'demo-1',
    hostname: 'd3-director-01',
    timestamp: '2026-03-20T11:45:00Z',
    summary: 'Session started — WORLD_TOUR_2026 loaded',
    detail: 'Project WORLD_TOUR_2026 loaded on director.',
    severity: 'info',
  },
  {
    id: 6,
    machineId: 'demo-1',
    hostname: 'd3-director-01',
    timestamp: '2026-03-20T11:44:55Z',
    summary: 'All actors joined session successfully',
    detail: '2 actors connected to director session.',
    severity: 'info',
  },
  {
    id: 7,
    machineId: 'demo-2',
    hostname: 'd3-actor-01',
    timestamp: '2026-03-20T11:30:00Z',
    summary: 'VFC card firmware updated to 3.1.0',
    detail: 'VFC DP 1.2 in slot 2 firmware updated.',
    severity: 'info',
  },
];

// ── Dashboard Component ──────────────────────────────────────────────────

const Dashboard: React.FC = () => {
  const { state, selectMachine } = useAppContext();
  const [manualIp, setManualIp] = useState('');

  // Determine whether to show demo data
  const isLive = state.machines.length > 0;

  const machines = isLive ? state.machines : DEMO_MACHINES;
  const healthData = isLive ? state.healthData : DEMO_HEALTH;
  const vfcData = isLive ? state.vfcData : DEMO_VFC;
  const chassisStats = isLive ? state.chassisStats : DEMO_CHASSIS;
  const notifications = isLive ? state.notifications : DEMO_NOTIFICATIONS;
  const selectedId = state.selectedMachineId ?? machines[0]?.id ?? null;

  // Selected machine data
  const selectedMachine = useMemo(
    () => machines.find((m) => m.id === selectedId) ?? null,
    [machines, selectedId],
  );
  const selectedHealth = selectedId ? healthData[selectedId] : undefined;
  const selectedVfc = selectedId ? vfcData[selectedId] : undefined;
  const selectedChassis = selectedId ? chassisStats[selectedId] : undefined;

  const genlockState = selectedHealth?.states.find(
    (s) => s.name.toLowerCase().includes('genlock'),
  )?.detail;

  const handleAddManual = async () => {
    const ip = manualIp.trim();
    if (!ip) return;
    try {
      await window.d3watch?.discovery?.addManual(ip);
      setManualIp('');
    } catch (err) {
      console.error('[d3Watch] Failed to add server:', err);
    }
  };

  // ── Empty State ──────────────────────────────────────────────────────
  if (!isLive && machines === DEMO_MACHINES) {
    // We still render with demo data, but show a banner
  }

  return (
    <div className="min-h-screen bg-[#0A0E17] p-4 lg:p-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-mono text-xl font-bold tracking-wider text-[#F1F5F9]">
            d3<span className="text-[#00F0FF]">Watch</span>
          </h1>
          <p className="font-mono text-xs text-[#94A3B8]">
            {machines.length} server{machines.length !== 1 ? 's' : ''} &middot;{' '}
            {machines.filter((m) => m.isOnline).length} online
            {!isLive && (
              <span className="ml-2 rounded bg-[#FFB800]/15 px-1.5 py-0.5 text-[10px] text-[#FFB800]">
                DEMO
              </span>
            )}
          </p>
        </div>

        {/* Manual add */}
        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder="Add server IP..."
            value={manualIp}
            onChange={(e) => setManualIp(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddManual()}
            className="w-40 rounded-lg border border-[#1E293B] bg-[#111827] px-3 py-1.5 font-mono text-xs text-[#F1F5F9] placeholder-[#94A3B8]/40 outline-none transition-colors focus:border-[#00F0FF]/50"
          />
          <button
            onClick={handleAddManual}
            className="rounded-lg border border-[#00F0FF]/30 bg-[#00F0FF]/10 px-3 py-1.5 font-mono text-xs font-bold text-[#00F0FF] transition-colors hover:bg-[#00F0FF]/20"
          >
            ADD
          </button>
        </div>
      </div>

      {/* Main grid layout */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:gap-6">
        {/* ── Left column: Server grid + Temperatures ── */}
        <div className="space-y-4 lg:col-span-8 lg:space-y-6">
          {/* Server Overview Grid */}
          <div>
            <h2 className="mb-3 font-mono text-xs font-bold tracking-wider text-[#94A3B8]">
              SERVER OVERVIEW
            </h2>
            {machines.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[#1E293B] bg-[#111827]/50 py-16">
                <div className="mb-4 h-12 w-12 rounded-full border-2 border-[#94A3B8]/20 flex items-center justify-center">
                  <svg className="h-6 w-6 text-[#94A3B8]/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 14.25h13.5m-13.5 0a3 3 0 01-3-3m3 3a3 3 0 100 6h13.5a3 3 0 100-6m-16.5-3a3 3 0 013-3h13.5a3 3 0 013 3m-19.5 0a4.5 4.5 0 01.9-2.7L5.737 5.1a3.375 3.375 0 012.7-1.35h7.126c1.062 0 2.062.5 2.7 1.35l2.587 3.45a4.5 4.5 0 01.9 2.7m0 0a3 3 0 01-3 3m0 3h.008v.008h-.008v-.008zm0-6h.008v.008h-.008v-.008z" />
                  </svg>
                </div>
                <p className="font-mono text-sm text-[#94A3B8]">No servers detected</p>
                <p className="mt-1 font-mono text-xs text-[#94A3B8]/50">
                  Add a disguise server IP above to get started
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {machines.map((machine) => (
                  <ServerCard
                    key={machine.id}
                    machine={machine}
                    healthData={healthData[machine.id]}
                    isSelected={machine.id === selectedId}
                    onClick={() => selectMachine(machine.id)}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Temperature Heatmap */}
          <TemperatureBars chassisStats={selectedChassis} />
        </div>

        {/* ── Right column: Health Ring + VFC ── */}
        <div className="space-y-4 lg:col-span-4 lg:space-y-6">
          {/* Selected server label */}
          {selectedMachine && (
            <div className="rounded-xl border border-[#1E293B] bg-[#111827] p-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-mono text-xs font-bold tracking-wider text-[#94A3B8]">
                  HEALTH MONITOR
                </h2>
                <span className="font-mono text-[10px] text-[#00F0FF]">
                  {selectedMachine.hostname}
                </span>
              </div>
              <div className="flex justify-center">
                <HealthRing
                  fps={selectedHealth?.averageFPS ?? 0}
                  targetFps={59.94}
                  genlockState={genlockState}
                  droppedFrames={selectedHealth?.videoDroppedFrames ?? 0}
                  missedFrames={selectedHealth?.videoMissedFrames ?? 0}
                />
              </div>
            </div>
          )}

          {/* VFC Panel */}
          <VFCPanel vfcData={selectedVfc} />

          {/* Quick stats */}
          {selectedChassis && (
            <div className="rounded-xl border border-[#1E293B] bg-[#111827] p-4">
              <h3 className="mb-3 font-mono text-xs font-bold tracking-wider text-[#94A3B8]">
                FAN STATUS
              </h3>
              <div className="grid grid-cols-2 gap-2">
                {selectedChassis.fans.map((fan, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between rounded-lg bg-[#0A0E17] px-3 py-2"
                  >
                    <span className="font-mono text-[10px] text-[#94A3B8] truncate mr-2">
                      {fan.name}
                    </span>
                    <span className="font-mono text-xs font-bold tabular-nums text-[#00F0FF]">
                      {fan.rpm}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── Bottom: Notification Feed (full width) ── */}
        <div className="lg:col-span-12">
          <NotificationFeed notifications={notifications} />
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
