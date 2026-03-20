import React, { useState } from 'react';
import type { VFCData, VFCPort } from '@/types';

interface VFCPanelProps {
  vfcData?: VFCData;
}

const portKeys = ['a', 'b', 'c', 'd'] as const;

function portStatusColor(port: VFCPort): string {
  if (port.resolution.width === 0 && port.resolution.height === 0) return 'bg-[#94A3B8]/30';
  if (port.refreshRate > 0) return 'bg-[#00FF88]';
  return 'bg-[#FFB800]';
}

const VFCPanel: React.FC<VFCPanelProps> = ({ vfcData }) => {
  const [hoveredPort, setHoveredPort] = useState<{ slot: number; port: string } | null>(null);

  if (!vfcData || vfcData.cards.length === 0) {
    return (
      <div className="rounded-xl border border-[#1E293B] bg-[#111827] p-4">
        <h3 className="font-mono text-xs font-bold tracking-wider text-[#94A3B8]">VFC PANEL</h3>
        <p className="mt-4 text-center font-mono text-xs text-[#94A3B8]/60">No VFC data available</p>
      </div>
    );
  }

  // Pad to 4 slots
  const slots = Array.from({ length: 4 }, (_, i) => {
    return vfcData.cards.find((c) => c.slot === i + 1) ?? null;
  });

  return (
    <div className="rounded-xl border border-[#1E293B] bg-[#111827] p-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="font-mono text-xs font-bold tracking-wider text-[#94A3B8]">VFC PANEL</h3>
        <span className="font-mono text-[10px] text-[#94A3B8]/60">
          BP {vfcData.backplaneVersion}
        </span>
      </div>

      {/* Rear panel schematic */}
      <div className="mt-3 rounded-lg border border-[#1E293B]/60 bg-[#0A0E17] p-3">
        <div className="grid grid-cols-4 gap-2">
          {slots.map((card, slotIdx) => (
            <div
              key={slotIdx}
              className={`relative rounded-lg border p-2 transition-colors ${
                card
                  ? 'border-[#00F0FF]/20 bg-[#111827]/80'
                  : 'border-[#1E293B]/40 bg-[#0A0E17]'
              }`}
            >
              {/* Slot number */}
              <span className="block text-center font-mono text-[10px] font-bold text-[#94A3B8]">
                SLOT {slotIdx + 1}
              </span>

              {card ? (
                <>
                  {/* Card type */}
                  <p className="mt-1 truncate text-center font-mono text-[9px] text-[#00F0FF]">
                    {card.type}
                  </p>
                  {/* Firmware */}
                  <p className="truncate text-center font-mono text-[8px] text-[#94A3B8]/60">
                    FW {card.firmwareVersion}
                  </p>

                  {/* Port indicators */}
                  <div className="mt-2 flex justify-center gap-1.5">
                    {portKeys.map((pk) => {
                      const port = card.ports[pk];
                      const isHovered =
                        hoveredPort?.slot === card.slot && hoveredPort?.port === pk;
                      return (
                        <div
                          key={pk}
                          className="relative"
                          onMouseEnter={() => setHoveredPort({ slot: card.slot, port: pk })}
                          onMouseLeave={() => setHoveredPort(null)}
                        >
                          <div
                            className={`h-3 w-3 rounded-full border border-[#1E293B] ${portStatusColor(port)} cursor-pointer transition-transform ${
                              isHovered ? 'scale-125' : ''
                            }`}
                          />
                          <span className="block text-center font-mono text-[7px] text-[#94A3B8]/50 mt-0.5">
                            {pk.toUpperCase()}
                          </span>

                          {/* Hover tooltip */}
                          {isHovered && port.resolution.width > 0 && (
                            <div className="absolute bottom-full left-1/2 z-20 mb-2 -translate-x-1/2 whitespace-nowrap rounded bg-[#1E293B] px-2 py-1 shadow-lg">
                              <p className="font-mono text-[9px] text-[#F1F5F9]">
                                {port.resolution.width}x{port.resolution.height}
                              </p>
                              <p className="font-mono text-[8px] text-[#00F0FF]">
                                {port.refreshRate.toFixed(2)} Hz
                              </p>
                              {port.name && (
                                <p className="font-mono text-[8px] text-[#94A3B8]">{port.name}</p>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </>
              ) : (
                <div className="mt-3 flex h-10 items-center justify-center">
                  <span className="font-mono text-[9px] text-[#94A3B8]/30">EMPTY</span>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Split mode legend */}
      <div className="mt-2 flex items-center gap-3">
        <div className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-full bg-[#00FF88]" />
          <span className="font-mono text-[9px] text-[#94A3B8]">Active</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-full bg-[#FFB800]" />
          <span className="font-mono text-[9px] text-[#94A3B8]">No Signal</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-full bg-[#94A3B8]/30" />
          <span className="font-mono text-[9px] text-[#94A3B8]">Unused</span>
        </div>
      </div>
    </div>
  );
};

export default VFCPanel;
