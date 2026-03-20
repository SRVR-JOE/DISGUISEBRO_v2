#!/usr/bin/env node
/**
 * d3Watch API Integration Test Suite
 *
 * Standalone script that tests all Disguise API endpoints against a real server.
 * No test framework required — uses native fetch and console output.
 *
 * Usage:
 *   npx tsx tests/api-test.ts <server-ip> [smc-ip]
 *   npx tsx tests/api-test.ts 10.0.0.1
 *   npx tsx tests/api-test.ts 10.0.0.1 172.31.250.9
 */

// ─── Types ───────────────────────────────────────────────────────────────────

interface TestResult {
  category: string;
  name: string;
  endpoint: string;
  passed: boolean;
  message: string;
  durationMs: number;
  error?: string;
}

// ─── Colors ──────────────────────────────────────────────────────────────────

const colors = {
  green: (s: string) => `\x1b[32m${s}\x1b[0m`,
  red: (s: string) => `\x1b[31m${s}\x1b[0m`,
  yellow: (s: string) => `\x1b[33m${s}\x1b[0m`,
  cyan: (s: string) => `\x1b[36m${s}\x1b[0m`,
  dim: (s: string) => `\x1b[2m${s}\x1b[0m`,
  bold: (s: string) => `\x1b[1m${s}\x1b[0m`,
};

// ─── APITester ───────────────────────────────────────────────────────────────

class APITester {
  private serverIp: string;
  private smcIp?: string;
  private port: number;
  private results: TestResult[] = [];
  private readonly TIMEOUT_MS = 5000;

