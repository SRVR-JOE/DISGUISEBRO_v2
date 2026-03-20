#!/usr/bin/env node
/**
 * d3Watch Connection Check
 *
 * Quick connectivity check for Disguise servers.
 * Tests reachability, d3service, Designer session, and SMC.
 *
 * Usage:
 *   npx tsx tests/connection-check.ts <server-ip>
 */

// ─── Colors ──────────────────────────────────────────────────────────────────

const colors = {
  green: (s: string) => `\x1b[32m${s}\x1b[0m`,
  red: (s: string) => `\x1b[31m${s}\x1b[0m`,
  yellow: (s: string) => `\x1b[33m${s}\x1b[0m`,
  bold: (s: string) => `\x1b[1m${s}\x1b[0m`,
  dim: (s: string) => `\x1b[2m${s}\x1b[0m`,
};

const PASS = colors.green('\u2713');
const FAIL = colors.red('\u2717');
const WARN = colors.yellow('?');
const TIMEOUT_MS = 5000;
const DEFAULT_SMC_IP = '172.31.250.9';

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function fetchWithTimeout(url: string, options: RequestInit = {}): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function fetchJson(url: string): Promise<{ ok: boolean; status: number; data: unknown }> {
  try {
    const res = await fetchWithTimeout(url);
    const text = await res.text();
    let data: unknown;
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
    return { ok: res.ok, status: res.status, data };
  } catch {
    return { ok: false, status: 0, data: null };
  }
}

// ─── Checks ──────────────────────────────────────────────────────────────────

interface CheckResult {
  label: string;
  passed: boolean;
  partial?: boolean;
  detail: string;
}

async function checkServerReachable(ip: string): Promise<CheckResult> {
  const label = 'Server reachable';
  try {
    const res = await fetchWithTimeout(`http://${ip}:80`, { method: 'HEAD' });
    // Any response (even 404) means the server is reachable
    return { label, passed: true, detail: `HTTP ${res.status}` };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('abort')) {
      return { label, passed: false, detail: 'timed out after 5s' };
    }
    return { label, passed: false, detail: msg.replace(/^.*Error:\s*/, '') };
  }
}

async function checkD3Service(ip: string): Promise<CheckResult> {
  const label = 'd3service running';
  const { ok, data } = await fetchJson(`http://${ip}:80/api/service/system/detectsystems`);
  if (!ok || !Array.isArray(data)) {
    return { label, passed: false, detail: 'could not reach detectsystems endpoint' };
  }
  if (data.length === 0) {
    return { label, passed: true, detail: 'reachable, 0 machines found' };
  }
  const names = data
    .map((m: Record<string, unknown>) => m.hostname)
    .slice(0, 5)
    .join(', ');
  return { label, passed: true, detail: `${data.length} machine(s) found — ${names}` };
}

async function checkDesignerSession(ip: string): Promise<CheckResult> {
  const label = 'Designer session';
  const { ok, status, data } = await fetchJson(`http://${ip}:80/api/session/status/health`);
  if (!ok) {
    if (status === 404 || status === 503) {
      return { label, passed: false, detail: 'no active session' };
    }
    return { label, passed: false, detail: status === 0 ? 'unreachable' : `HTTP ${status}` };
  }
  const obj = data as Record<string, unknown>;
  const fps = obj.averageFPS ?? obj.fps ?? '?';
  return { label, passed: true, detail: `active (FPS: ${fps})` };
}

async function checkSmc(smcIp: string): Promise<CheckResult> {
  const label = `SMC (${smcIp})`;
  // Try localmachine first for identity info
  const { ok: lmOk, data: lmData } = await fetchJson(`http://${smcIp}:80/api/localmachine`);

  if (!lmOk) {
    // Maybe it's just not reachable
    try {
      await fetchWithTimeout(`http://${smcIp}:80`, { method: 'HEAD' });
    } catch {
      return { label, passed: false, detail: 'unreachable' };
    }
    return { label, passed: false, detail: 'reachable but API not responding' };
  }

  const obj = lmData as Record<string, unknown>;
  const type = obj.type ?? obj.machineType ?? 'unknown';
  const hostname = obj.hostname ?? '';

  // Try to get firmware version
  const { ok: remOk, data: remData } = await fetchJson(`http://${smcIp}:80/api/remora`);
  let fw = '';
  if (remOk && typeof remData === 'object' && remData !== null) {
    const r = remData as Record<string, unknown>;
    fw = String(r.firmwareVersion ?? r.version ?? '');
  }

  const detail = [hostname, type, fw ? `firmware ${fw}` : ''].filter(Boolean).join(', ');
  return { label, passed: true, detail };
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    console.log('');
    console.log('Usage: npx tsx tests/connection-check.ts <server-ip> [--smc <smc-ip>]');
    console.log('');
    console.log('By default, also checks SMC at 172.31.250.9');
    console.log('');
    process.exit(0);
  }

  const serverIp = args[0];

  // Parse optional SMC IP
  let smcIp = DEFAULT_SMC_IP;
  const smcIdx = args.indexOf('--smc');
  if (smcIdx !== -1 && args[smcIdx + 1]) {
    smcIp = args[smcIdx + 1];
  }
  const noSmc = args.includes('--no-smc');

  console.log('');
  console.log(colors.bold(`d3Watch Connection Check \u2014 ${serverIp}`));

  const results: CheckResult[] = [];

  // 1. Server reachability
  const serverResult = await checkServerReachable(serverIp);
  results.push(serverResult);

  // 2. d3service
  if (serverResult.passed) {
    results.push(await checkD3Service(serverIp));
  } else {
    results.push({ label: 'd3service running', passed: false, detail: 'server unreachable' });
  }

  // 3. Designer session
  if (serverResult.passed) {
    results.push(await checkDesignerSession(serverIp));
  } else {
    results.push({ label: 'Designer session', passed: false, detail: 'server unreachable' });
  }

  // 4. SMC
  if (!noSmc) {
    results.push(await checkSmc(smcIp));
  }

  // Print results
  const maxLabel = Math.max(...results.map((r) => r.label.length));
  for (const r of results) {
    const icon = r.passed ? PASS : FAIL;
    const paddedLabel = (r.label + ':').padEnd(maxLabel + 2);
    const detail = r.passed ? r.detail : colors.red(r.detail);
    console.log(`  ${paddedLabel} ${icon} (${detail})`);
  }

  // Summary
  const allPassed = results.every((r) => r.passed);
  const allFailed = results.every((r) => !r.passed);
  const passedCount = results.filter((r) => r.passed).length;

  console.log('');
  if (allPassed) {
    console.log(colors.green('Status: GO \u2014 all checks passed'));
  } else if (allFailed) {
    console.log(colors.red('Status: NO-GO \u2014 all checks failed'));
  } else {
    const failedNames = results
      .filter((r) => !r.passed)
      .map((r) => r.label)
      .join(', ');
    console.log(
      colors.yellow(
        `Status: PARTIAL \u2014 ${passedCount}/${results.length} passed (${failedNames} not available, monitoring will be limited)`,
      ),
    );
  }

  console.log('');

  if (!allPassed) process.exit(1);
}

main().catch((err) => {
  console.error(colors.red(`Fatal error: ${err.message}`));
  process.exit(2);
});
