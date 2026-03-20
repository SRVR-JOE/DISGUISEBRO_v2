import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAppContext } from '@/store/AppContext';
import HealthRing from '@/components/HealthRing/HealthRing';
import VFCPanel from '@/components/VFCPanel/VFCPanel';
import TemperatureBars from '@/components/TemperatureBars/TemperatureBars';
import NotificationFeed from '@/components/NotificationFeed/NotificationFeed';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import type { NetworkAdapter, HealthSnapshot, TemperatureReading, GPUOutput } from '@/types';

const tabs = ['Overview', 'Hardware', 'Performance', 'Network', 'Issues'] as const;
type Tab = typeof tabs[number];

export function ServerDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { state } = useAppContext();
  const [activeTab, setActiveTab] = useState<Tab>('Overview');
  const [networkAdapters, setNetworkAdapters] = useState<NetworkAdapter[]>([]);
  const [gpuOutputs, setGpuOutputs] = useState<GPUOutput[]>([]);
  const [osInfo, setOsInfo] = useState<{ windowsVersion: string; imageVersion: string } | null>(null);
  const [fpsHistory, setFpsHistory] = useState<{ time: string; fps: number }[]>([]);
  const [droppedHistory, setDroppedHistory] = useState<{ time: string; dropped: number; missed: number }[]>([]);
  const [tempHistory, setTempHistory] = useState<Record<string, unknown>[]>([]);

  const machine = state.machines.find(m => m.id === id);
  const health = machine ? state.healthData[machine.id] : undefined;
  const chassis = machine ? state.chassisStats[machine.id] : undefined;
  const vfc = machine ? state.vfcData[machine.id] : undefined;

  const genlockState = health?.states?.find(
    (s) => s.name.toLowerCase().includes('genlock'),
  )?.detail;

  // Fetch real data on mount
  const loadData = useCallback(async () => {
    if (!machine) return;
    try {
      // Network adapters from Designer API
      const nics = await window.d3watch?.api?.getNetworkAdapters(machine.ipAddress);
      if (nics && Array.isArray(nics)) setNetworkAdapters(nics);

      // GPU outputs
      const gpu = await window.d3watch?.api?.getGPUOutputs(machine.ipAddress);
      if (gpu && Array.isArray(gpu)) setGpuOutputs(gpu);

      // OS info
      const os = await window.d3watch?.api?.getOSInfo(machine.ipAddress);
      if (os) setOsInfo(os);

      // Historical data from DB
      const healthSnaps = await window.d3watch?.db?.getHealthSnapshots(machine.id, 60);
      if (healthSnaps && healthSnaps.length > 0) {
        setFpsHistory(healthSnaps.map((s: HealthSnapshot) => ({
          time: new Date(s.timestamp).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' }),
          fps: s.fps,
        })).reverse());
        setDroppedHistory(healthSnaps.map((s: HealthSnapshot) => ({
          time: new Date(s.timestamp).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' }),
          dropped: s.droppedFrames,
          missed: s.missedFrames,
        })).reverse());
      }

      const tempSnaps = await window.d3watch?.db?.getTemperatureReadings(machine.id, 200);
      if (tempSnaps && tempSnaps.length > 0) {
        // Group by timestamp, pivot sensor names into columns
        const grouped: Record<string, Record<string, unknown>> = {};
        for (const t of tempSnaps as TemperatureReading[]) {
          const key = new Date(t.timestamp).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' });
          if (!grouped[key]) grouped[key] = { time: key };
          grouped[key][t.sensorName] = t.valueCelsius;
        }
        setTempHistory(Object.values(grouped).reverse());
      }
    } catch (err) {
      console.error('[d3Watch] Failed to load server data:', err);
    }
  }, [machine]);

  useEffect(() => { loadData(); }, [loadData]);

  if (!machine) {
    return (
      <div className="p-6 flex flex-col items-center justify-center min-h-[60vh]">
        <p className="text-[#94A3B8] font-mono text-sm">Server not found</p>
        <button onClick={() => navigate('/')} className="mt-4 text-[#00F0FF] font-mono text-sm hover:underline">
          Back to Dashboard
        </button>
      </div>
    );
  }

  // Get unique sensor names from temp history for chart lines
  const tempSensors = tempHistory.length > 0
    ? Object.keys(tempHistory[0]).filter(k => k !== 'time')
    : [];
  const sensorColors = ['#FF3B3B', '#FFB800', '#E91E8C', '#00FF88', '#00F0FF', '#94A3B8'];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={() => navigate('/')} className="text-[#94A3B8] hover:text-[#00F0FF] transition-colors">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div>
          <h1 className="text-2xl font-heading font-bold text-[#F1F5F9]">{machine.hostname}</h1>
          <span className="text-sm text-[#94A3B8]">{machine.type} &middot; {machine.ipAddress}</span>
        </div>
        <div className={`ml-auto px-3 py-1 rounded-full text-xs font-mono ${machine.isOnline ? 'bg-[#00FF88]/20 text-[#00FF88]' : 'bg-[#FF3B3B]/20 text-[#FF3B3B]'}`}>
          {machine.isOnline ? 'ONLINE' : 'OFFLINE'}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-[#1E293B]">
        {tabs.map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-mono transition-colors relative ${activeTab === tab ? 'text-[#00F0FF]' : 'text-[#94A3B8] hover:text-[#F1F5F9]'}`}>
            {tab}
            {activeTab === tab && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#00F0FF]" />}
          </button>
        ))}
      </div>

      {/* Overview */}
      {activeTab === 'Overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 flex flex-col items-center">
            {health ? (
              <HealthRing fps={health.averageFPS} genlockState={genlockState} droppedFrames={health.videoDroppedFrames} missedFrames={health.videoMissedFrames} />
            ) : (
              <div className="rounded-xl border border-dashed border-[#1E293B] bg-[#111827]/50 p-8 text-center w-full">
                <p className="font-mono text-xs text-[#94A3B8]">No health data — Designer session may not be running</p>
              </div>
            )}
          </div>
          <div className="lg:col-span-1">
            {vfc ? <VFCPanel vfcData={vfc} /> : (
              <div className="rounded-xl border border-dashed border-[#1E293B] bg-[#111827]/50 p-8 text-center">
                <p className="font-mono text-xs text-[#94A3B8]">No VFC data available</p>
              </div>
            )}
          </div>
          <div className="lg:col-span-1">
            {chassis ? <TemperatureBars chassisStats={chassis} /> : (
              <div className="rounded-xl border border-dashed border-[#1E293B] bg-[#111827]/50 p-8 text-center">
                <p className="font-mono text-xs text-[#94A3B8]">No thermal data — connect SMC</p>
              </div>
            )}
          </div>
          <div className="lg:col-span-3">
            <NotificationFeed notifications={state.notifications} machineFilter={machine.id} />
          </div>
        </div>
      )}

      {/* Hardware */}
      {activeTab === 'Hardware' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-[#111827] rounded-lg p-5 border border-[#1E293B]">
            <h3 className="text-sm font-mono text-[#00F0FF] mb-4 uppercase tracking-wider">Machine Identity</h3>
            <div className="space-y-3 text-sm">
              {[
                ['Hostname', machine.hostname],
                ['Type', machine.type || '—'],
                ['IP Address', machine.ipAddress],
                ['Version', machine.version || '—'],
                ['SMC IP', machine.smcIp || '—'],
                ['First Seen', machine.firstSeen ? new Date(machine.firstSeen).toLocaleString() : '—'],
                ['Last Seen', machine.lastSeen ? new Date(machine.lastSeen).toLocaleString() : '—'],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between">
                  <span className="text-[#94A3B8]">{label}</span>
                  <span className="text-[#F1F5F9] font-mono text-xs">{value}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="bg-[#111827] rounded-lg p-5 border border-[#1E293B]">
            <h3 className="text-sm font-mono text-[#00F0FF] mb-4 uppercase tracking-wider">GPU Outputs</h3>
            {gpuOutputs.length > 0 ? (
              <div className="space-y-3 text-sm">
                {gpuOutputs.map((gpu, i) => (
                  <div key={i} className="flex justify-between items-center">
                    <span className="text-[#94A3B8]">Port {gpu.port}</span>
                    <div className="text-right">
                      <span className="text-[#F1F5F9] font-mono text-xs">{gpu.resolution.width}x{gpu.resolution.height} @ {gpu.refreshRate}Hz</span>
                      <span className={`ml-2 text-xs font-mono ${gpu.genlockState === 'Locked' ? 'text-[#00FF88]' : 'text-[#FF3B3B]'}`}>
                        {gpu.genlockState}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-[#94A3B8] font-mono">No GPU output data received</p>
            )}
          </div>
          <div className="bg-[#111827] rounded-lg p-5 border border-[#1E293B]">
            <h3 className="text-sm font-mono text-[#00F0FF] mb-4 uppercase tracking-wider">OS Information</h3>
            {osInfo ? (
              <div className="space-y-3 text-sm">
                <div className="flex justify-between"><span className="text-[#94A3B8]">Windows</span><span className="text-[#F1F5F9] font-mono text-xs">{osInfo.windowsVersion}</span></div>
                <div className="flex justify-between"><span className="text-[#94A3B8]">Image</span><span className="text-[#F1F5F9] font-mono text-xs">{osInfo.imageVersion}</span></div>
              </div>
            ) : (
              <p className="text-xs text-[#94A3B8] font-mono">No OS info available</p>
            )}
          </div>
          <div className="bg-[#111827] rounded-lg p-5 border border-[#1E293B]">
            <h3 className="text-sm font-mono text-[#00F0FF] mb-4 uppercase tracking-wider">Fans</h3>
            {chassis && chassis.fans.length > 0 ? (
              <div className="space-y-3 text-sm">
                {chassis.fans.map((fan) => (
                  <div key={fan.name} className="flex justify-between">
                    <span className="text-[#94A3B8]">{fan.name}</span>
                    <span className={`font-mono ${fan.rpm > 0 ? 'text-[#00FF88]' : 'text-[#FF3B3B]'}`}>
                      {fan.rpm > 0 ? `${fan.rpm} RPM` : 'STOPPED'}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-[#94A3B8] font-mono">No fan data — SMC not connected</p>
            )}
          </div>
        </div>
      )}

      {/* Performance */}
      {activeTab === 'Performance' && (
        <div className="space-y-6">
          <div className="bg-[#111827] rounded-lg p-5 border border-[#1E293B]">
            <h3 className="text-sm font-mono text-[#00F0FF] mb-4 uppercase tracking-wider">FPS Timeline</h3>
            {fpsHistory.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={fpsHistory}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" />
                  <XAxis dataKey="time" stroke="#94A3B8" fontSize={11} />
                  <YAxis domain={['auto', 'auto']} stroke="#94A3B8" fontSize={11} />
                  <Tooltip contentStyle={{ backgroundColor: '#111827', border: '1px solid #1E293B', color: '#F1F5F9' }} />
                  <Line type="monotone" dataKey="fps" stroke="#00F0FF" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-center text-xs text-[#94A3B8] font-mono py-12">No FPS history recorded yet — data will appear after polling begins</p>
            )}
          </div>
          <div className="bg-[#111827] rounded-lg p-5 border border-[#1E293B]">
            <h3 className="text-sm font-mono text-[#00F0FF] mb-4 uppercase tracking-wider">Dropped / Missed Frames</h3>
            {droppedHistory.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={droppedHistory}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" />
                  <XAxis dataKey="time" stroke="#94A3B8" fontSize={11} />
                  <YAxis stroke="#94A3B8" fontSize={11} />
                  <Tooltip contentStyle={{ backgroundColor: '#111827', border: '1px solid #1E293B', color: '#F1F5F9' }} />
                  <Bar dataKey="dropped" fill="#FF3B3B" radius={[2, 2, 0, 0]} />
                  <Bar dataKey="missed" fill="#FFB800" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-center text-xs text-[#94A3B8] font-mono py-12">No frame drop history recorded yet</p>
            )}
          </div>
          <div className="bg-[#111827] rounded-lg p-5 border border-[#1E293B]">
            <h3 className="text-sm font-mono text-[#00F0FF] mb-4 uppercase tracking-wider">Temperature Trends</h3>
            {tempHistory.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={tempHistory}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" />
                  <XAxis dataKey="time" stroke="#94A3B8" fontSize={11} />
                  <YAxis domain={['auto', 'auto']} stroke="#94A3B8" fontSize={11} />
                  <Tooltip contentStyle={{ backgroundColor: '#111827', border: '1px solid #1E293B', color: '#F1F5F9' }} />
                  {tempSensors.map((sensor, i) => (
                    <Line key={sensor} type="monotone" dataKey={sensor} stroke={sensorColors[i % sensorColors.length]} strokeWidth={1.5} dot={false} />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-center text-xs text-[#94A3B8] font-mono py-12">No temperature history — connect SMC for thermal monitoring</p>
            )}
          </div>
        </div>
      )}

      {/* Network */}
      {activeTab === 'Network' && (
        networkAdapters.length > 0 ? (
          <div className="bg-[#111827] rounded-lg border border-[#1E293B] overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#1E293B] text-[#94A3B8] text-left">
                  <th className="px-4 py-3 font-mono font-normal">Name</th>
                  <th className="px-4 py-3 font-mono font-normal">MAC</th>
                  <th className="px-4 py-3 font-mono font-normal">IP Address</th>
                  <th className="px-4 py-3 font-mono font-normal">Subnet</th>
                  <th className="px-4 py-3 font-mono font-normal">Gateway</th>
                  <th className="px-4 py-3 font-mono font-normal">DHCP</th>
                  <th className="px-4 py-3 font-mono font-normal">Status</th>
                </tr>
              </thead>
              <tbody>
                {networkAdapters.map(nic => (
                  <tr key={nic.mac} className="border-b border-[#1E293B]/50 hover:bg-[#1E293B]/30">
                    <td className="px-4 py-3 text-[#F1F5F9] font-mono">{nic.name}</td>
                    <td className="px-4 py-3 text-[#94A3B8] font-mono text-xs">{nic.mac}</td>
                    <td className="px-4 py-3 text-[#00F0FF] font-mono">{nic.addresses?.[0]?.ip || '—'}</td>
                    <td className="px-4 py-3 text-[#94A3B8] font-mono">{nic.addresses?.[0]?.subnet || '—'}</td>
                    <td className="px-4 py-3 text-[#94A3B8] font-mono">{nic.addresses?.[0]?.gateway || '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-mono ${nic.dhcp ? 'bg-[#FFB800]/20 text-[#FFB800]' : 'bg-[#00FF88]/20 text-[#00FF88]'}`}>
                        {nic.dhcp ? 'DHCP' : 'Static'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-1.5">
                        <span className={`w-2 h-2 rounded-full ${nic.status === 'Up' ? 'bg-[#00FF88]' : 'bg-[#FF3B3B]'}`} />
                        <span className="text-[#94A3B8] font-mono text-xs">{nic.status}</span>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="bg-[#111827] rounded-lg p-8 border border-dashed border-[#1E293B] text-center">
            <p className="text-[#94A3B8] font-mono text-sm">No network adapter data received</p>
            <p className="text-[#94A3B8]/50 font-mono text-xs mt-1">Ensure d3service is running on {machine.hostname}</p>
          </div>
        )
      )}

      {/* Issues */}
      {activeTab === 'Issues' && (
        <div className="bg-[#111827] rounded-lg p-6 border border-[#1E293B] text-center">
          <p className="text-[#94A3B8]">No issues recorded for this machine.</p>
          <button className="mt-4 px-4 py-2 bg-[#00F0FF]/10 text-[#00F0FF] border border-[#00F0FF]/30 rounded hover:bg-[#00F0FF]/20 transition-colors font-mono text-sm">
            + Create Issue
          </button>
        </div>
      )}
    </div>
  );
}