  constructor(serverIp: string, smcIp?: string, port: number = 80) {
    this.serverIp = serverIp;
    this.smcIp = smcIp;
    this.port = port;
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  private baseUrl(ip?: string): string {
    const host = ip ?? this.serverIp;
    return `http://${host}:${this.port}`;
  }

  private async fetchWithTimeout(url: string): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.TIMEOUT_MS);
    try {
      const res = await fetch(url, { signal: controller.signal });
      return res;
    } finally {
      clearTimeout(timer);
    }
  }

  private async fetchJson(url: string): Promise<{ status: number; data: unknown }> {
    const res = await this.fetchWithTimeout(url);
    const text = await res.text();
    let data: unknown;
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
    return { status: res.status, data };
  }

  /** Check that an object has all expected keys with the specified types. */
  private validateShape(
    obj: Record<string, unknown>,
    schema: Record<string, string>,
  ): string | null {
    for (const [key, expectedType] of Object.entries(schema)) {
      if (!(key in obj)) return `missing field "${key}"`;
      const actual = Array.isArray(obj[key]) ? 'array' : typeof obj[key];
      if (actual !== expectedType) {
        return `field "${key}" expected ${expectedType}, got ${actual}`;
      }
    }
    return null;
  }

  private record(
    category: string,
    name: string,
    endpoint: string,
    passed: boolean,
    message: string,
    durationMs: number,
    error?: string,
  ): void {
    this.results.push({ category, name, endpoint, passed, message, durationMs, error });
  }

  private printResult(r: TestResult): void {
    const icon = r.passed ? colors.green('\u2713') : colors.red('\u2717');
    const label = r.passed ? r.name.padEnd(24) : colors.red(r.name.padEnd(24));
    const msg = r.passed ? r.message : colors.red(r.message);
    const time = colors.dim(`[${r.durationMs}ms]`.padStart(10));
    console.log(`  ${icon} ${label} ${msg}  ${time}`);
  }

  // ── Test wrappers ────────────────────────────────────────────────────────

  private async runTest(
    category: string,
    name: string,
    endpoint: string,
    ip: string | undefined,
    validate: (status: number, data: unknown) => string,
  ): Promise<void> {
    const url = `${this.baseUrl(ip)}${endpoint}`;
    const start = performance.now();
    try {
      const { status, data } = await this.fetchJson(url);
      const durationMs = Math.round(performance.now() - start);
      const msg = validate(status, data);
      if (msg.startsWith('FAIL:')) {
        this.record(category, name, endpoint, false, msg.slice(5).trim(), durationMs, msg);
        this.printResult(this.results[this.results.length - 1]);
      } else {
        this.record(category, name, endpoint, true, msg, durationMs);
        this.printResult(this.results[this.results.length - 1]);
      }
    } catch (err: unknown) {
      const durationMs = Math.round(performance.now() - start);
      const errMsg = err instanceof Error ? err.message : String(err);
      const short = errMsg.includes('abort')
        ? 'Request timed out (5s)'
        : errMsg.replace(/^.*Error:\s*/, '');
      this.record(category, name, endpoint, false, short, durationMs, errMsg);
      this.printResult(this.results[this.results.length - 1]);
    }
  }

  // ── Designer Service API Tests ───────────────────────────────────────────

  private async testDetectSystems(): Promise<void> {
    await this.runTest('DESIGNER SERVICE API', 'detectsystems', '/api/service/system/detectsystems', undefined, (status, data) => {
      if (status !== 200) return `FAIL: HTTP ${status}`;
      if (!Array.isArray(data)) return 'FAIL: Expected array response';
      if (data.length === 0) return 'No machines detected (empty array)';
      const first = data[0] as Record<string, unknown>;
      const shapeErr = this.validateShape(first, { hostname: 'string', type: 'string' });
      if (shapeErr) return `FAIL: ${shapeErr}`;
      const names = data.map((m: Record<string, unknown>) => m.hostname).join(', ');
      return `Found ${data.length} machine(s) (${names})`;
    });
  }

  private async testVfcs(): Promise<void> {
    await this.runTest('DESIGNER SERVICE API', 'vfcs', '/api/service/system/vfcs', undefined, (status, data) => {
      if (status !== 200) return `FAIL: HTTP ${status}`;
      if (typeof data !== 'object' || data === null) return 'FAIL: Expected object response';
      const obj = data as Record<string, unknown>;
      const cards = Array.isArray(obj.cards) ? obj.cards : [];
      const bpVer = obj.backplaneVersion ?? 'unknown';
      return `${cards.length} VFC card(s) detected, backplane v${bpVer}`;
    });
  }

  private async testGpuOutputs(): Promise<void> {
    await this.runTest('DESIGNER SERVICE API', 'gpuoutputs', '/api/service/system/gpuoutputs', undefined, (status, data) => {
      if (status !== 200) return `FAIL: HTTP ${status}`;
      if (!Array.isArray(data)) return 'FAIL: Expected array response';
      return `${data.length} GPU output(s) reported`;
    });
  }

  private async testNetworkAdapters(): Promise<void> {
    await this.runTest('DESIGNER SERVICE API', 'networkadapters', '/api/service/system/networkadapters', undefined, (status, data) => {
      if (status !== 200) return `FAIL: HTTP ${status}`;
      if (!Array.isArray(data)) return 'FAIL: Expected array response';
      if (data.length === 0) return 'No adapters found (empty array)';
      const first = data[0] as Record<string, unknown>;
      const shapeErr = this.validateShape(first, { name: 'string' });
      if (shapeErr) return `FAIL: ${shapeErr}`;
      const names = data.map((a: Record<string, unknown>) => a.name).slice(0, 4).join(', ');
      return `${data.length} adapter(s) (${names})`;
    });
  }

  private async testProjects(): Promise<void> {
    await this.runTest('DESIGNER SERVICE API', 'projects', '/api/service/system/projects', undefined, (status, data) => {
      if (status !== 200) return `FAIL: HTTP ${status}`;
      if (!Array.isArray(data)) return 'FAIL: Expected array response';
      return `${data.length} project(s) on disk`;
    });
  }

  private async testOsInfo(): Promise<void> {
    await this.runTest('DESIGNER SERVICE API', 'osinfo', '/api/service/system/osinfo', undefined, (status, data) => {
      if (status !== 200) return `FAIL: HTTP ${status}`;
      if (typeof data !== 'object' || data === null) return 'FAIL: Expected object response';
      const obj = data as Record<string, unknown>;
      const os = obj.osVersion ?? obj.os ?? 'unknown';
      const img = obj.imageVersion ?? obj.disguiseVersion ?? '';
      return `OS: ${os}${img ? ` | Image: ${img}` : ''}`;
    });
  }

  // ── Designer Session API Tests ───────────────────────────────────────────

  private async testHealth(): Promise<void> {
    await this.runTest('DESIGNER SESSION API', 'health', '/api/session/status/health', undefined, (status, data) => {
      if (status === 404 || status === 503) return `FAIL: No active session (HTTP ${status})`;
      if (status !== 200) return `FAIL: HTTP ${status}`;
      if (typeof data !== 'object' || data === null) return 'FAIL: Expected object response';
      const obj = data as Record<string, unknown>;
      const fps = obj.averageFPS ?? obj.fps ?? '?';
      const dropped = obj.droppedFrames ?? '?';
      const states = Array.isArray(obj.states) ? obj.states.length : '?';
      return `FPS: ${fps} | Dropped: ${dropped} | States: ${states}`;
    });
  }

  private async testNotifications(): Promise<void> {
    await this.runTest('DESIGNER SESSION API', 'notifications', '/api/session/status/notifications', undefined, (status, data) => {
      if (status === 404 || status === 503) return `FAIL: No active session (HTTP ${status})`;
      if (status !== 200) return `FAIL: HTTP ${status}`;
      if (!Array.isArray(data)) return 'FAIL: Expected array response';
      const errors = data.filter((n: Record<string, unknown>) => n.severity === 'error' || n.level === 'error').length;
      return `${data.length} notification(s)${errors > 0 ? ` (${errors} errors)` : ''}`;
    });
  }

  private async testProject(): Promise<void> {
    await this.runTest('DESIGNER SESSION API', 'project', '/api/session/status/project', undefined, (status, data) => {
      if (status === 404 || status === 503) return `FAIL: No active session (HTTP ${status})`;
      if (status !== 200) return `FAIL: HTTP ${status}`;
      if (typeof data !== 'object' || data === null) return 'FAIL: Expected object response';
      const obj = data as Record<string, unknown>;
      const path = obj.projectPath ?? obj.path ?? obj.name ?? 'unknown';
      const ver = obj.version ?? '';
      return `Project: ${path}${ver ? ` (v${ver})` : ''}`;
    });
  }

  private async testSession(): Promise<void> {
    await this.runTest('DESIGNER SESSION API', 'session', '/api/session/status/session', undefined, (status, data) => {
      if (status === 404 || status === 503) return `FAIL: No active session (HTTP ${status})`;
      if (status !== 200) return `FAIL: HTTP ${status}`;
      if (typeof data !== 'object' || data === null) return 'FAIL: Expected object response';
      const obj = data as Record<string, unknown>;
      const machines = Array.isArray(obj.machines) ? obj.machines.length : '?';
      const isRunning = obj.isRunning ?? obj.running ?? '?';
      return `Running: ${isRunning} | Machines in session: ${machines}`;
    });
  }

  // ── SMC API Tests ────────────────────────────────────────────────────────

  private async testChassisStats(): Promise<void> {
    await this.runTest('SMC API', 'chassis/stats', '/api/chassis/stats', this.smcIp, (status, data) => {
      if (status !== 200) return `FAIL: HTTP ${status}`;
      if (typeof data !== 'object' || data === null) return 'FAIL: Expected object response';
      const obj = data as Record<string, unknown>;
      const cpuTemp = obj.cpuTemperature ?? obj.cpuTemp ?? '?';
      const gpuTemp = obj.gpuTemperature ?? obj.gpuTemp ?? '?';
      const fans = Array.isArray(obj.fans) ? `${obj.fans.length} fans` : 'fans: ?';
      return `CPU: ${cpuTemp}\u00B0C | GPU: ${gpuTemp}\u00B0C | ${fans}`;
    });
  }

  private async testPowerStatus(): Promise<void> {
    await this.runTest('SMC API', 'chassis/power/status', '/api/chassis/power/status', this.smcIp, (status, data) => {
      if (status !== 200) return `FAIL: HTTP ${status}`;
      if (typeof data !== 'object' || data === null) return 'FAIL: Expected object response';
      const obj = data as Record<string, unknown>;
      const state = obj.powerState ?? obj.state ?? obj.status ?? 'unknown';
      return `Power state: ${state}`;
    });
  }

  private async testLocalMachine(): Promise<void> {
    await this.runTest('SMC API', 'localmachine', '/api/localmachine', this.smcIp, (status, data) => {
      if (status !== 200) return `FAIL: HTTP ${status}`;
      if (typeof data !== 'object' || data === null) return 'FAIL: Expected object response';
      const obj = data as Record<string, unknown>;
      const hostname = obj.hostname ?? 'unknown';
      const serial = obj.serial ?? obj.serialNumber ?? '?';
      const type = obj.type ?? obj.machineType ?? '?';
      return `${hostname} (${type}) S/N: ${serial}`;
    });
  }

  private async testSmcNetworkAdapters(): Promise<void> {
    await this.runTest('SMC API', 'networkadapters', '/api/networkadapters', this.smcIp, (status, data) => {
      if (status !== 200) return `FAIL: HTTP ${status}`;
      if (!Array.isArray(data)) return 'FAIL: Expected array response';
      return `${data.length} NIC(s) reported`;
    });
  }

  private async testSmcVfc(): Promise<void> {
    await this.runTest('SMC API', 'vfc', '/api/vfc', this.smcIp, (status, data) => {
      if (status !== 200) return `FAIL: HTTP ${status}`;
      if (typeof data !== 'object' || data === null) return 'FAIL: Expected object or array response';
      const cards = Array.isArray(data) ? data.length : (Array.isArray((data as Record<string, unknown>).cards) ? ((data as Record<string, unknown>).cards as unknown[]).length : '?');
      return `VFC data received (${cards} card(s))`;
    });
  }

  private async testRemora(): Promise<void> {
    await this.runTest('SMC API', 'remora', '/api/remora', this.smcIp, (status, data) => {
      if (status !== 200) return `FAIL: HTTP ${status}`;
      if (typeof data !== 'object' || data === null) return 'FAIL: Expected object response';
      const obj = data as Record<string, unknown>;
      const fw = obj.firmwareVersion ?? obj.version ?? 'unknown';
      return `SMC firmware: ${fw}`;
    });
  }

  // ── Run all ──────────────────────────────────────────────────────────────

  async runAll(): Promise<void> {
    const totalStart = performance.now();

    console.log('');
    console.log(colors.bold('d3Watch API Integration Test Suite'));
    console.log('\u2550'.repeat(55));
    const smcLabel = this.smcIp ? ` | SMC: ${this.smcIp}` : '';
    console.log(`Target: ${this.serverIp}:${this.port}${smcLabel}`);
    console.log('');

    // Designer Service API
    console.log(colors.bold(colors.cyan('DESIGNER SERVICE API')));
    await this.testDetectSystems();
    await this.testVfcs();
    await this.testGpuOutputs();
    await this.testNetworkAdapters();
    await this.testProjects();
    await this.testOsInfo();
    console.log('');

    // Designer Session API
    console.log(colors.bold(colors.cyan('DESIGNER SESSION API')));
    await this.testHealth();
    await this.testNotifications();
    await this.testProject();
    await this.testSession();
    console.log('');

    // SMC API
    if (this.smcIp) {
      console.log(colors.bold(colors.cyan('SMC API')));
      await this.testChassisStats();
      await this.testPowerStatus();
      await this.testLocalMachine();
      await this.testSmcNetworkAdapters();
      await this.testSmcVfc();
      await this.testRemora();
      console.log('');
    } else {
      console.log(colors.dim('SMC API  (skipped — no SMC IP provided)'));
      console.log('');
    }

    // Summary
    const totalMs = Math.round(performance.now() - totalStart);
    const passed = this.results.filter((r) => r.passed).length;
    const failed = this.results.filter((r) => !r.passed).length;
    const total = this.results.length;

    console.log('\u2550'.repeat(55));
    const summaryColor = failed === 0 ? colors.green : colors.yellow;
    console.log(
      summaryColor(
        `RESULTS: ${passed}/${total} passed | ${failed} failed | Total: ${(totalMs / 1000).toFixed(1)}s`,
      ),
    );

    if (failed > 0) {
      console.log(colors.red('ISSUES:'));
      for (const r of this.results.filter((r) => !r.passed)) {
        const hint = this.getHint(r);
        console.log(`  - ${r.name}: ${r.message}${hint ? ` (${hint})` : ''}`);
      }
    }

    console.log('');

    // Exit with non-zero if any failures
    if (failed > 0) process.exit(1);
  }

  private getHint(r: TestResult): string {
    if (r.message.includes('timed out')) return 'check if server is reachable';
    if (r.message.includes('Connection refused') || r.message.includes('ECONNREFUSED'))
      return 'check if d3service is running';
    if (r.message.includes('404')) return 'endpoint not available or no active session';
    if (r.message.includes('503')) return 'service unavailable';
    return '';
  }
}

// ─── CLI Entry Point ─────────────────────────────────────────────────────────

function main(): void {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    console.log('');
    console.log('Usage: npx tsx tests/api-test.ts <server-ip> [smc-ip] [--port <port>]');
    console.log('');
    console.log('Examples:');
    console.log('  npx tsx tests/api-test.ts 10.0.0.1');
    console.log('  npx tsx tests/api-test.ts 10.0.0.1 172.31.250.9');
    console.log('  npx tsx tests/api-test.ts 10.0.0.1 --port 8080');
    console.log('');
    process.exit(0);
  }

  const serverIp = args[0];
  let smcIp: string | undefined;
  let port = 80;

  // Parse remaining args
  for (let i = 1; i < args.length; i++) {
    if (args[i] === '--port' && args[i + 1]) {
      port = parseInt(args[i + 1], 10);
      i++;
    } else if (!smcIp && !args[i].startsWith('-')) {
      smcIp = args[i];
    }
  }

  const tester = new APITester(serverIp, smcIp, port);
  tester.runAll().catch((err) => {
    console.error(colors.red(`Fatal error: ${err.message}`));
    process.exit(2);
  });
}

main();
