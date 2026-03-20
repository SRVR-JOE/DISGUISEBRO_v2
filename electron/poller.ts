/**
 * PollerService - Periodically polls all registered Disguise machines for
 * health, VFC, GPU, chassis, and notification data.
 *
 * Runs in the Electron main process and emits events to the renderer.
 */
import { DatabaseService } from './database';
import { DesignerAPI } from './designer-api';
import { SMCAPI } from './smc-api';

const DEFAULT_INTERVAL_MS = 10_000;

export class PollerService {
  private db: DatabaseService;
  private emit: (event: string, data: any) => void;
  private intervalMs: number = DEFAULT_INTERVAL_MS;
  private timer: ReturnType<typeof setInterval> | null = null;
  private running = false;

  /** Previous VFC state keyed by machineId for change detection. */
  private previousVfcState = new Map<string, string>();

  constructor(db: DatabaseService, emit: (event: string, data: any) => void) {
    this.db = db;
    this.emit = emit;
  }

  start(): void {
    if (this.running) return;
    this.running = true;

    // Fire an initial poll immediately, then schedule recurring ticks.
    this.tick();
    this.timer = setInterval(() => this.tick(), this.intervalMs);

    console.log(`[Poller] Started with ${this.intervalMs}ms interval`);
  }

  stop(): void {
    this.running = false;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    console.log('[Poller] Stopped');
  }

  setInterval(ms: number): void {
    this.intervalMs = Math.max(1000, ms); // clamp to at least 1s
    if (this.running) {
      // Restart the timer with the new interval
      this.stop();
      this.start();
    }
  }

  // -------------------------------------------------------------------
  // Main poll tick
  // -------------------------------------------------------------------

  private async tick(): Promise<void> {
    let machines: any[];
    try {
      machines = this.db.getMachines();
    } catch (err) {
      console.error('[Poller] Failed to get machines from DB:', err);
      return;
    }

    if (!machines || machines.length === 0) return;

    const results = await Promise.allSettled(
      machines.map((machine: any) => this.pollMachine(machine))
    );

    // Log any per-machine failures (they don't block other machines)
    results.forEach((r, i) => {
      if (r.status === 'rejected') {
        console.error(
          `[Poller] Machine ${machines[i]?.hostname || machines[i]?.id} poll failed:`,
          r.reason
        );
      }
    });

    // Emit a consolidated machines update so the renderer can refresh the list
    try {
      const updatedMachines = this.db.getMachines();
      this.emit('poller:machines', updatedMachines);
    } catch {
      // non-fatal
    }
  }

  // -------------------------------------------------------------------
  // Per-machine polling
  // -------------------------------------------------------------------

