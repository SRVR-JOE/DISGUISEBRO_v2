import React, { useMemo } from 'react';

interface HealthRingProps {
  fps: number;
  targetFps?: number;
  genlockState?: string;
  droppedFrames?: number;
  missedFrames?: number;
}

function fpsColor(fps: number, target: number): string {
  const ratio = fps / target;
  if (ratio > 0.983) return '#00F0FF'; // > ~59 for 60fps
  if (ratio > 0.917) return '#FFB800'; // > ~55
  return '#FF3B3B';
}

const SIZE = 200;
const STROKE = 10;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

const HealthRing: React.FC<HealthRingProps> = ({
  fps,
  targetFps = 59.94,
  genlockState,
  droppedFrames = 0,
  missedFrames = 0,
}) => {
  const color = useMemo(() => fpsColor(fps, targetFps), [fps, targetFps]);
  const ratio = Math.min(fps / targetFps, 1);
  const dashOffset = CIRCUMFERENCE * (1 - ratio);
  const isLocked = genlockState?.toLowerCase().includes('locked') ?? false;

  return (
    <div className="flex flex-col items-center gap-3">
      {/* SVG Gauge */}
      <div className="relative" style={{ width: SIZE, height: SIZE }}>
        <svg
          width={SIZE}
          height={SIZE}
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          className="drop-shadow-lg"
        >
          {/* Background track */}
          <circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            fill="none"
            stroke="#1E293B"
            strokeWidth={STROKE}
          />
          {/* Filled arc */}
          <circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            fill="none"
            stroke={color}
            strokeWidth={STROKE}
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={dashOffset}
            transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
            className="transition-all duration-500 ease-out"
            style={{
              filter: `drop-shadow(0 0 6px ${color}80)`,
            }}
          />
          {/* Subtle glow ring */}
          <circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            fill="none"
            stroke={color}
            strokeWidth={1}
            opacity={0.15}
            className="animate-pulse"
          />
        </svg>

        {/* Center content */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span
            className="font-mono text-3xl font-bold tabular-nums leading-none"
            style={{ color }}
          >
            {fps.toFixed(2)}
          </span>
          <span className="mt-0.5 font-mono text-[10px] text-[#94A3B8]">FPS</span>

          {/* Genlock badge */}
          <span
            className={`mt-2 rounded-full px-2.5 py-0.5 font-mono text-[10px] font-bold tracking-wider ${
              isLocked
                ? 'bg-[#00FF88]/15 text-[#00FF88] border border-[#00FF88]/30'
                : 'bg-[#FF3B3B]/15 text-[#FF3B3B] border border-[#FF3B3B]/30'
            }`}
          >
            {isLocked ? 'LOCKED' : 'UNLOCKED'}
          </span>
        </div>
      </div>

      {/* Frame counters */}
      <div className="flex items-center gap-4">
        <div className="flex flex-col items-center">
          <span className="font-mono text-lg font-bold tabular-nums text-[#FFB800]">
            {droppedFrames}
          </span>
          <span className="font-mono text-[10px] text-[#94A3B8]">DROPPED</span>
        </div>
        <div className="h-6 w-px bg-[#1E293B]" />
        <div className="flex flex-col items-center">
          <span className="font-mono text-lg font-bold tabular-nums text-[#FF3B3B]">
            {missedFrames}
          </span>
          <span className="font-mono text-[10px] text-[#94A3B8]">MISSED</span>
        </div>
      </div>
    </div>
  );
};

export default HealthRing;
