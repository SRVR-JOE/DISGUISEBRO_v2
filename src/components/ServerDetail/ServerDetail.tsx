import { useState } from 'react';
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
import type { Machine, HealthSnapshot, NetworkAdapter } from '@/types';

const tabs = ['Overview', 'Hardware', 'Performance', 'Network', 'Issues'] as const;
type Tab = typeof tabs[number];

// Mock chart data
const mockFPSData = Array.from({ length: 30 }, (_, i) => ({
  time: `${String(Math.floor(i / 2) + 14).padStart(2, '0')}:${i % 2 === 0 ? '00' : '30'}`,
  fps: 59.94 + (Math.random() - 0.5) * 2,
}));
const mockDroppedData = Array.from({ length: 12 }, (_, i) => ({
  time: `${14 + i}:00`,
  dropped: Math.floor(Math.random() * 5),
  missed: Math.floor(Math.random() * 3),
}));
const mockTempData = Array.from({ length: 30 }, (_, i) => ({
  time: `${String(Math.floor(i / 2) + 14).padStart(2, '0')}:${i % 2 === 0 ? '00' : '30'}`,
  CPU0: 60 + Math.random() * 8,
  CPU1: 56 + Math.random() * 8,
  GPU: 68 + Math.random() * 10,
  System: 36 + Math.random() * 6,
}));

const mockNICs: NetworkAdapter[] = [
  { name: 'A - d3net 1Gbit', mac: 'AA:BB:CC:DD:EE:01', enabled: true, dhcp: false, status: 'Up', addresses: [{ ip: '10.0.0.1', subnet: '255.255.255.0', gateway: '10.0.0.254' }] },
  { name: 'B - NDI 10Gbit', mac: 'AA:BB:CC:DD:EE:02', enabled: true, dhcp: false, status: 'Up', addresses: [{ ip: '10.30.0.1', subnet: '255.255.255.0', gateway: '' }] },
  { name: 'C - Content 100Gbit', mac: 'AA:BB:CC:DD:EE:03', enabled: true, dhcp: false, status: 'Up', addresses: [{ ip: '10.50.0.1', subnet: '255.255.255.0', gateway: '' }] },
  { name: 'D - Mgmt 1Gbit', mac: 'AA:BB:CC:DD:EE:04', enabled: true, dhcp: true, status: 'Up', addresses: [{ ip: '192.168.1.100', subnet: '255.255.255.0', gateway: '192.168.1.1' }] },
];

