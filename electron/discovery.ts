/**
 * DiscoveryService - DNS-SD discovery for Disguise servers on the local network.
 * Uses bonjour-service to browse for _d3host._tcp and _d3director._tcp services.
 * Falls back gracefully if mDNS is unavailable; manual server adds always work.
 */
import Bonjour from 'bonjour-service';
import { DatabaseService } from './database';
import { DesignerAPI } from './designer-api';

export class DiscoveryService {
  private db: DatabaseService;
  private onUpdate: (data: any) => void;
  private bonjour: InstanceType<typeof Bonjour> | null = null;
  private browsers: any[] = [];
  private discoveredIps = new Set<string>();
  private running = false;

  constructor(db: DatabaseService, onUpdate: (data: any) => void) {
    this.db = db;
    this.onUpdate = onUpdate;
  }

  start(): void {
    if (this.running) return;
    this.running = true;

    try {
      this.bonjour = new Bonjour();
      this.browse('_d3host._tcp');
      this.browse('_d3director._tcp');
      console.log('[Discovery] Started browsing for Disguise services');
    } catch (err) {
      console.error('[Discovery] Failed to start bonjour browsing:', err);
      // App continues to work with manual server adds
    }
  }

  stop(): void {
    this.running = false;

    for (const browser of this.browsers) {
      try {
        browser.stop();
      } catch {
        // ignore cleanup errors
      }
    }
    this.browsers = [];

    if (this.bonjour) {
      try {
        this.bonjour.destroy();
      } catch {
        // ignore cleanup errors
      }
      this.bonjour = null;
    }

    console.log('[Discovery] Stopped');
  }

  async addManualServer(ip: string): Promise<void> {
    console.log(`[Discovery] Adding manual server at ${ip}`);

    try {
      const systems: any[] = await DesignerAPI.detectSystems(ip);

      if (!systems || systems.length === 0) {
        // No systems detected via API; register a basic entry so
        // the machine still appears in the UI / poller.
        const machineId = this.ipToId(ip);
        this.db.upsertMachine({
          id: machineId,
          hostname: ip,
          type: 'unknown',
          ipAddress: ip,
          isOnline: false,
        });
        this.discoveredIps.add(ip);
        this.onUpdate({ type: 'manual', ip, machines: [{ id: machineId, hostname: ip, ipAddress: ip }] });
        return;
      }

      for (const sys of systems) {
        const machineIp = sys.ipAddress || ip;
        const machineId = this.ipToId(machineIp);

        this.db.upsertMachine({
          id: machineId,
          hostname: sys.hostname || ip,
          type: sys.type || 'unknown',
          ipAddress: machineIp,
          version: sys.version,
          isOnline: true,
          runningDesigner: sys.runningDesigner,
          runningService: sys.runningService,
          runningManager: sys.runningManager,
        });

        this.discoveredIps.add(machineIp);
      }

      this.onUpdate({ type: 'manual', ip, machines: systems });
    } catch (err) {
      console.error(`[Discovery] Failed to add manual server ${ip}:`, err);

      // Still register so the poller will attempt to reach it later
      const machineId = this.ipToId(ip);
      this.db.upsertMachine({
        id: machineId,
        hostname: ip,
        type: 'unknown',
        ipAddress: ip,
        isOnline: false,
      });
      this.discoveredIps.add(ip);
      this.onUpdate({ type: 'manual', ip, machines: [{ id: machineId, hostname: ip, ipAddress: ip }] });
    }
  }

  // --- private helpers ---

  private browse(serviceType: string): void {
    if (!this.bonjour) return;

    try {
      const browser = this.bonjour.find({ type: serviceType }, (service: any) => {
        this.handleService(service);
      });

      this.browsers.push(browser);
    } catch (err) {
      console.error(`[Discovery] Failed to browse for ${serviceType}:`, err);
    }
  }

  private handleService(service: any): void {
    try {
      const hostname: string = service.host || service.name || 'unknown';
      const ip: string | undefined =
        service.referer?.address ||
        (service.addresses && service.addresses.find((a: string) => this.isIPv4(a)));
      const port: number = service.port || 80;

      if (!ip) {
        console.warn(`[Discovery] Service ${hostname} found but no IP address available`);
        return;
      }

      if (this.discoveredIps.has(ip)) {
        // Already known – still update lastSeen via upsert
      }

      const machineId = this.ipToId(ip);
      const type = service.type?.includes('director') ? 'director' : 'host';

      this.db.upsertMachine({
        id: machineId,
        hostname: hostname.replace(/\.local\.?$/, ''),
        type,
        ipAddress: ip,
        isOnline: true,
      });

      this.discoveredIps.add(ip);
      this.onUpdate({
        type: 'mdns',
        service: serviceType(service),
        machine: { id: machineId, hostname, ipAddress: ip, port, type },
      });

      console.log(`[Discovery] Found ${type}: ${hostname} at ${ip}:${port}`);
    } catch (err) {
      console.error('[Discovery] Error handling discovered service:', err);
    }
  }

  private ipToId(ip: string): string {
    return `machine-${ip.replace(/\./g, '-')}`;
  }

  private isIPv4(address: string): boolean {
    return /^\d{1,3}(\.\d{1,3}){3}$/.test(address);
  }
}

function serviceType(service: any): string {
  return service.type || 'unknown';
}
