import { useState, useEffect, useCallback } from 'react';
import { useAppContext } from '@/store/AppContext';
import type { NetworkProfile, ProfileAdapter, NetworkAdapter, Machine } from '@/types';

// ── Helpers ──────────────────────────────────────────────────────────────────

function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function emptyAdapter(): ProfileAdapter {
  return { matchBy: 'position', position: 0, name: '', ip: '', netmask: '255.255.255.0' };
}

function emptyProfile(): NetworkProfile {
  return {
    id: uid(),
    profileName: '',
    profileVersion: '1.0',
    createdBy: 'operator',
    createdAt: new Date().toISOString(),
    showName: '',
    machine: { hostname: '', role: 'actor' },
    networkAdapters: [emptyAdapter()],
  };
}

// ── Deploy Modal ─────────────────────────────────────────────────────────────

interface DeployModalProps {
  profile: NetworkProfile;
  machines: Machine[];
  onClose: () => void;
}

function DeployModal({ profile, machines, onClose }: DeployModalProps) {
  const [step, setStep] = useState<'select' | 'diff' | 'deploying' | 'done'>('select');
  const [targetMachine, setTargetMachine] = useState<Machine | null>(null);
  const [currentAdapters, setCurrentAdapters] = useState<NetworkAdapter[]>([]);
  const [deployStatus, setDeployStatus] = useState('');

  const loadDiff = useCallback(async (machine: Machine) => {
    setTargetMachine(machine);
    try {
      const adapters = await window.d3watch.api.getNetworkAdapters(machine.ipAddress);
      setCurrentAdapters(adapters);
      setStep('diff');
    } catch {
      setCurrentAdapters([]);
      setStep('diff');
    }
  }, []);

  const executeDeploy = useCallback(async () => {
    if (!targetMachine) return;
    setStep('deploying');
    try {
      const auth = (await window.d3watch.settings.get('smcAuth')) ?? '';
      // Set hostname
      if (profile.machine.hostname) {
        setDeployStatus('Setting hostname...');
        await window.d3watch.smc.setHostname(targetMachine.smcIp ?? targetMachine.ipAddress, profile.machine.hostname, auth);
      }
      // Configure each adapter
      for (const adapter of profile.networkAdapters) {
        setDeployStatus(`Configuring ${adapter.name}...`);
        const mac = adapter.mac ?? '';
        await window.d3watch.smc.setNetworkAdapter(
          targetMachine.smcIp ?? targetMachine.ipAddress,
          mac,
          { ip: adapter.ip, netmask: adapter.netmask, name: adapter.name },
          auth,
        );
      }
      setDeployStatus('Deploy complete');
      setStep('done');
    } catch (err) {
      setDeployStatus(`Deploy failed: ${err instanceof Error ? err.message : String(err)}`);
      setStep('done');
    }
  }, [targetMachine, profile]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-2xl border border-[#1E293B] bg-[#111827] p-6 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-mono text-lg font-bold tracking-wider text-[#00F0FF]">
            DEPLOY PROFILE
          </h2>
          <button onClick={onClose} className="text-[#94A3B8] hover:text-[#F1F5F9] transition-colors text-xl leading-none">&times;</button>
        </div>

        {/* Step: Select target */}
        {step === 'select' && (
          <div>
            <p className="text-sm text-[#94A3B8] mb-4">Select target server for &quot;{profile.profileName}&quot;</p>
            <div className="grid grid-cols-2 gap-3 max-h-60 overflow-y-auto custom-scrollbar">
              {machines.filter((m) => m.isOnline).map((m) => (
                <button
                  key={m.id}
                  onClick={() => loadDiff(m)}
                  className="flex items-center gap-3 rounded-lg border border-[#1E293B] bg-[#0A0E17] p-3 text-left hover:border-[#00F0FF]/40 hover:bg-[#1E293B] transition-all"
                >
                  <span className="h-2 w-2 rounded-full bg-[#00FF88] shrink-0" />
                  <div>
                    <p className="font-mono text-sm text-[#F1F5F9]">{m.hostname}</p>
                    <p className="font-mono text-[10px] text-[#94A3B8]">{m.ipAddress}</p>
                  </div>
                </button>
              ))}
              {machines.filter((m) => m.isOnline).length === 0 && (
                <p className="col-span-2 text-center text-sm text-[#94A3B8] py-8">No online servers found</p>
              )}
            </div>
          </div>
        )}

        {/* Step: Diff preview */}
        {step === 'diff' && targetMachine && (
          <div>
            <p className="text-sm text-[#94A3B8] mb-4">
              Deploying to <span className="text-[#00F0FF] font-mono">{targetMachine.hostname}</span>
            </p>
            <div className="grid grid-cols-2 gap-4 mb-6">
              {/* Current */}
              <div>
                <h3 className="font-mono text-xs text-[#FF3B3B] mb-2 tracking-wider">CURRENT</h3>
                <div className="space-y-2 rounded-lg border border-[#FF3B3B]/20 bg-[#0A0E17] p-3 max-h-48 overflow-y-auto custom-scrollbar">
                  <p className="font-mono text-xs text-[#94A3B8]">Hostname: <span className="text-[#F1F5F9]">{targetMachine.hostname}</span></p>
                  {currentAdapters.map((a, i) => (
                    <div key={i} className="border-t border-[#1E293B] pt-1 mt-1">
                      <p className="font-mono text-[11px] text-[#F1F5F9]">{a.name}</p>
                      <p className="font-mono text-[10px] text-[#94A3B8]">
                        {a.addresses.map((addr) => addr.ip).join(', ') || 'No IP'}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
              {/* Proposed */}
              <div>
                <h3 className="font-mono text-xs text-[#00FF88] mb-2 tracking-wider">PROPOSED</h3>
                <div className="space-y-2 rounded-lg border border-[#00FF88]/20 bg-[#0A0E17] p-3 max-h-48 overflow-y-auto custom-scrollbar">
                  <p className="font-mono text-xs text-[#94A3B8]">Hostname: <span className="text-[#F1F5F9]">{profile.machine.hostname}</span></p>
                  {profile.networkAdapters.map((a, i) => (
                    <div key={i} className="border-t border-[#1E293B] pt-1 mt-1">
                      <p className="font-mono text-[11px] text-[#F1F5F9]">{a.name}</p>
                      <p className="font-mono text-[10px] text-[#94A3B8]">{a.ip} / {a.netmask}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setStep('select')} className="px-4 py-2 rounded-lg border border-[#1E293B] text-sm text-[#94A3B8] hover:text-[#F1F5F9] hover:border-[#94A3B8] transition-all font-mono">
                Back
              </button>
              <button onClick={executeDeploy} className="px-4 py-2 rounded-lg bg-[#00F0FF]/20 border border-[#00F0FF]/40 text-sm text-[#00F0FF] hover:bg-[#00F0FF]/30 transition-all font-mono font-bold tracking-wider">
                CONFIRM DEPLOY
              </button>
            </div>
          </div>
        )}

        {/* Step: Deploying / Done */}
        {(step === 'deploying' || step === 'done') && (
          <div className="flex flex-col items-center justify-center py-8 gap-4">
            {step === 'deploying' && (
              <div className="w-8 h-8 border-2 border-[#00F0FF] border-t-transparent rounded-full animate-spin" />
            )}
            {step === 'done' && (
              <div className={`w-12 h-12 rounded-full flex items-center justify-center ${deployStatus.includes('failed') ? 'bg-[#FF3B3B]/20' : 'bg-[#00FF88]/20'}`}>
                <span className={`text-2xl ${deployStatus.includes('failed') ? 'text-[#FF3B3B]' : 'text-[#00FF88]'}`}>
                  {deployStatus.includes('failed') ? '\u2717' : '\u2713'}
                </span>
              </div>
            )}
            <p className="font-mono text-sm text-[#F1F5F9]">{deployStatus}</p>
            {step === 'done' && (
              <button onClick={onClose} className="mt-2 px-4 py-2 rounded-lg border border-[#1E293B] text-sm text-[#94A3B8] hover:text-[#F1F5F9] transition-all font-mono">
                Close
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────

export default function NetworkProfiles() {
  const { machines } = useAppContext();
  const [profiles, setProfiles] = useState<NetworkProfile[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingProfile, setEditingProfile] = useState<NetworkProfile | null>(null);
  const [deployProfile, setDeployProfile] = useState<NetworkProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // Load profiles
  useEffect(() => {
    window.d3watch.profiles.getAll().then((p) => {
      setProfiles(p);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const handleNew = () => {
    const p = emptyProfile();
    setEditingProfile(p);
    setSelectedId(p.id);
  };

  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const imported = JSON.parse(text) as NetworkProfile;
        imported.id = uid();
        imported.createdAt = new Date().toISOString();
        await window.d3watch.profiles.save(imported);
        setProfiles((prev) => [...prev, imported]);
      } catch {
        // ignore invalid files
      }
    };
    input.click();
  };

  const handleSave = async () => {
    if (!editingProfile) return;
    await window.d3watch.profiles.save(editingProfile);
    setProfiles((prev) => {
      const idx = prev.findIndex((p) => p.id === editingProfile.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = editingProfile;
        return next;
      }
      return [...prev, editingProfile];
    });
  };

  const handleDelete = async () => {
    if (!editingProfile) return;
    await window.d3watch.profiles.delete(editingProfile.id);
    setProfiles((prev) => prev.filter((p) => p.id !== editingProfile.id));
    setEditingProfile(null);
    setSelectedId(null);
  };

  const handleExport = () => {
    if (!editingProfile) return;
    const blob = new Blob([JSON.stringify(editingProfile, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${editingProfile.profileName || 'profile'}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleSelectProfile = (p: NetworkProfile) => {
    if (selectedId === p.id) {
      setSelectedId(null);
      setEditingProfile(null);
    } else {
      setSelectedId(p.id);
      setEditingProfile({ ...p, networkAdapters: p.networkAdapters.map((a) => ({ ...a })) });
    }
  };

  const updateField = (field: keyof NetworkProfile, value: string) => {
    if (!editingProfile) return;
    setEditingProfile({ ...editingProfile, [field]: value });
  };

  const updateMachine = (field: 'hostname' | 'role', value: string) => {
    if (!editingProfile) return;
    setEditingProfile({
      ...editingProfile,
      machine: { ...editingProfile.machine, [field]: value },
    });
  };

  const updateAdapter = (index: number, field: keyof ProfileAdapter, value: string | number) => {
    if (!editingProfile) return;
    const adapters = [...editingProfile.networkAdapters];
    adapters[index] = { ...adapters[index], [field]: value };
    setEditingProfile({ ...editingProfile, networkAdapters: adapters });
  };

  const addAdapter = () => {
    if (!editingProfile) return;
    setEditingProfile({
      ...editingProfile,
      networkAdapters: [...editingProfile.networkAdapters, emptyAdapter()],
    });
  };

  const removeAdapter = (index: number) => {
    if (!editingProfile) return;
    setEditingProfile({
      ...editingProfile,
      networkAdapters: editingProfile.networkAdapters.filter((_, i) => i !== index),
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-8 h-8 border-2 border-[#00F0FF] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto custom-scrollbar p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-mono text-2xl font-bold tracking-widest text-[#F1F5F9]">
            NETWORK PROFILES
          </h1>
          <p className="font-mono text-xs text-[#94A3B8] mt-1">
            Manage and deploy network configurations across your fleet
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={handleImport}
            className="px-4 py-2 rounded-lg border border-[#1E293B] bg-[#111827] text-sm text-[#94A3B8] hover:text-[#F1F5F9] hover:border-[#94A3B8] transition-all font-mono flex items-center gap-2"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Import
          </button>
          <button
            onClick={handleNew}
            className="px-4 py-2 rounded-lg bg-[#00F0FF]/10 border border-[#00F0FF]/30 text-sm text-[#00F0FF] hover:bg-[#00F0FF]/20 transition-all font-mono font-bold tracking-wider flex items-center gap-2"
          >
            <span className="text-lg leading-none">+</span>
            New Profile
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Profile List */}
        <div className="xl:col-span-1 space-y-3">
          {profiles.length === 0 && !editingProfile && (
            <div className="flex flex-col items-center justify-center py-16 rounded-xl border border-dashed border-[#1E293B] bg-[#111827]/50">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="mb-3 opacity-40">
                <rect x="2" y="2" width="20" height="8" rx="2" ry="2" />
                <rect x="2" y="14" width="20" height="8" rx="2" ry="2" />
              </svg>
              <p className="text-sm text-[#94A3B8]">No profiles yet</p>
              <p className="text-xs text-[#94A3B8]/60 mt-1">Create or import a profile to get started</p>
            </div>
          )}

          {profiles.map((p) => (
            <button
              key={p.id}
              onClick={() => handleSelectProfile(p)}
              className={`w-full text-left rounded-xl border p-4 transition-all duration-200
                ${selectedId === p.id
                  ? 'border-[#00F0FF]/40 bg-[#111827] shadow-[0_0_20px_rgba(0,240,255,0.1)]'
                  : 'border-[#1E293B] bg-[#111827] hover:border-[#00F0FF]/20 hover:bg-[#1E293B]'
                }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="font-mono text-sm font-bold text-[#F1F5F9] truncate">
                    {p.profileName || 'Untitled Profile'}
                  </h3>
                  <p className="font-mono text-[11px] text-[#94A3B8] mt-0.5 truncate">
                    {p.showName || 'No show'} &middot; v{p.profileVersion}
                  </p>
                </div>
                <span className="shrink-0 rounded-full bg-[#00F0FF]/10 px-2 py-0.5 font-mono text-[10px] text-[#00F0FF]">
                  {p.networkAdapters.length} NIC{p.networkAdapters.length !== 1 ? 's' : ''}
                </span>
              </div>
              <div className="mt-2 flex items-center gap-2">
                <span className="font-mono text-[10px] text-[#94A3B8]/70">
                  {p.machine.hostname || 'no-host'} &middot; {p.machine.role}
                </span>
              </div>
            </button>
          ))}

          {/* Show the new profile card if editing a brand new one */}
          {editingProfile && !profiles.find((p) => p.id === editingProfile.id) && (
            <div className="w-full rounded-xl border border-[#00F0FF]/40 bg-[#111827] p-4 shadow-[0_0_20px_rgba(0,240,255,0.1)]">
              <h3 className="font-mono text-sm font-bold text-[#00F0FF]">
                {editingProfile.profileName || 'New Profile'}
              </h3>
              <p className="font-mono text-[10px] text-[#94A3B8] mt-1">Editing...</p>
            </div>
          )}
        </div>

        {/* Profile Editor */}
        <div className="xl:col-span-2">
          {!editingProfile ? (
            <div className="flex flex-col items-center justify-center py-24 rounded-xl border border-dashed border-[#1E293B] bg-[#111827]/30">
              <p className="text-sm text-[#94A3B8]">Select a profile to edit</p>
            </div>
          ) : (
            <div className="rounded-xl border border-[#1E293B] bg-[#111827] p-6 space-y-6">
              {/* Profile fields */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block font-mono text-[10px] text-[#94A3B8] tracking-wider mb-1.5">PROFILE NAME</label>
                  <input
                    value={editingProfile.profileName}
                    onChange={(e) => updateField('profileName', e.target.value)}
                    className="w-full rounded-lg border border-[#1E293B] bg-[#0A0E17] px-3 py-2 font-mono text-sm text-[#F1F5F9] focus:outline-none focus:border-[#00F0FF]/50 transition-colors"
                    placeholder="Profile name"
                  />
                </div>
                <div>
                  <label className="block font-mono text-[10px] text-[#94A3B8] tracking-wider mb-1.5">SHOW NAME</label>
                  <input
                    value={editingProfile.showName}
                    onChange={(e) => updateField('showName', e.target.value)}
                    className="w-full rounded-lg border border-[#1E293B] bg-[#0A0E17] px-3 py-2 font-mono text-sm text-[#F1F5F9] focus:outline-none focus:border-[#00F0FF]/50 transition-colors"
                    placeholder="Show name"
                  />
                </div>
                <div>
                  <label className="block font-mono text-[10px] text-[#94A3B8] tracking-wider mb-1.5">VERSION</label>
                  <input
                    value={editingProfile.profileVersion}
                    onChange={(e) => updateField('profileVersion', e.target.value)}
                    className="w-full rounded-lg border border-[#1E293B] bg-[#0A0E17] px-3 py-2 font-mono text-sm text-[#F1F5F9] focus:outline-none focus:border-[#00F0FF]/50 transition-colors"
                    placeholder="1.0"
                  />
                </div>
              </div>

              {/* Machine fields */}
              <div>
                <h3 className="font-mono text-xs text-[#00F0FF] tracking-wider mb-3 flex items-center gap-2">
                  <span className="h-px flex-1 bg-[#1E293B]" />
                  MACHINE
                  <span className="h-px flex-1 bg-[#1E293B]" />
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block font-mono text-[10px] text-[#94A3B8] tracking-wider mb-1.5">HOSTNAME</label>
                    <input
                      value={editingProfile.machine.hostname}
                      onChange={(e) => updateMachine('hostname', e.target.value)}
                      className="w-full rounded-lg border border-[#1E293B] bg-[#0A0E17] px-3 py-2 font-mono text-sm text-[#F1F5F9] focus:outline-none focus:border-[#00F0FF]/50 transition-colors"
                      placeholder="d3-gx2c-01"
                    />
                  </div>
                  <div>
                    <label className="block font-mono text-[10px] text-[#94A3B8] tracking-wider mb-1.5">ROLE</label>
                    <select
                      value={editingProfile.machine.role}
                      onChange={(e) => updateMachine('role', e.target.value)}
                      className="w-full rounded-lg border border-[#1E293B] bg-[#0A0E17] px-3 py-2 font-mono text-sm text-[#F1F5F9] focus:outline-none focus:border-[#00F0FF]/50 transition-colors"
                    >
                      <option value="director">Director</option>
                      <option value="actor">Actor</option>
                      <option value="understudy">Understudy</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Adapter table */}
              <div>
                <h3 className="font-mono text-xs text-[#00F0FF] tracking-wider mb-3 flex items-center gap-2">
                  <span className="h-px flex-1 bg-[#1E293B]" />
                  NETWORK ADAPTERS
                  <span className="h-px flex-1 bg-[#1E293B]" />
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-[#1E293B]">
                        {['Match By', 'Position / Speed / MAC', 'Name', 'IP Address', 'Netmask', ''].map((h) => (
                          <th key={h} className="pb-2 pr-2 font-mono text-[10px] text-[#94A3B8] tracking-wider whitespace-nowrap">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {editingProfile.networkAdapters.map((adapter, i) => (
                        <tr key={i} className="border-b border-[#1E293B]/50 group">
                          <td className="py-2 pr-2">
                            <select
                              value={adapter.matchBy}
                              onChange={(e) => updateAdapter(i, 'matchBy', e.target.value)}
                              className="w-full rounded border border-[#1E293B] bg-[#0A0E17] px-2 py-1.5 font-mono text-xs text-[#F1F5F9] focus:outline-none focus:border-[#00F0FF]/50"
                            >
                              <option value="position">Position</option>
                              <option value="speed">Speed</option>
                              <option value="mac">MAC</option>
                            </select>
                          </td>
                          <td className="py-2 pr-2">
                            {adapter.matchBy === 'position' && (
                              <input
                                type="number"
                                min={0}
                                value={adapter.position ?? 0}
                                onChange={(e) => updateAdapter(i, 'position', parseInt(e.target.value) || 0)}
                                className="w-full rounded border border-[#1E293B] bg-[#0A0E17] px-2 py-1.5 font-mono text-xs text-[#F1F5F9] focus:outline-none focus:border-[#00F0FF]/50"
                              />
                            )}
                            {adapter.matchBy === 'speed' && (
                              <input
                                value={adapter.speed ?? ''}
                                onChange={(e) => updateAdapter(i, 'speed', e.target.value)}
                                className="w-full rounded border border-[#1E293B] bg-[#0A0E17] px-2 py-1.5 font-mono text-xs text-[#F1F5F9] focus:outline-none focus:border-[#00F0FF]/50"
                                placeholder="10Gbps"
                              />
                            )}
                            {adapter.matchBy === 'mac' && (
                              <input
                                value={adapter.mac ?? ''}
                                onChange={(e) => updateAdapter(i, 'mac', e.target.value)}
                                className="w-full rounded border border-[#1E293B] bg-[#0A0E17] px-2 py-1.5 font-mono text-xs text-[#F1F5F9] focus:outline-none focus:border-[#00F0FF]/50"
                                placeholder="AA:BB:CC:DD:EE:FF"
                              />
                            )}
                          </td>
                          <td className="py-2 pr-2">
                            <input
                              value={adapter.name}
                              onChange={(e) => updateAdapter(i, 'name', e.target.value)}
                              className="w-full rounded border border-[#1E293B] bg-[#0A0E17] px-2 py-1.5 font-mono text-xs text-[#F1F5F9] focus:outline-none focus:border-[#00F0FF]/50"
                              placeholder="Ethernet 1"
                            />
                          </td>
                          <td className="py-2 pr-2">
                            <input
                              value={adapter.ip}
                              onChange={(e) => updateAdapter(i, 'ip', e.target.value)}
                              className="w-full rounded border border-[#1E293B] bg-[#0A0E17] px-2 py-1.5 font-mono text-xs text-[#F1F5F9] focus:outline-none focus:border-[#00F0FF]/50"
                              placeholder="10.0.0.1"
                            />
                          </td>
                          <td className="py-2 pr-2">
                            <input
                              value={adapter.netmask}
                              onChange={(e) => updateAdapter(i, 'netmask', e.target.value)}
                              className="w-full rounded border border-[#1E293B] bg-[#0A0E17] px-2 py-1.5 font-mono text-xs text-[#F1F5F9] focus:outline-none focus:border-[#00F0FF]/50"
                              placeholder="255.255.255.0"
                            />
                          </td>
                          <td className="py-2">
                            <button
                              onClick={() => removeAdapter(i)}
                              className="opacity-0 group-hover:opacity-100 text-[#FF3B3B] hover:text-[#FF3B3B]/80 transition-all p-1"
                              title="Remove adapter"
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <button
                  onClick={addAdapter}
                  className="mt-3 flex items-center gap-1.5 text-xs font-mono text-[#00F0FF] hover:text-[#00F0FF]/80 transition-colors"
                >
                  <span className="text-sm">+</span> Add Adapter
                </button>
              </div>

              {/* Action buttons */}
              <div className="flex items-center justify-between pt-4 border-t border-[#1E293B]">
                <button
                  onClick={handleDelete}
                  className="px-4 py-2 rounded-lg border border-[#FF3B3B]/30 text-sm text-[#FF3B3B] hover:bg-[#FF3B3B]/10 transition-all font-mono"
                >
                  Delete
                </button>
                <div className="flex gap-3">
                  <button
                    onClick={handleExport}
                    className="px-4 py-2 rounded-lg border border-[#1E293B] text-sm text-[#94A3B8] hover:text-[#F1F5F9] hover:border-[#94A3B8] transition-all font-mono"
                  >
                    Export
                  </button>
                  <button
                    onClick={() => setDeployProfile(editingProfile)}
                    className="px-4 py-2 rounded-lg border border-[#FFB800]/30 bg-[#FFB800]/10 text-sm text-[#FFB800] hover:bg-[#FFB800]/20 transition-all font-mono font-bold tracking-wider"
                  >
                    Deploy
                  </button>
                  <button
                    onClick={handleSave}
                    className="px-4 py-2 rounded-lg bg-[#00FF88]/10 border border-[#00FF88]/30 text-sm text-[#00FF88] hover:bg-[#00FF88]/20 transition-all font-mono font-bold tracking-wider"
                  >
                    Save
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Deploy Modal */}
      {deployProfile && (
        <DeployModal
          profile={deployProfile}
          machines={machines}
          onClose={() => setDeployProfile(null)}
        />
      )}
    </div>
  );
}
