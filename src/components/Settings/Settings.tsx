import { useState, useEffect, useCallback } from 'react';
import { useAppContext } from '@/store/AppContext';

// ── Types ────────────────────────────────────────────────────────────────────

interface SettingsState {
  pollInterval: number;
  pollingEnabled: boolean;
  fpsThreshold: number;
  tempThreshold: number;
  desktopNotifications: boolean;
  apiPort: number;
  smcUser: string;
  smcPass: string;
  retentionDays: number;
}

const DEFAULT_SETTINGS: SettingsState = {
  pollInterval: 10,
  pollingEnabled: true,
  fpsThreshold: 30,
  tempThreshold: 80,
  desktopNotifications: true,
  apiPort: 80,
  smcUser: '',
  smcPass: '',
  retentionDays: 30,
};

// ── Section wrapper ──────────────────────────────────────────────────────────

function Section({ title, icon, children }: { title: string; icon: JSX.Element; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-[#1E293B] bg-[#111827] p-5 mb-6">
      <h2 className="font-mono text-xs font-bold tracking-[0.2em] text-[#00F0FF] mb-5 flex items-center gap-2">
        {icon}
        {title}
      </h2>
      {children}
    </div>
  );
}

// ── Toggle ───────────────────────────────────────────────────────────────────

function Toggle({ value, onChange, label }: { value: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      onClick={() => onChange(!value)}
      className="flex items-center gap-3 group"
    >
      <div className={`relative w-10 h-5 rounded-full transition-colors ${value ? 'bg-[#00F0FF]/30' : 'bg-[#1E293B]'}`}>
        <div className={`absolute top-0.5 w-4 h-4 rounded-full transition-all ${
          value ? 'left-5.5 bg-[#00F0FF] shadow-[0_0_8px_rgba(0,240,255,0.5)]' : 'left-0.5 bg-[#94A3B8]'
        }`} style={{ left: value ? '22px' : '2px' }} />
      </div>
      <span className="font-mono text-sm text-[#F1F5F9] group-hover:text-[#00F0FF] transition-colors">{label}</span>
    </button>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────

export default function Settings() {
  const { dispatch } = useAppContext();
  const [settings, setSettings] = useState<SettingsState>(DEFAULT_SETTINGS);
  const [saved, setSaved] = useState(false);
  const [purging, setPurging] = useState(false);

  // Load settings
  useEffect(() => {
    const load = async () => {
      const keys: (keyof SettingsState)[] = [
        'pollInterval', 'pollingEnabled', 'fpsThreshold', 'tempThreshold',
        'desktopNotifications', 'apiPort', 'smcUser', 'smcPass', 'retentionDays',
      ];
      const loaded: Record<string, string | null> = {};
      for (const k of keys) {
        try {
          loaded[k] = await window.d3watch.settings.get(k);
        } catch {
          loaded[k] = null;
        }
      }
      setSettings({
        pollInterval: loaded.pollInterval ? parseInt(loaded.pollInterval) : DEFAULT_SETTINGS.pollInterval,
        pollingEnabled: loaded.pollingEnabled !== null ? loaded.pollingEnabled === 'true' : DEFAULT_SETTINGS.pollingEnabled,
        fpsThreshold: loaded.fpsThreshold ? parseInt(loaded.fpsThreshold) : DEFAULT_SETTINGS.fpsThreshold,
        tempThreshold: loaded.tempThreshold ? parseInt(loaded.tempThreshold) : DEFAULT_SETTINGS.tempThreshold,
        desktopNotifications: loaded.desktopNotifications !== null ? loaded.desktopNotifications === 'true' : DEFAULT_SETTINGS.desktopNotifications,
        apiPort: loaded.apiPort ? parseInt(loaded.apiPort) : DEFAULT_SETTINGS.apiPort,
        smcUser: loaded.smcUser ?? '',
        smcPass: loaded.smcPass ?? '',
        retentionDays: loaded.retentionDays ? parseInt(loaded.retentionDays) : DEFAULT_SETTINGS.retentionDays,
      });
    };
    load();
  }, []);

  const update = <K extends keyof SettingsState>(key: K, value: SettingsState[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  };

  const saveAll = useCallback(async () => {
    const entries: [string, string][] = [
      ['pollInterval', String(settings.pollInterval)],
      ['pollingEnabled', String(settings.pollingEnabled)],
      ['fpsThreshold', String(settings.fpsThreshold)],
      ['tempThreshold', String(settings.tempThreshold)],
      ['desktopNotifications', String(settings.desktopNotifications)],
      ['apiPort', String(settings.apiPort)],
      ['smcUser', settings.smcUser],
      ['smcPass', settings.smcPass],
      ['retentionDays', String(settings.retentionDays)],
    ];

    // Encode and store SMC auth
    if (settings.smcUser && settings.smcPass) {
      const encoded = btoa(`${settings.smcUser}:${settings.smcPass}`);
      entries.push(['smcAuth', encoded]);
    }

    for (const [k, v] of entries) {
      await window.d3watch.settings.set(k, v);
    }

    // Apply polling changes
    await window.d3watch.poller.setInterval(settings.pollInterval * 1000);
    dispatch({ type: 'SET_POLLING', payload: { isPolling: settings.pollingEnabled, interval: settings.pollInterval * 1000 } });

    if (settings.pollingEnabled) {
      await window.d3watch.poller.start();
    } else {
      await window.d3watch.poller.stop();
    }

    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }, [settings, dispatch]);

  const purgeData = useCallback(async () => {
    setPurging(true);
    // A real implementation would call a purge API; here we just simulate
    await new Promise((r) => setTimeout(r, 1500));
    setPurging(false);
  }, []);

  return (
    <div className="h-full overflow-y-auto custom-scrollbar p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-mono text-2xl font-bold tracking-widest text-[#F1F5F9]">
            SETTINGS
          </h1>
          <p className="font-mono text-xs text-[#94A3B8] mt-1">
            Configure d3Watch behavior and thresholds
          </p>
        </div>
        <button
          onClick={saveAll}
          className={`px-6 py-2.5 rounded-xl border text-sm font-mono font-bold tracking-wider transition-all flex items-center gap-2 ${
            saved
              ? 'border-[#00FF88]/40 bg-[#00FF88]/10 text-[#00FF88]'
              : 'border-[#00F0FF]/30 bg-[#00F0FF]/10 text-[#00F0FF] hover:bg-[#00F0FF]/20'
          }`}
        >
          {saved ? (
            <>
              <span className="text-[#00FF88]">{'\u2713'}</span>
              SAVED
            </>
          ) : (
            'SAVE SETTINGS'
          )}
        </button>
      </div>

      <div className="max-w-3xl">
        {/* ── Polling ─────────────────────────────────────────────────── */}
        <Section
          title="POLLING"
          icon={
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
            </svg>
          }
        >
          <div className="space-y-5">
            <Toggle
              value={settings.pollingEnabled}
              onChange={(v) => update('pollingEnabled', v)}
              label="Enable auto-polling"
            />
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="font-mono text-sm text-[#F1F5F9]">Poll Interval</label>
                <span className="font-mono text-sm text-[#00F0FF] tabular-nums">{settings.pollInterval}s</span>
              </div>
              <input
                type="range"
                min={5}
                max={60}
                step={5}
                value={settings.pollInterval}
                onChange={(e) => update('pollInterval', parseInt(e.target.value))}
                disabled={!settings.pollingEnabled}
                className="w-full accent-[#00F0FF] disabled:opacity-30"
              />
              <div className="flex justify-between mt-1">
                <span className="font-mono text-[10px] text-[#94A3B8]/50">5s</span>
                <span className="font-mono text-[10px] text-[#94A3B8]/50">60s</span>
              </div>
            </div>
          </div>
        </Section>

        {/* ── Alerts ──────────────────────────────────────────────────── */}
        <Section
          title="ALERTS"
          icon={
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
          }
        >
          <div className="space-y-5">
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="font-mono text-sm text-[#F1F5F9]">FPS Threshold</label>
                <span className="font-mono text-sm text-[#FFB800] tabular-nums">{settings.fpsThreshold} fps</span>
              </div>
              <input
                type="range"
                min={10}
                max={60}
                value={settings.fpsThreshold}
                onChange={(e) => update('fpsThreshold', parseInt(e.target.value))}
                className="w-full accent-[#FFB800]"
              />
              <p className="font-mono text-[10px] text-[#94A3B8]/50 mt-1">Alert when FPS drops below this value</p>
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="font-mono text-sm text-[#F1F5F9]">Temperature Threshold</label>
                <span className={`font-mono text-sm tabular-nums ${settings.tempThreshold >= 85 ? 'text-[#FF3B3B]' : 'text-[#FFB800]'}`}>
                  {settings.tempThreshold}&deg;C
                </span>
              </div>
              <input
                type="range"
                min={60}
                max={100}
                value={settings.tempThreshold}
                onChange={(e) => update('tempThreshold', parseInt(e.target.value))}
                className="w-full accent-[#FFB800]"
              />
              <p className="font-mono text-[10px] text-[#94A3B8]/50 mt-1">Alert when any sensor exceeds this temperature</p>
            </div>
            <Toggle
              value={settings.desktopNotifications}
              onChange={(v) => update('desktopNotifications', v)}
              label="Desktop notifications"
            />
          </div>
        </Section>

        {/* ── Network ─────────────────────────────────────────────────── */}
        <Section
          title="NETWORK"
          icon={
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="2" width="20" height="8" rx="2" ry="2" /><rect x="2" y="14" width="20" height="8" rx="2" ry="2" />
              <line x1="6" y1="6" x2="6.01" y2="6" /><line x1="6" y1="18" x2="6.01" y2="18" />
            </svg>
          }
        >
          <div className="space-y-4">
            <div>
              <label className="block font-mono text-[10px] text-[#94A3B8] tracking-wider mb-1.5">DEFAULT API PORT</label>
              <input
                type="number"
                value={settings.apiPort}
                onChange={(e) => update('apiPort', parseInt(e.target.value) || 80)}
                className="w-32 rounded-lg border border-[#1E293B] bg-[#0A0E17] px-3 py-2 font-mono text-sm text-[#F1F5F9] focus:outline-none focus:border-[#00F0FF]/50 transition-colors"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block font-mono text-[10px] text-[#94A3B8] tracking-wider mb-1.5">SMC USERNAME</label>
                <input
                  value={settings.smcUser}
                  onChange={(e) => update('smcUser', e.target.value)}
                  className="w-full rounded-lg border border-[#1E293B] bg-[#0A0E17] px-3 py-2 font-mono text-sm text-[#F1F5F9] focus:outline-none focus:border-[#00F0FF]/50 transition-colors"
                  placeholder="ADMIN"
                />
              </div>
              <div>
                <label className="block font-mono text-[10px] text-[#94A3B8] tracking-wider mb-1.5">SMC PASSWORD</label>
                <input
                  type="password"
                  value={settings.smcPass}
                  onChange={(e) => update('smcPass', e.target.value)}
                  className="w-full rounded-lg border border-[#1E293B] bg-[#0A0E17] px-3 py-2 font-mono text-sm text-[#F1F5F9] focus:outline-none focus:border-[#00F0FF]/50 transition-colors"
                  placeholder="********"
                />
              </div>
            </div>
          </div>
        </Section>

        {/* ── Data Retention ──────────────────────────────────────────── */}
        <Section
          title="DATA RETENTION"
          icon={
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
            </svg>
          }
        >
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="font-mono text-sm text-[#F1F5F9]">Keep snapshots for</label>
                <span className="font-mono text-sm text-[#00F0FF] tabular-nums">{settings.retentionDays} days</span>
              </div>
              <input
                type="range"
                min={7}
                max={90}
                value={settings.retentionDays}
                onChange={(e) => update('retentionDays', parseInt(e.target.value))}
                className="w-full accent-[#00F0FF]"
              />
              <div className="flex justify-between mt-1">
                <span className="font-mono text-[10px] text-[#94A3B8]/50">7 days</span>
                <span className="font-mono text-[10px] text-[#94A3B8]/50">90 days</span>
              </div>
            </div>
            <button
              onClick={purgeData}
              disabled={purging}
              className="px-4 py-2 rounded-lg border border-[#FF3B3B]/30 text-sm text-[#FF3B3B] hover:bg-[#FF3B3B]/10 transition-all font-mono flex items-center gap-2 disabled:opacity-50"
            >
              {purging && <div className="w-3.5 h-3.5 border-2 border-[#FF3B3B] border-t-transparent rounded-full animate-spin" />}
              {purging ? 'Purging...' : 'Purge Old Data'}
            </button>
          </div>
        </Section>

        {/* ── About ───────────────────────────────────────────────────── */}
        <Section
          title="ABOUT"
          icon={
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
          }
        >
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-mono text-sm text-[#94A3B8]">Version</span>
              <span className="font-mono text-sm text-[#F1F5F9]">d3Watch v1.0.0</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="font-mono text-sm text-[#94A3B8]">Electron</span>
              <span className="font-mono text-sm text-[#F1F5F9]">v28.x</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="font-mono text-sm text-[#94A3B8]">Platform</span>
              <span className="font-mono text-sm text-[#F1F5F9]">Windows x64</span>
            </div>
            <div className="border-t border-[#1E293B] pt-3 mt-3">
              <div className="flex gap-4">
                <a
                  href="https://github.com/nicholasgasior/disguise-d3watch"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-xs text-[#00F0FF] hover:text-[#00F0FF]/80 transition-colors flex items-center gap-1.5"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" /></svg>
                  GitHub
                </a>
                <a
                  href="https://disguise.one"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-xs text-[#E91E8C] hover:text-[#E91E8C]/80 transition-colors"
                >
                  disguise.one
                </a>
              </div>
            </div>
          </div>
        </Section>
      </div>
    </div>
  );
}
