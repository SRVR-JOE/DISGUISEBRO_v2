import React, { useMemo, useState } from 'react';
import { useAppContext } from '@/store/AppContext';
import ServerCard from '@/components/ServerCard/ServerCard';
import HealthRing from '@/components/HealthRing/HealthRing';
import VFCPanel from '@/components/VFCPanel/VFCPanel';
import TemperatureBars from '@/components/TemperatureBars/TemperatureBars';
import NotificationFeed from '@/components/NotificationFeed/NotificationFeed';

const Dashboard: React.FC = () => {
  const { state, selectMachine } = useAppContext();
  const [manualIp, setManualIp] = useState('');

  const machines = state.machines;
  const healthData = state.healthData;
  const vfcData = state.vfcData;
  const chassisStats = state.chassisStats;
  const notifications = state.notifications;
  const selectedId = state.selectedMachineId ?? machines[0]?.id ?? null;

  const selectedMachine = useMemo(
    () => machines.find((m) => m.id === selectedId) ?? null,
    [machines, selectedId],
  );
  const selectedHealth = selectedId ? healthData[selectedId] : undefined;
  const selectedVfc = selectedId ? vfcData[selectedId] : undefined;
  const selectedChassis = selectedId ? chassisStats[selectedId] : undefined;

  const genlockState = selectedHealth?.states?.find(
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
          </p>
        </div>

        {/* Manual add */}
        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder="Server IP address..."
            value={manualIp}
            onChange={(e) => setManualIp(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddManual()}
            className="w-44 rounded-lg border border-[#1E293B] bg-[#111827] px-3 py-1.5 font-mono text-xs text-[#F1F5F9] placeholder-[#94A3B8]/40 outline-none transition-colors focus:border-[#00F0FF]/50"
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
        {/* Left column: Server grid + Temperatures */}
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
                <p className="font-mono text-sm text-[#F1F5F9]">No servers detected</p>
                <p className="mt-1 font-mono text-xs text-[#94A3B8]">
                  Enter a disguise server IP address above to connect
                </p>
                <p className="mt-3 font-mono text-[10px] text-[#94A3B8]/50">
                  Servers running d3service will also be discovered automatically via DNS-SD
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
          {selectedChassis ? (
            <TemperatureBars chassisStats={selectedChassis} />
          ) : selectedMachine ? (
            <div className="rounded-xl border border-dashed border-[#1E293B] bg-[#111827]/50 p-6 text-center">
              <p className="font-mono text-xs text-[#94A3B8]">No thermal data — SMC not connected for {selectedMachine.hostname}</p>
              <p className="font-mono text-[10px] text-[#94A3B8]/50 mt-1">Configure SMC IP in Fleet Management to enable hardware telemetry</p>
            </div>
          ) : null}
        </div>

        {/* Right column: Health Ring + VFC */}
        <div className="space-y-4 lg:col-span-4 lg:space-y-6">
          {selectedMachine ? (
            <>
              <div className="rounded-xl border border-[#1E293B] bg-[#111827] p-4">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-mono text-xs font-bold tracking-wider text-[#94A3B8]">
                    HEALTH MONITOR
                  </h2>
                  <span className="font-mono text-[10px] text-[#00F0FF]">
                    {selectedMachine.hostname}
                  </span>
                </div>
                {selectedHealth ? (
                  <div className="flex justify-center">
                    <HealthRing
                      fps={selectedHealth.averageFPS}
                      targetFps={59.94}
                      genlockState={genlockState}
                      droppedFrames={selectedHealth.videoDroppedFrames}
                      missedFrames={selectedHealth.videoMissedFrames}
                    />
                  </div>
                ) : (
                  <div className="flex flex-col items-center py-8 text-center">
                    <p className="font-mono text-xs text-[#94A3B8]">No health data available</p>
                    <p className="font-mono text-[10px] text-[#94A3B8]/50 mt-1">Designer session may not be running</p>
                  </div>
                )}
              </div>

              {/* VFC Panel */}
              {selectedVfc ? (
                <VFCPanel vfcData={selectedVfc} />
              ) : (
                <div className="rounded-xl border border-dashed border-[#1E293B] bg-[#111827]/50 p-4 text-center">
                  <h3 className="mb-2 font-mono text-xs font-bold tracking-wider text-[#94A3B8]">VFC CARDS</h3>
                  <p className="font-mono text-xs text-[#94A3B8]">No VFC data from {selectedMachine.hostname}</p>
                </div>
              )}

              {/* Fan status */}
              {selectedChassis && selectedChassis.fans.length > 0 && (
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
                        <span className={`font-mono text-xs font-bold tabular-nums ${fan.rpm > 0 ? 'text-[#00F0FF]' : 'text-[#FF3B3B]'}`}>
                          {fan.rpm > 0 ? fan.rpm : 'STOPPED'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="rounded-xl border border-dashed border-[#1E293B] bg-[#111827]/50 p-8 text-center">
              <p className="font-mono text-xs text-[#94A3B8]">Select a server to view health data</p>
            </div>
          )}
        </div>

        {/* Bottom: Notification Feed (full width) */}
        <div className="lg:col-span-12">
          <NotificationFeed notifications={notifications} />
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
