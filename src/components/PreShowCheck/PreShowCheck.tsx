import { useState, useCallback } from 'react';
import { useAppContext } from '@/store/AppContext';
import type { Machine } from '@/types';

// ── Types ────────────────────────────────────────────────────────────────────

interface CheckItem {
  id: string;
  label: string;
  status: 'pending' | 'running' | 'pass' | 'fail' | 'warn';
  detail: string;
}

type OverallStatus = 'idle' | 'running' | 'GO' | 'NO-GO';

const INITIAL_CHECKS: CheckItem[] = [
  { id: 'discover', label: 'Discovering servers...', status: 'pending', detail: '' },
  { id: 'power', label: 'Verifying power states...', status: 'pending', detail: '' },
  { id: 'hostname', label: 'Checking hostnames...', status: 'pending', detail: '' },
  { id: 'network', label: 'Validating network config...', status: 'pending', detail: '' },
  { id: 'vfc', label: 'VFC card verification...', status: 'pending', detail: '' },
  { id: 'health', label: 'Health status check...', status: 'pending', detail: '' },
  { id: 'temperature', label: 'Temperature check...', status: 'pending', detail: '' },
];

// ── Helpers ──────────────────────────────────────────────────────────────────

function statusIcon(status: CheckItem['status']): JSX.Element {
  switch (status) {
    case 'pass':
      return <span className="text-[#00FF88] text-lg font-bold">{'\u2713'}</span>;
    case 'fail':
      return <span className="text-[#FF3B3B] text-lg font-bold">{'\u2717'}</span>;
    case 'warn':
      return <span className="text-[#FFB800] text-lg font-bold">!</span>;
    case 'running':
      return <div className="w-4 h-4 border-2 border-[#00F0FF] border-t-transparent rounded-full animate-spin" />;
    default:
      return <span className="w-4 h-4 rounded-full border border-[#94A3B8]/30" />;
  }
}

function statusColor(status: CheckItem['status']): string {
  switch (status) {
    case 'pass': return 'border-[#00FF88]/20 bg-[#00FF88]/5';
    case 'fail': return 'border-[#FF3B3B]/20 bg-[#FF3B3B]/5';
    case 'warn': return 'border-[#FFB800]/20 bg-[#FFB800]/5';
    case 'running': return 'border-[#00F0FF]/20 bg-[#00F0FF]/5';
    default: return 'border-[#1E293B] bg-transparent';
  }
}

// ── Main Component ───────────────────────────────────────────────────────────