export function ServerDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { state } = useAppContext();
  const [activeTab, setActiveTab] = useState<Tab>('Overview');

  const machine = state.machines.find(m => m.id === id) || {
    id: id || 'demo',
    hostname: 'GX3-001',
    type: 'GX 3',
    ipAddress: '10.0.0.1',
    isOnline: true,
    firstSeen: new Date().toISOString(),
    lastSeen: new Date().toISOString(),
  } as Machine;

  const health = state.healthData[machine.id] || {
    averageFPS: 59.94,
    videoDroppedFrames: 0,
    videoMissedFrames: 0,
    states: [],
  };

  const chassis = state.chassisStats[machine.id] || {
    temperatures: [
      { name: 'CPU0', value: 62, unit: '°C' },
      { name: 'CPU1', value: 58, unit: '°C' },
      { name: 'GPU', value: 71, unit: '°C' },
      { name: 'System', value: 38, unit: '°C' },
      { name: 'NVMe', value: 44, unit: '°C' },
    ],
    fans: [
      { name: 'FAN1', rpm: 2400 },
      { name: 'FAN2', rpm: 2350 },
    ],
    voltages: [],
  };

  const vfc = state.vfcData[machine.id];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate('/')}
          className="text-[#94A3B8] hover:text-[#00F0FF] transition-colors"
        >
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
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-mono transition-colors relative
              ${activeTab === tab
                ? 'text-[#00F0FF]'
                : 'text-[#94A3B8] hover:text-[#F1F5F9]'
              }`}
          >
            {tab}
            {activeTab === tab && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#00F0FF]" />
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'Overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 flex flex-col items-center">
            <HealthRing
              fps={health.averageFPS}
              genlockState="LOCKED"
              droppedFrames={health.videoDroppedFrames}
              missedFrames={health.videoMissedFrames}
            />
          </div>
          <div className="lg:col-span-1">
            <VFCPanel vfcData={vfc} />
          </div>
          <div className="lg:col-span-1">
            <TemperatureBars chassisStats={chassis} />
          </div>
          <div className="lg:col-span-3">
            <NotificationFeed notifications={state.notifications} machineFilter={machine.id} />
          </div>
        </div>
      )}

      {activeTab === 'Hardware' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-[#111827] rounded-lg p-5 border border-[#1E293B]">
            <h3 className="text-sm font-mono text-[#00F0FF] mb-4 uppercase tracking-wider">Machine Identity</h3>
            <div className="space-y-3 text-sm">
              {[
                ['Hostname', machine.hostname],
                ['Type', machine.type],
                ['IP Address', machine.ipAddress],
                ['Version', machine.version || 'r31.0'],
                ['SMC IP', machine.smcIp || '172.31.250.9'],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between">
                  <span className="text-[#94A3B8]">{label}</span>
                  <span className="text-[#F1F5F9] font-mono">{value}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="bg-[#111827] rounded-lg p-5 border border-[#1E293B]">
            <h3 className="text-sm font-mono text-[#00F0FF] mb-4 uppercase tracking-wider">GPU</h3>
            <div className="space-y-3 text-sm">
              {[
                ['Model', 'NVIDIA RTX A6000'],
                ['VRAM', '48 GB GDDR6'],
                ['Genlock', 'LOCKED'],
                ['Output 1', '3840x2160 @ 59.94Hz'],
                ['Output 2', '1920x1080 @ 59.94Hz'],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between">
                  <span className="text-[#94A3B8]">{label}</span>
                  <span className="text-[#F1F5F9] font-mono">{value}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="bg-[#111827] rounded-lg p-5 border border-[#1E293B]">
            <h3 className="text-sm font-mono text-[#00F0FF] mb-4 uppercase tracking-wider">OS Information</h3>
            <div className="space-y-3 text-sm">
              {[
                ['Windows Version', 'Windows 10 Enterprise LTSC'],
                ['Image Version', 'disguise-21H2-r31'],
                ['Uptime', '14h 23m'],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between">
                  <span className="text-[#94A3B8]">{label}</span>
                  <span className="text-[#F1F5F9] font-mono">{value}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="bg-[#111827] rounded-lg p-5 border border-[#1E293B]">
            <h3 className="text-sm font-mono text-[#00F0FF] mb-4 uppercase tracking-wider">Fans</h3>
            <div className="space-y-3 text-sm">
              {chassis.fans.map((fan: { name: string; rpm: number }) => (
                <div key={fan.name} className="flex justify-between">
                  <span className="text-[#94A3B8]">{fan.name}</span>
                  <span className={`font-mono ${fan.rpm > 0 ? 'text-[#00FF88]' : 'text-[#FF3B3B]'}`}>
                    {fan.rpm} RPM
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'Performance' && (
        <div className="space-y-6">
          <div className="bg-[#111827] rounded-lg p-5 border border-[#1E293B]">
            <h3 className="text-sm font-mono text-[#00F0FF] mb-4 uppercase tracking-wider">FPS Timeline</h3>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={mockFPSData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" />
                <XAxis dataKey="time" stroke="#94A3B8" fontSize={11} />
                <YAxis domain={[55, 62]} stroke="#94A3B8" fontSize={11} />
                <Tooltip contentStyle={{ backgroundColor: '#111827', border: '1px solid #1E293B', color: '#F1F5F9' }} />
                <Line type="monotone" dataKey="fps" stroke="#00F0FF" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="bg-[#111827] rounded-lg p-5 border border-[#1E293B]">
            <h3 className="text-sm font-mono text-[#00F0FF] mb-4 uppercase tracking-wider">Dropped / Missed Frames</h3>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={mockDroppedData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" />
                <XAxis dataKey="time" stroke="#94A3B8" fontSize={11} />
                <YAxis stroke="#94A3B8" fontSize={11} />
                <Tooltip contentStyle={{ backgroundColor: '#111827', border: '1px solid #1E293B', color: '#F1F5F9' }} />
                <Bar dataKey="dropped" fill="#FF3B3B" radius={[2, 2, 0, 0]} />
                <Bar dataKey="missed" fill="#FFB800" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="bg-[#111827] rounded-lg p-5 border border-[#1E293B]">
            <h3 className="text-sm font-mono text-[#00F0FF] mb-4 uppercase tracking-wider">Temperature Trends</h3>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={mockTempData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" />
                <XAxis dataKey="time" stroke="#94A3B8" fontSize={11} />
                <YAxis domain={[30, 85]} stroke="#94A3B8" fontSize={11} />
                <Tooltip contentStyle={{ backgroundColor: '#111827', border: '1px solid #1E293B', color: '#F1F5F9' }} />
                <Line type="monotone" dataKey="CPU0" stroke="#FF3B3B" strokeWidth={1.5} dot={false} />
                <Line type="monotone" dataKey="CPU1" stroke="#FFB800" strokeWidth={1.5} dot={false} />
                <Line type="monotone" dataKey="GPU" stroke="#E91E8C" strokeWidth={1.5} dot={false} />
                <Line type="monotone" dataKey="System" stroke="#00FF88" strokeWidth={1.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {activeTab === 'Network' && (
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
              {mockNICs.map(nic => (
                <tr key={nic.mac} className="border-b border-[#1E293B]/50 hover:bg-[#1E293B]/30">
                  <td className="px-4 py-3 text-[#F1F5F9] font-mono">{nic.name}</td>
                  <td className="px-4 py-3 text-[#94A3B8] font-mono text-xs">{nic.mac}</td>
                  <td className="px-4 py-3 text-[#00F0FF] font-mono">{nic.addresses[0]?.ip}</td>
                  <td className="px-4 py-3 text-[#94A3B8] font-mono">{nic.addresses[0]?.subnet}</td>
                  <td className="px-4 py-3 text-[#94A3B8] font-mono">{nic.addresses[0]?.gateway || '—'}</td>
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
      )}

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
