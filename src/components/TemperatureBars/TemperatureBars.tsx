import React from 'react';
import type { ChassisStats } from '@/types';

interface TemperatureBarsProps {
  chassisStats?: ChassisStats;
}

const MAX_TEMP = 100;
const THRESHOLDS = { green: 60, amber: 75 };

function tempColor(value: number): string {
  if (value < THRESHOLDS.green) return '#00FF88';
  if (value < THRESHOLDS.amber) return '#FFB800';
  return '#FF3B3B';
}

function gradientId(index: number): string {
  return `temp-grad-${index}`;
}

const TemperatureBars: React.FC<TemperatureBarsProps> = ({ chassisStats }) => {
  const temps = chassisStats?.temperatures ?? [];

  if (temps.length === 0) {
    return (
      <div className="rounded-xl border border-[#1E293B] bg-[#111827] p-4">
        <h3 className="font-mono text-xs font-bold tracking-wider text-[#94A3B8]">
          THERMAL STATUS
        </h3>
        <p className="mt-4 text-center font-mono text-xs text-[#94A3B8]/60">
          No temperature data available
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-[#1E293B] bg-[#111827] p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-mono text-xs font-bold tracking-wider text-[#94A3B8]">
          THERMAL STATUS
        </h3>
        {/* Threshold legend */}
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1">
            <span className="inline-block h-1.5 w-3 rounded-sm bg-[#00FF88]" />
            <span className="font-mono text-[8px] text-[#94A3B8]">&lt;60°C</span>
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-1.5 w-3 rounded-sm bg-[#FFB800]" />
            <span className="font-mono text-[8px] text-[#94A3B8]">60-75°C</span>
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-1.5 w-3 rounded-sm bg-[#FF3B3B]" />
            <span className="font-mono text-[8px] text-[#94A3B8]">&gt;75°C</span>
          </span>
        </div>
      </div>

      <div className="space-y-2.5">
        {temps.map((sensor, idx) => {
          const pct = Math.min((sensor.value / MAX_TEMP) * 100, 100);
          const color = tempColor(sensor.value);

          return (
            <div key={idx} className="group">
              {/* Label row */}
              <div className="flex items-center justify-between mb-1">
                <span className="font-mono text-[11px] text-[#94A3B8] truncate max-w-[60%]">
                  {sensor.name}
                </span>
                <span
                  className="font-mono text-xs font-bold tabular-nums"
                  style={{ color }}
                >
                  {sensor.value.toFixed(1)}°{sensor.unit || 'C'}
                </span>
              </div>

              {/* Bar */}
              <div className="relative h-3 w-full overflow-hidden rounded-full bg-[#0A0E17]">
                <svg className="absolute inset-0 h-full w-full" preserveAspectRatio="none">
                  <defs>
                    <linearGradient id={gradientId(idx)} x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#00F0FF" stopOpacity="0.8" />
                      <stop offset="50%" stopColor="#00FF88" stopOpacity="0.9" />
                      <stop offset="75%" stopColor="#FFB800" stopOpacity="0.9" />
                      <stop offset="100%" stopColor="#FF3B3B" stopOpacity="1" />
                    </linearGradient>
                  </defs>
                  <rect
                    x="0"
                    y="0"
                    width={`${pct}%`}
                    height="100%"
                    fill={`url(#${gradientId(idx)})`}
                    rx="6"
                    className="transition-all duration-700 ease-out"
                  />
                </svg>

                {/* Current temp marker */}
                <div
                  className="absolute top-0 h-full w-0.5 bg-white/80 transition-all duration-700 ease-out"
                  style={{ left: `${pct}%` }}
                >
                  <div
                    className="absolute -top-0.5 left-1/2 h-4 w-1 -translate-x-1/2 rounded-full"
                    style={{
                      backgroundColor: color,
                      boxShadow: `0 0 6px ${color}80`,
                    }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Power draw */}
      {chassisStats?.powerDraw != null && (
        <div className="mt-3 flex items-center justify-between border-t border-[#1E293B] pt-2">
          <span className="font-mono text-[10px] text-[#94A3B8]">POWER DRAW</span>
          <span className="font-mono text-xs font-bold tabular-nums text-[#00F0FF]">
            {chassisStats.powerDraw.toFixed(0)} W
          </span>
        </div>
      )}
    </div>
  );
};

export default TemperatureBars;
