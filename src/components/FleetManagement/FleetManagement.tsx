import { useState, useEffect, useCallback } from 'react';
import { useAppContext } from '@/store/AppContext';
import type { Machine } from '@/types';

// ── Types ────────────────────────────────────────────────────────────────────

interface PowerState {
  machineId: string;
  state: 'on' | 'off' | 'unknown';
  loading: boolean;
}

type OLEDTemplate = 'SHOW LIVE' | 'DO NOT TOUCH' | 'MAINTENANCE' | 'custom';

// ── Confirmation Modal ───────────────────────────────────────────────────────

function ConfirmModal({ title, message, danger, onConfirm, onCancel }: {
  title: string;
  message: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-[#1E293B] bg-[#111827] p-6 shadow-2xl">
        <h2 className={`font-mono text-lg font-bold tracking-wider ${danger ? 'text-[#FF3B3B]' : 'text-[#00F0FF]'}`}>
          {title}
        </h2>
        <p className="mt-3 text-sm text-[#94A3B8]">{message}</p>
        <div className="mt-6 flex justify-end gap-3">
          <button onClick={onCancel} className="px-4 py-2 rounded-lg border border-[#1E293B] text-sm text-[#94A3B8] hover:text-[#F1F5F9] transition-all font-mono">
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className={`px-4 py-2 rounded-lg text-sm font-mono font-bold tracking-wider transition-all ${
              danger
                ? 'bg-[#FF3B3B]/20 border border-[#FF3B3B]/40 text-[#FF3B3B] hover:bg-[#FF3B3B]/30'
                : 'bg-[#00F0FF]/20 border border-[#00F0FF]/40 text-[#00F0FF] hover:bg-[#00F0FF]/30'
            }`}
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────

export default function FleetManagement() {
  const { machines } = useAppContext();
  const [powerStates, setPowerStates] = useState<Record<string, PowerState>>({});
  const [auth, setAuth] = useState('');
  const [smcUser, setSmcUser] = useState('');
  const [smcPass, setSmcPass] = useState('');
  const [safetyLock, setSafetyLock] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{ title: string; message: string; danger?: boolean; action: () => void } | null>(null);

  // OLED state
  const [oledMessage, setOledMessage] = useState('');
  const [oledTemplate, setOledTemplate] = useState<OLEDTemplate>('custom');
  const [oledTarget, setOledTarget] = useState<'all' | string>('all');
  const [oledDuration, setOledDuration] = useState(10);
  const [oledSending, setOledSending] = useState(false);

  // LED state
  const [ledColors, setLedColors] = useState<Record<string, string>>({});

  // Load auth from settings
  useEffect(() => {
    window.d3watch.settings.get('smcAuth').then((v) => {
      if (v) setAuth(v);
    }).catch(() => {});
  }, []);

  // Poll power states
  useEffect(() => {
    const fetchPower = async () => {
      for (const m of machines) {
        if (!m.smcIp) continue;
        try {
          const result = await window.d3watch.smc.getPowerStatus(m.smcIp);
          setPowerStates((prev) => ({
            ...prev,
            [m.id]: { machineId: m.id, state: result.state === 'on' ? 'on' : 'off', loading: false },
          }));
        } catch {
          setPowerStates((prev) => ({
            ...prev,
            [m.id]: { machineId: m.id, state: 'unknown', loading: false },
          }));
        }
      }
    };
    fetchPower();
    const interval = setInterval(fetchPower, 15000);
    return () => clearInterval(interval);
  }, [machines]);

  const encodeAuth = useCallback(() => {
    if (smcUser && smcPass) {
      const encoded = btoa(`${smcUser}:${smcPass}`);
      setAuth(encoded);
      window.d3watch.settings.set('smcAuth', encoded);
      return encoded;
    }
    return auth;
  }, [smcUser, smcPass, auth]);

  const getAuth = useCallback(() => {
    if (smcUser && smcPass) return encodeAuth();
    return auth;
  }, [smcUser, smcPass, auth, encodeAuth]);

  // Power actions
  const powerOn = useCallback(async (machine: Machine) => {
    if (safetyLock) return;
    const smcIp = machine.smcIp ?? machine.ipAddress;
    setPowerStates((prev) => ({ ...prev, [machine.id]: { ...prev[machine.id], loading: true } }));
    try {
      await window.d3watch.smc.powerOn(smcIp, getAuth());
      setPowerStates((prev) => ({ ...prev, [machine.id]: { machineId: machine.id, state: 'on', loading: false } }));
    } catch {
      setPowerStates((prev) => ({ ...prev, [machine.id]: { ...prev[machine.id], loading: false } }));
    }
  }, [getAuth, safetyLock]);

  const powerOff = useCallback(async (machine: Machine) => {
    const smcIp = machine.smcIp ?? machine.ipAddress;
    setPowerStates((prev) => ({ ...prev, [machine.id]: { ...prev[machine.id], loading: true } }));
    try {
      await window.d3watch.smc.powerOff(smcIp, getAuth());
      setPowerStates((prev) => ({ ...prev, [machine.id]: { machineId: machine.id, state: 'off', loading: false } }));
    } catch {
      setPowerStates((prev) => ({ ...prev, [machine.id]: { ...prev[machine.id], loading: false } }));
    }
  }, [getAuth]);

  const powerCycle = useCallback(async (machine: Machine) => {
    if (safetyLock) return;
    const smcIp = machine.smcIp ?? machine.ipAddress;
    setPowerStates((prev) => ({ ...prev, [machine.id]: { ...prev[machine.id], loading: true } }));
    try {
      await window.d3watch.smc.powerCycle(smcIp, getAuth());
      setTimeout(() => {
        setPowerStates((prev) => ({ ...prev, [machine.id]: { machineId: machine.id, state: 'on', loading: false } }));
      }, 5000);
    } catch {
      setPowerStates((prev) => ({ ...prev, [machine.id]: { ...prev[machine.id], loading: false } }));
    }
  }, [getAuth, safetyLock]);

  const powerOnAll = useCallback(async () => {
    if (safetyLock) return;
    for (const m of machines) {
      await powerOn(m);
      // 2-second sequencing delay between machines
      await new Promise((r) => setTimeout(r, 2000));
    }
  }, [machines, powerOn, safetyLock]);

  const powerOffAll = useCallback(() => {
    setConfirmAction({
      title: 'POWER OFF ALL SERVERS',
      message: 'This will power off ALL servers in the fleet. This action cannot be undone remotely if SMC access is lost. Are you sure?',
      danger: true,
      action: async () => {
        setConfirmAction(null);
        for (const m of machines) {
          await powerOff(m);
        }
      },
    });
  }, [machines, powerOff]);

  const identify = useCallback(async (machine: Machine) => {
    const smcIp = machine.smcIp ?? machine.ipAddress;
    try {
      await window.d3watch.smc.identify(smcIp);
    } catch {
      // silently fail
    }
  }, []);

  const sendOLED = useCallback(async () => {
    setOledSending(true);
    const message = oledTemplate === 'custom' ? oledMessage : oledTemplate;
    const targets = oledTarget === 'all' ? machines : machines.filter((m) => m.id === oledTarget);
    try {
      for (const m of targets) {
        const smcIp = m.smcIp ?? m.ipAddress;
        await window.d3watch.smc.sendOLED(smcIp, message, getAuth());
      }
    } catch {
      // silently fail
    }
    setOledSending(false);
  }, [oledMessage, oledTemplate, oledTarget, machines, getAuth]);

  const handleTemplateSelect = (template: OLEDTemplate) => {
    setOledTemplate(template);
    if (template !== 'custom') {
      setOledMessage(template);
    }
  };

  const activeMessage = oledTemplate === 'custom' ? oledMessage : oledTemplate;

  return (
    <div className="h-full overflow-y-auto custom-scrollbar p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-mono text-2xl font-bold tracking-widest text-[#F1F5F9]">
            FLEET MANAGEMENT
          </h1>
          <p className="font-mono text-xs text-[#94A3B8] mt-1">
            Power, identify, and communicate with your server fleet
          </p>
        </div>
        {/* Safety lock */}
        <button
          onClick={() => setSafetyLock(!safetyLock)}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg border font-mono text-sm transition-all ${
            safetyLock
              ? 'border-[#FFB800]/40 bg-[#FFB800]/10 text-[#FFB800]'
              : 'border-[#1E293B] bg-[#111827] text-[#94A3B8] hover:text-[#F1F5F9]'
          }`}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            {safetyLock ? (
              <><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></>
            ) : (
              <><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 9.9-1" /></>
            )}
          </svg>
          {safetyLock ? 'SAFETY LOCKED' : 'Safety Lock Off'}
        </button>
      </div>

      {/* Auth Section */}
      <div className="mb-6 rounded-xl border border-[#1E293B] bg-[#111827] p-4">
        <h2 className="font-mono text-xs text-[#94A3B8] tracking-wider mb-3 flex items-center gap-2">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
          SMC CREDENTIALS
        </h2>
        <div className="flex gap-3 items-end">
          <div className="flex-1">
            <label className="block font-mono text-[10px] text-[#94A3B8] mb-1">USERNAME</label>
            <input
              value={smcUser}
              onChange={(e) => setSmcUser(e.target.value)}
              className="w-full rounded-lg border border-[#1E293B] bg-[#0A0E17] px-3 py-2 font-mono text-sm text-[#F1F5F9] focus:outline-none focus:border-[#00F0FF]/50 transition-colors"
              placeholder="ADMIN"
            />
          </div>
          <div className="flex-1">
            <label className="block font-mono text-[10px] text-[#94A3B8] mb-1">PASSWORD</label>
            <input
              type="password"
              value={smcPass}
              onChange={(e) => setSmcPass(e.target.value)}
              className="w-full rounded-lg border border-[#1E293B] bg-[#0A0E17] px-3 py-2 font-mono text-sm text-[#F1F5F9] focus:outline-none focus:border-[#00F0FF]/50 transition-colors"
              placeholder="********"
            />
          </div>
          <button
            onClick={encodeAuth}
            className="px-4 py-2 rounded-lg bg-[#00F0FF]/10 border border-[#00F0FF]/30 text-sm text-[#00F0FF] hover:bg-[#00F0FF]/20 transition-all font-mono shrink-0"
          >
            Save
          </button>
          {auth && <span className="text-[#00FF88] font-mono text-xs shrink-0 pb-2">Encoded</span>}
        </div>
      </div>

      {/* ── Power Management ────────────────────────────────────────────── */}
      <section className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-mono text-sm font-bold tracking-wider text-[#F1F5F9] flex items-center gap-2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#00F0FF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18.36 6.64a9 9 0 1 1-12.73 0" /><line x1="12" y1="2" x2="12" y2="12" />
            </svg>
            POWER MANAGEMENT
          </h2>
          <div className="flex gap-3">
            <button
              onClick={powerOnAll}
              disabled={safetyLock}
              className="px-3 py-1.5 rounded-lg bg-[#00FF88]/10 border border-[#00FF88]/30 text-xs text-[#00FF88] hover:bg-[#00FF88]/20 transition-all font-mono font-bold tracking-wider disabled:opacity-30 disabled:cursor-not-allowed"
            >
              Power On All
            </button>
            <button
              onClick={powerOffAll}
              disabled={safetyLock}
              className="px-3 py-1.5 rounded-lg bg-[#FF3B3B]/10 border border-[#FF3B3B]/30 text-xs text-[#FF3B3B] hover:bg-[#FF3B3B]/20 transition-all font-mono font-bold tracking-wider disabled:opacity-30 disabled:cursor-not-allowed"
            >
              Power Off All
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
          {machines.map((m) => {
            const ps = powerStates[m.id];
            const isOn = ps?.state === 'on';
            const isLoading = ps?.loading;

            return (
              <div
                key={m.id}
                className={`relative rounded-xl border p-4 transition-all duration-300 ${
                  isOn
                    ? 'border-[#00FF88]/30 bg-[#111827] shadow-[0_0_15px_rgba(0,255,136,0.08)]'
                    : 'border-[#1E293B] bg-[#111827]/60'
                }`}
              >
                {/* Power indicator */}
                <div className="flex items-center justify-between mb-3">
                  <div className={`h-3 w-3 rounded-full transition-colors ${
                    isOn ? 'bg-[#00FF88] shadow-[0_0_8px_rgba(0,255,136,0.6)]' : 'bg-[#94A3B8]/30'
                  }`} />
                  <span className={`font-mono text-[10px] font-bold tracking-wider ${isOn ? 'text-[#00FF88]' : 'text-[#94A3B8]/50'}`}>
                    {isOn ? 'ON' : ps?.state === 'off' ? 'OFF' : '---'}
                  </span>
                </div>

                {/* Hostname */}
                <p className="font-mono text-xs font-bold text-[#F1F5F9] truncate mb-1">{m.hostname}</p>
                <p className="font-mono text-[10px] text-[#94A3B8]/60 truncate mb-3">{m.ipAddress}</p>

                {/* Loading overlay */}
                {isLoading && (
                  <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-[#0A0E17]/70 backdrop-blur-sm z-10">
                    <div className="w-5 h-5 border-2 border-[#00F0FF] border-t-transparent rounded-full animate-spin" />
                  </div>
                )}

                {/* Action buttons */}
                <div className="flex gap-1.5">
                  <button
                    onClick={() => powerOn(m)}
                    disabled={safetyLock || isLoading}
                    title="Power On"
                    className="flex-1 rounded-md bg-[#00FF88]/10 py-1 text-[#00FF88] hover:bg-[#00FF88]/20 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" className="mx-auto"><polygon points="5,3 19,12 5,21" /></svg>
                  </button>
                  <button
                    onClick={() => {
                      setConfirmAction({
                        title: 'EMERGENCY POWER OFF',
                        message: `Power off ${m.hostname}? This is an emergency action.`,
                        danger: true,
                        action: async () => { setConfirmAction(null); await powerOff(m); },
                      });
                    }}
                    disabled={isLoading}
                    title="Power Off (EMERGENCY)"
                    className="flex-1 rounded-md bg-[#FF3B3B]/10 py-1 text-[#FF3B3B] hover:bg-[#FF3B3B]/20 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" className="mx-auto"><rect x="4" y="4" width="16" height="16" rx="2" /></svg>
                  </button>
                  <button
                    onClick={() => powerCycle(m)}
                    disabled={safetyLock || isLoading}
                    title="Power Cycle"
                    className="flex-1 rounded-md bg-[#FFB800]/10 py-1 text-[#FFB800] hover:bg-[#FFB800]/20 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="mx-auto"><polyline points="23 4 23 10 17 10" /><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" /></svg>
                  </button>
                </div>

                {/* Identify button */}
                <button
                  onClick={() => identify(m)}
                  className="mt-2 w-full rounded-md border border-[#1E293B] py-1 font-mono text-[10px] text-[#94A3B8] hover:text-[#00F0FF] hover:border-[#00F0FF]/30 transition-all"
                >
                  Find My Server
                </button>
              </div>
            );
          })}

          {machines.length === 0 && (
            <div className="col-span-full flex items-center justify-center py-16 rounded-xl border border-dashed border-[#1E293B] bg-[#111827]/30">
              <p className="text-sm text-[#94A3B8]">No servers discovered</p>
            </div>
          )}
        </div>
      </section>

      {/* ── OLED Messaging ──────────────────────────────────────────────── */}
      <section className="mb-8">
        <h2 className="font-mono text-sm font-bold tracking-wider text-[#F1F5F9] mb-4 flex items-center gap-2">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#00F0FF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="3" width="20" height="14" rx="2" ry="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" />
          </svg>
          OLED MESSAGING
        </h2>
        <div className="rounded-xl border border-[#1E293B] bg-[#111827] p-5">
          {/* Templates */}
          <div className="flex gap-2 mb-4 flex-wrap">
            {(['SHOW LIVE', 'DO NOT TOUCH', 'MAINTENANCE', 'custom'] as OLEDTemplate[]).map((t) => (
              <button
                key={t}
                onClick={() => handleTemplateSelect(t)}
                className={`px-3 py-1.5 rounded-lg border font-mono text-xs transition-all ${
                  oledTemplate === t
                    ? 'border-[#00F0FF]/40 bg-[#00F0FF]/10 text-[#00F0FF]'
                    : 'border-[#1E293B] text-[#94A3B8] hover:text-[#F1F5F9] hover:border-[#94A3B8]'
                }`}
              >
                {t === 'custom' ? 'Custom' : t}
              </button>
            ))}
          </div>

          {/* Message input */}
          <div className="relative mb-4">
            <textarea
              value={oledTemplate === 'custom' ? oledMessage : oledTemplate}
              onChange={(e) => {
                if (oledTemplate === 'custom') {
                  setOledMessage(e.target.value.slice(0, 200));
                }
              }}
              readOnly={oledTemplate !== 'custom'}
              rows={3}
              maxLength={200}
              className="w-full rounded-lg border border-[#1E293B] bg-[#0A0E17] px-4 py-3 font-mono text-sm text-[#F1F5F9] focus:outline-none focus:border-[#00F0FF]/50 transition-colors resize-none"
              placeholder="Type your message..."
            />
            <span className={`absolute bottom-2 right-3 font-mono text-[10px] ${activeMessage.length > 180 ? 'text-[#FFB800]' : 'text-[#94A3B8]/50'}`}>
              {activeMessage.length}/200
            </span>
          </div>

          {/* Target & Duration */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block font-mono text-[10px] text-[#94A3B8] tracking-wider mb-1.5">TARGET</label>
              <select
                value={oledTarget}
                onChange={(e) => setOledTarget(e.target.value)}
                className="w-full rounded-lg border border-[#1E293B] bg-[#0A0E17] px-3 py-2 font-mono text-sm text-[#F1F5F9] focus:outline-none focus:border-[#00F0FF]/50 transition-colors"
              >
                <option value="all">All Servers</option>
                {machines.map((m) => (
                  <option key={m.id} value={m.id}>{m.hostname}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-mono text-[10px] text-[#94A3B8] tracking-wider mb-1.5">DURATION: {oledDuration}s</label>
              <input
                type="range"
                min={5}
                max={120}
                value={oledDuration}
                onChange={(e) => setOledDuration(parseInt(e.target.value))}
                className="w-full accent-[#00F0FF] mt-1"
              />
            </div>
            <div className="flex items-end">
              <button
                onClick={sendOLED}
                disabled={oledSending || !activeMessage}
                className="w-full px-4 py-2 rounded-lg bg-[#00F0FF]/10 border border-[#00F0FF]/30 text-sm text-[#00F0FF] hover:bg-[#00F0FF]/20 transition-all font-mono font-bold tracking-wider disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {oledSending && <div className="w-3.5 h-3.5 border-2 border-[#00F0FF] border-t-transparent rounded-full animate-spin" />}
                SEND
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ── LED Strip Control ───────────────────────────────────────────── */}
      <section>
        <h2 className="font-mono text-sm font-bold tracking-wider text-[#F1F5F9] mb-4 flex items-center gap-2">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#00F0FF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="5" /><line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" /><line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" /><line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" /><line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
          </svg>
          LED STRIP CONTROL
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {machines.map((m) => (
            <div key={m.id} className="rounded-xl border border-[#1E293B] bg-[#111827] p-3 flex flex-col items-center gap-2">
              <p className="font-mono text-[11px] text-[#F1F5F9] truncate w-full text-center">{m.hostname}</p>
              <div
                className="w-full h-3 rounded-full border border-[#1E293B]"
                style={{ backgroundColor: ledColors[m.id] || '#1E293B' }}
              />
              <input
                type="color"
                value={ledColors[m.id] || '#00F0FF'}
                onChange={(e) => setLedColors((prev) => ({ ...prev, [m.id]: e.target.value }))}
                className="w-8 h-8 rounded-lg border-none cursor-pointer bg-transparent"
                title="Pick LED color"
              />
            </div>
          ))}
        </div>
      </section>

      {/* Confirm Modal */}
      {confirmAction && (
        <ConfirmModal
          title={confirmAction.title}
          message={confirmAction.message}
          danger={confirmAction.danger}
          onConfirm={confirmAction.action}
          onCancel={() => setConfirmAction(null)}
        />
      )}
    </div>
  );
}
