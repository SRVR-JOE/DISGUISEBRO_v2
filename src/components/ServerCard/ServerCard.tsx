import React from 'react';
import { useNavigate } from 'react-router-dom';
import type { Machine, HealthData } from '@/types';

interface ServerCardProps {
  machine: Machine;
  healthData?: HealthData;
  isSelected?: boolean;
  onClick?: () => void;
}

function severityColor(severity?: string): { dot: string; border: string; glow: string } {
  switch (severity) {
    case 'critical':
      return {
        dot: 'bg-[#FF3B3B]',
        border: 'border-[#FF3B3B]/60',
        glow: 'shadow-[0_0_12px_rgba(255,59,59,0.35)]',
      };
    case 'warning':
      return {
        dot: 'bg-[#FFB800]',
        border: 'border-[#FFB800]/60',
        glow: 'shadow-[0_0_12px_rgba(255,184,0,0.3)]',
      };
    default:
      return {
        dot: 'bg-[#00FF88]',
        border: 'border-[#00FF88]/40',
        glow: 'shadow-[0_0_12px_rgba(0,255,136,0.2)]',
      };
  }
}

function worstSeverity(healthData?: HealthData): string {
  if (!healthData) return 'good';
  const order = ['critical', 'warning', 'info', 'good'];
  let worst = 3;
  for (const s of healthData.states) {
    const idx = order.indexOf(s.severity);
    if (idx < worst) worst = idx;
  }
  return order[worst];
}

function roleBadge(machine: Machine, healthData?: HealthData): string | null {
  // Infer role from running processes or states
  if (machine.runningManager) return 'DIRECTOR';
  if (machine.runningDesigner) return 'ACTOR';
  // Check states for role info
  if (healthData?.states) {
    for (const s of healthData.states) {
      const lower = s.detail.toLowerCase();
      if (lower.includes('director')) return 'DIRECTOR';
      if (lower.includes('understudy')) return 'UNDERSTUDY';
      if (lower.includes('actor')) return 'ACTOR';
    }
  }
  return null;
}

const roleColors: Record<string, string> = {
  DIRECTOR: 'bg-[#00F0FF]/20 text-[#00F0FF] border-[#00F0FF]/40',
  ACTOR: 'bg-[#00FF88]/20 text-[#00FF88] border-[#00FF88]/40',
  UNDERSTUDY: 'bg-[#FFB800]/20 text-[#FFB800] border-[#FFB800]/40',
};

const ServerCard: React.FC<ServerCardProps> = ({ machine, healthData, isSelected, onClick }) => {
  const navigate = useNavigate();
  const severity = worstSeverity(healthData);
  const colors = severityColor(severity);
  const role = roleBadge(machine, healthData);
  const fps = healthData?.averageFPS;
  const isOffline = !machine.isOnline;

  const genlockState = healthData?.states.find(
    (s) => s.name.toLowerCase().includes('genlock') || s.category.toLowerCase().includes('genlock'),
  );
  const isLocked = genlockState?.detail?.toLowerCase().includes('locked') ?? false;

  const projectState = healthData?.states.find(
    (s) =>
      s.name.toLowerCase().includes('project') || s.category.toLowerCase().includes('project'),
  );

  const handleClick = () => {
    onClick?.();
    navigate(`/server/${machine.id}`);
  };

  return (
    <button
      onClick={handleClick}
      className={`
        group relative w-full text-left rounded-xl border p-4
        bg-[#111827] transition-all duration-200 cursor-pointer
        hover:bg-[#1E293B] hover:scale-[1.02]
        ${isSelected ? `${colors.border} ${colors.glow} ring-1 ring-[#00F0FF]/30` : 'border-[#1E293B] hover:border-[#00F0FF]/30'}
      `}
    >
      {/* Offline overlay */}
      {isOffline && (
        <div className="absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-[#0A0E17]/80 backdrop-blur-sm">
          <span className="font-mono text-sm font-bold tracking-widest text-[#FF3B3B]/80">
            OFFLINE
          </span>
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {/* Status dot */}
          <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${colors.dot} animate-pulse`} />
          <h3 className="truncate font-mono text-sm font-semibold text-[#F1F5F9]">
            {machine.hostname}
          </h3>
        </div>
        {role && (
          <span
            className={`shrink-0 rounded border px-1.5 py-0.5 font-mono text-[10px] font-bold tracking-wider ${roleColors[role] ?? ''}`}
          >
            {role}
          </span>
        )}
      </div>

      {/* Machine type */}
      <p className="mt-1 font-mono text-[11px] text-[#94A3B8]">
        {machine.type || 'Unknown'} &middot; {machine.ipAddress}
      </p>

      {/* Metrics row */}
      <div className="mt-3 flex items-end justify-between gap-3">
        {/* FPS */}
        <div className="flex items-baseline gap-1">
          <span className="font-mono text-xl font-bold tabular-nums text-[#F1F5F9]">
            {fps != null ? fps.toFixed(1) : '--'}
          </span>
          <span className="font-mono text-[10px] text-[#94A3B8]">FPS</span>
        </div>

        <div className="flex items-center gap-2">
          {/* Genlock */}
          <span
            className={`flex items-center gap-1 rounded px-1.5 py-0.5 font-mono text-[10px] ${
              isLocked
                ? 'bg-[#00FF88]/10 text-[#00FF88]'
                : 'bg-[#FF3B3B]/10 text-[#FF3B3B]'
            }`}
          >
            <span className={`inline-block h-1.5 w-1.5 rounded-full ${isLocked ? 'bg-[#00FF88]' : 'bg-[#FF3B3B]'}`} />
            {isLocked ? 'LOCK' : 'UNLK'}
          </span>
        </div>
      </div>

      {/* Project name */}
      {projectState && (
        <p className="mt-2 truncate font-mono text-[10px] text-[#94A3B8]">
          {projectState.detail}
        </p>
      )}

      {/* Hover tooltip hint */}
      <div className="pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 rounded bg-[#1E293B] px-2 py-1 font-mono text-[10px] text-[#94A3B8] opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
        Click to view details
      </div>
    </button>
  );
};

export default ServerCard;