  private async pollMachine(machine: any): Promise<void> {
    const { id: machineId, ipAddress: ip, smcIp } = machine;
    if (!ip) return;

    // ---- Designer service API (always available when the service is running) ----

    const [systems, vfcs, gpuOutputs] = await Promise.allSettled([
      DesignerAPI.detectSystems(ip),
      DesignerAPI.getVFCs(ip),
      DesignerAPI.getGPUOutputs(ip),
    ]);

    const detectedSystems = settledValue(systems, []);
    const vfcData = settledValue(vfcs, null);
    const gpuData = settledValue(gpuOutputs, []);

    // Determine if the machine is reachable (online) based on detectsystems response
    const isOnline = Array.isArray(detectedSystems) && detectedSystems.length > 0;

    // Update machine online status and metadata from detectsystems
    try {
      const selfInfo = detectedSystems.find(
        (s: any) => s.ipAddress === ip || s.hostname === machine.hostname
      ) || detectedSystems[0];

      this.db.upsertMachine({
        id: machineId,
        hostname: selfInfo?.hostname || machine.hostname,
        type: selfInfo?.type || machine.type,
        ipAddress: ip,
        version: selfInfo?.version || machine.version,
        isOnline,
        runningDesigner: selfInfo?.runningDesigner,
        runningService: selfInfo?.runningService,
        runningManager: selfInfo?.runningManager,
      });
    } catch (err) {
      console.error(`[Poller] Failed to update machine ${machineId}:`, err);
    }

    // ---- Designer session API (only when Designer is running) ----

    const designerRunning =
      isOnline &&
      detectedSystems.some(
        (s: any) =>
          (s.ipAddress === ip || s.hostname === machine.hostname) && s.runningDesigner
      );

    let healthData: any = null;
    let notificationData: any[] = [];

    if (designerRunning) {
      const [health, notifications] = await Promise.allSettled([
        DesignerAPI.getHealth(ip),
        DesignerAPI.getNotifications(ip),
      ]);

      healthData = settledValue(health, null);
      notificationData = settledValue(notifications, []);
    }

    // ---- Store health snapshots ----

    if (healthData) {
      try {
        this.db.insertHealthSnapshot({
          machineId,
          timestamp: new Date().toISOString(),
          fps: healthData.averageFPS ?? healthData.fps ?? 0,
          droppedFrames: healthData.videoDroppedFrames ?? healthData.droppedFrames ?? 0,
          missedFrames: healthData.videoMissedFrames ?? healthData.missedFrames ?? 0,
        });
      } catch (err) {
        console.error(`[Poller] Failed to insert health snapshot for ${machineId}:`, err);
      }

      this.emit('poller:health', { machineId, health: healthData });
    }

    // ---- VFC change detection & events ----

    if (vfcData) {
      const vfcKey = JSON.stringify(vfcData);
      const previousKey = this.previousVfcState.get(machineId);

      if (previousKey && previousKey !== vfcKey) {
        // VFC state changed – record events for each card
        try {
          const cards = Array.isArray(vfcData) ? vfcData : vfcData.cards || [];
          for (const card of cards) {
            this.db.insertVFCEvent({
              machineId,
              timestamp: new Date().toISOString(),
              slot: card.slot ?? 0,
              eventType: 'config_change',
              cardType: card.type || 'unknown',
              firmware: card.firmwareVersion || 'unknown',
            });
          }
        } catch (err) {
          console.error(`[Poller] Failed to insert VFC event for ${machineId}:`, err);
        }
      }

      this.previousVfcState.set(machineId, vfcKey);
      this.emit('poller:vfc', { machineId, vfc: vfcData });
    }

    // ---- GPU outputs ----

    if (gpuData && (Array.isArray(gpuData) ? gpuData.length > 0 : true)) {
      this.emit('poller:gpu', { machineId, gpu: gpuData });
    }

    // ---- Notifications ----

    if (notificationData && notificationData.length > 0) {
      try {
        for (const note of notificationData) {
          this.db.insertNotification({
            machineId,
            hostname: machine.hostname,
            timestamp: note.timestamp || new Date().toISOString(),
            summary: note.summary || note.title || '',
            detail: note.detail || note.description || '',
            severity: note.severity || 'info',
          });
        }
      } catch (err) {
        console.error(`[Poller] Failed to insert notifications for ${machineId}:`, err);
      }

      this.emit('poller:notifications', { machineId, notifications: notificationData });
    }

    // ---- SMC chassis stats (only if smcIp is configured) ----

    if (smcIp) {
      try {
        const chassisStats = await SMCAPI.getChassisStats(smcIp);

        if (chassisStats) {
          // Store temperature readings
          const temps = chassisStats.temperatures || [];
          for (const sensor of temps) {
            try {
              this.db.insertTemperatureReading({
                machineId,
                timestamp: new Date().toISOString(),
                sensorName: sensor.name,
                valueCelsius: sensor.value,
              });
            } catch {
              // non-fatal per-sensor
            }
          }

          this.emit('poller:chassis', { machineId, chassis: chassisStats });
        }
      } catch (err) {
        console.error(`[Poller] SMC poll failed for ${machineId} (${smcIp}):`, err);
      }
    }
  }
}

// -------------------------------------------------------------------
// Helpers
// -------------------------------------------------------------------

function settledValue<T>(result: PromiseSettledResult<T>, fallback: T): T {
  return result.status === 'fulfilled' ? result.value : fallback;
}