export default function PreShowCheck() {
  const { machines } = useAppContext();
  const [checks, setChecks] = useState<CheckItem[]>(INITIAL_CHECKS);
  const [overall, setOverall] = useState<OverallStatus>('idle');
  const [pushingOLED, setPushingOLED] = useState(false);

  const updateCheck = (id: string, updates: Partial<CheckItem>) => {
    setChecks((prev) => prev.map((c) => (c.id === id ? { ...c, ...updates } : c)));
  };

  const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

  const runChecks = useCallback(async () => {
    // Reset
    setChecks(INITIAL_CHECKS.map((c) => ({ ...c })));
    setOverall('running');
    let hasFailure = false;

    // 1. Discover servers
    updateCheck('discover', { status: 'running' });
    await delay(400);
    const onlineMachines: Machine[] = machines.filter((m) => m.isOnline);
    if (onlineMachines.length === 0) {
      updateCheck('discover', { status: 'fail', detail: 'No online servers found' });
      hasFailure = true;
    } else {
      updateCheck('discover', { status: 'pass', detail: `${onlineMachines.length} server(s) online out of ${machines.length}` });
      if (onlineMachines.length < machines.length) {
        updateCheck('discover', { status: 'warn', detail: `${onlineMachines.length}/${machines.length} servers online - ${machines.length - onlineMachines.length} offline` });
      }
    }

    // 2. Verify power states
    updateCheck('power', { status: 'running' });
    await delay(300);
    let powerFails = 0;
    for (const m of machines) {
      if (m.smcIp) {
        try {
          const result = await window.d3watch.smc.getPowerStatus(m.smcIp);
          if (result.state !== 'on') powerFails++;
        } catch {
          powerFails++;
        }
      }
    }
    if (powerFails > 0) {
      updateCheck('power', { status: 'fail', detail: `${powerFails} server(s) not powered on` });
      hasFailure = true;
    } else {
      updateCheck('power', { status: 'pass', detail: 'All servers powered on' });
    }

    // 3. Check hostnames
    updateCheck('hostname', { status: 'running' });
    await delay(200);
    const hostnames = machines.map((m) => m.hostname);
    const dupes = hostnames.filter((h, i) => hostnames.indexOf(h) !== i);
    if (dupes.length > 0) {
      updateCheck('hostname', { status: 'fail', detail: `Duplicate hostnames: ${[...new Set(dupes)].join(', ')}` });
      hasFailure = true;
    } else {
      updateCheck('hostname', { status: 'pass', detail: `${hostnames.length} unique hostname(s) verified` });
    }

    // 4. Validate network config
    updateCheck('network', { status: 'running' });
    let netIssues = 0;
    for (const m of onlineMachines) {
      try {
        const adapters = await window.d3watch.api.getNetworkAdapters(m.ipAddress);
        const noIp = adapters.filter((a) => a.enabled && a.addresses.length === 0);
        netIssues += noIp.length;
      } catch {
        netIssues++;
      }
    }
    if (netIssues > 0) {
      updateCheck('network', { status: 'warn', detail: `${netIssues} adapter(s) with missing IP configuration` });
    } else {
      updateCheck('network', { status: 'pass', detail: 'All network adapters configured' });
    }

    // 5. VFC card verification
    updateCheck('vfc', { status: 'running' });
    let vfcTotal = 0;
    let vfcErrors = 0;
    for (const m of onlineMachines) {
      try {
        const vfcData = await window.d3watch.api.getVFCs(m.ipAddress);
        vfcTotal += vfcData.cards.length;
      } catch {
        vfcErrors++;
      }
    }
    if (vfcErrors > 0) {
      updateCheck('vfc', { status: 'warn', detail: `${vfcTotal} card(s) found, ${vfcErrors} server(s) unreachable` });
    } else {
      updateCheck('vfc', { status: 'pass', detail: `${vfcTotal} VFC card(s) detected across fleet` });
    }

    // 6. Health status check
    updateCheck('health', { status: 'running' });
    let criticals = 0;
    let warnings = 0;
    for (const m of onlineMachines) {
      try {
        const health = await window.d3watch.api.getHealth(m.ipAddress);
        for (const s of health.states) {
          if (s.severity === 'critical') criticals++;
          if (s.severity === 'warning') warnings++;
        }
      } catch {
        criticals++;
      }
    }
    if (criticals > 0) {
      updateCheck('health', { status: 'fail', detail: `${criticals} critical issue(s), ${warnings} warning(s)` });
      hasFailure = true;
    } else if (warnings > 0) {
      updateCheck('health', { status: 'warn', detail: `${warnings} warning(s), no critical issues` });
    } else {
      updateCheck('health', { status: 'pass', detail: 'All systems healthy' });
    }

    // 7. Temperature check
    updateCheck('temperature', { status: 'running' });
    let tempAlerts = 0;
    for (const m of onlineMachines) {
      if (!m.smcIp) continue;
      try {
        const chassis = await window.d3watch.smc.getChassisStats(m.smcIp);
        for (const t of chassis.temperatures) {
          if (t.value > 85) tempAlerts++;
        }
      } catch {
        // ignore unreachable SMC
      }
    }
    if (tempAlerts > 0) {
      updateCheck('temperature', { status: 'fail', detail: `${tempAlerts} sensor(s) above 85\u00B0C threshold` });
      hasFailure = true;
    } else {
      updateCheck('temperature', { status: 'pass', detail: 'All temperatures within normal range' });
    }

    setOverall(hasFailure ? 'NO-GO' : 'GO');
  }, [machines]);

  const pushToOLED = useCallback(async () => {
    setPushingOLED(true);
    const message = overall === 'GO' ? 'PRE-SHOW: GO' : 'PRE-SHOW: NO-GO';
    const auth = (await window.d3watch.settings.get('smcAuth')) ?? '';
    try {
      for (const m of machines) {
        const smcIp = m.smcIp ?? m.ipAddress;
        await window.d3watch.smc.sendOLED(smcIp, message, auth);
      }
    } catch {
      // silently fail
    }
    setPushingOLED(false);
  }, [machines, overall]);

  const exportReport = useCallback(() => {
    const report = {
      timestamp: new Date().toISOString(),
      overall,
      checks: checks.map((c) => ({ label: c.label, status: c.status, detail: c.detail })),
      machines: machines.map((m) => ({ hostname: m.hostname, ip: m.ipAddress, online: m.isOnline })),
    };
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `preshow-check-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [checks, machines, overall]);

  return (
    <div className="h-full overflow-y-auto custom-scrollbar p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-mono text-2xl font-bold tracking-widest text-[#F1F5F9]">
            PRE-SHOW CHECK
          </h1>
          <p className="font-mono text-xs text-[#94A3B8] mt-1">
            Automated health verification for show readiness
          </p>
        </div>
        <button
          onClick={runChecks}
          disabled={overall === 'running'}
          className="px-6 py-3 rounded-xl bg-[#00F0FF]/10 border border-[#00F0FF]/40 text-[#00F0FF] hover:bg-[#00F0FF]/20 transition-all font-mono font-bold tracking-widest text-sm disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_20px_rgba(0,240,255,0.1)] hover:shadow-[0_0_30px_rgba(0,240,255,0.2)] flex items-center gap-3"
        >
          {overall === 'running' && (
            <div className="w-4 h-4 border-2 border-[#00F0FF] border-t-transparent rounded-full animate-spin" />
          )}
          {overall === 'running' ? 'RUNNING...' : 'RUN PRE-SHOW CHECK'}
        </button>
      </div>

      {/* Checklist */}
      <div className="max-w-2xl mx-auto space-y-3">
        {checks.map((check, i) => (
          <div
            key={check.id}
            className={`flex items-start gap-4 rounded-xl border p-4 transition-all duration-500 ${statusColor(check.status)}`}
            style={{ transitionDelay: `${i * 50}ms` }}
          >
            {/* Step number */}
            <div className="shrink-0 flex items-center justify-center w-8 h-8 rounded-full bg-[#0A0E17] border border-[#1E293B] font-mono text-xs text-[#94A3B8]">
              {i + 1}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <p className={`font-mono text-sm ${check.status === 'pending' ? 'text-[#94A3B8]' : 'text-[#F1F5F9]'}`}>
                {check.label}
              </p>
              {check.detail && (
                <p className={`font-mono text-xs mt-1 ${
                  check.status === 'fail' ? 'text-[#FF3B3B]' :
                  check.status === 'warn' ? 'text-[#FFB800]' :
                  check.status === 'pass' ? 'text-[#00FF88]/80' :
                  'text-[#94A3B8]'
                }`}>
                  {check.detail}
                </p>
              )}
            </div>

            {/* Status icon */}
            <div className="shrink-0 flex items-center justify-center w-8 h-8">
              {statusIcon(check.status)}
            </div>
          </div>
        ))}
      </div>

      {/* Overall Banner */}
      {(overall === 'GO' || overall === 'NO-GO') && (
        <div className="max-w-2xl mx-auto mt-8">
          <div
            className={`rounded-2xl border-2 p-8 text-center transition-all duration-700 ${
              overall === 'GO'
                ? 'border-[#00FF88] bg-[#00FF88]/5 shadow-[0_0_40px_rgba(0,255,136,0.15)]'
                : 'border-[#FF3B3B] bg-[#FF3B3B]/5 shadow-[0_0_40px_rgba(255,59,59,0.15)]'
            }`}
          >
            <p className={`font-mono text-5xl font-black tracking-[0.3em] ${
              overall === 'GO' ? 'text-[#00FF88]' : 'text-[#FF3B3B]'
            }`}>
              {overall}
            </p>
            <p className="font-mono text-sm text-[#94A3B8] mt-3">
              {overall === 'GO'
                ? 'All systems nominal. Clear for show.'
                : 'Issues detected. Review items above before proceeding.'}
            </p>

            {/* Actions */}
            <div className="flex gap-3 justify-center mt-6">
              <button
                onClick={pushToOLED}
                disabled={pushingOLED}
                className={`px-4 py-2 rounded-lg border text-sm font-mono font-bold tracking-wider transition-all flex items-center gap-2 ${
                  overall === 'GO'
                    ? 'border-[#00FF88]/30 bg-[#00FF88]/10 text-[#00FF88] hover:bg-[#00FF88]/20'
                    : 'border-[#FF3B3B]/30 bg-[#FF3B3B]/10 text-[#FF3B3B] hover:bg-[#FF3B3B]/20'
                } disabled:opacity-50`}
              >
                {pushingOLED && <div className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />}
                Push to OLEDs
              </button>
              <button
                onClick={exportReport}
                className="px-4 py-2 rounded-lg border border-[#1E293B] bg-[#111827] text-sm text-[#94A3B8] hover:text-[#F1F5F9] hover:border-[#94A3B8] transition-all font-mono flex items-center gap-2"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                Export Report
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Idle state */}
      {overall === 'idle' && (
        <div className="max-w-2xl mx-auto mt-12 flex flex-col items-center text-center">
          <div className="w-20 h-20 rounded-full border-2 border-dashed border-[#1E293B] flex items-center justify-center mb-4">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="opacity-40">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
          </div>
          <p className="font-mono text-sm text-[#94A3B8]">Ready to run pre-show checks</p>
          <p className="font-mono text-xs text-[#94A3B8]/50 mt-1">
            Click the button above to begin the automated verification process
          </p>
        </div>
      )}
    </div>
  );
}
