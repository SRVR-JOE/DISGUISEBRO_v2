/**
 * SMCAPI - Static client for the Disguise SMC (System Management Controller) REST API.
 * All methods use native fetch with a 5-second timeout.
 */
export class SMCAPI {
  private static readonly TIMEOUT_MS = 5000;

  private static async get<T>(smcIp: string, path: string, fallback: T): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), SMCAPI.TIMEOUT_MS);

    try {
      const response = await fetch(`http://${smcIp}${path}`, {
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      return (await response.json()) as T;
    } catch (error) {
      console.error(`[SMCAPI] GET ${path} on ${smcIp} failed:`, error);
      return fallback;
    } finally {
      clearTimeout(timeout);
    }
  }

  private static async post<T>(
    smcIp: string,
    path: string,
    body: unknown | null,
    auth: string | null,
    fallback: T
  ): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), SMCAPI.TIMEOUT_MS);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (auth) {
      headers['Authorization'] = `Basic ${auth}`;
    }

    try {
      const response = await fetch(`http://${smcIp}${path}`, {
        method: 'POST',
        headers,
        body: body != null ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      return (await response.json()) as T;
    } catch (error) {
      console.error(`[SMCAPI] POST ${path} on ${smcIp} failed:`, error);
      return fallback;
    } finally {
      clearTimeout(timeout);
    }
  }

  // --- Chassis ---

  static async getChassisStats(smcIp: string) {
    return this.get(smcIp, '/api/chassis/stats', null);
  }

  static async getPowerStatus(smcIp: string) {
    return this.get(smcIp, '/api/chassis/power/status', null);
  }

  static async powerOn(smcIp: string, auth: string) {
    return this.post(smcIp, '/api/chassis/power/on', null, auth, null);
  }

  static async powerOff(smcIp: string, auth: string) {
    return this.post(smcIp, '/api/chassis/power/off', null, auth, null);
  }

  static async powerCycle(smcIp: string, auth: string) {
    return this.post(smcIp, '/api/chassis/power/cycle', null, auth, null);
  }

  static async identify(smcIp: string) {
    return this.post(smcIp, '/api/chassis/whoami', null, null, null);
  }

  // --- OLED ---

  static async sendOLEDNotification(smcIp: string, message: string, auth: string) {
    return this.post(smcIp, '/api/oled/notification', { text: message }, auth, null);
  }

  static async setOLEDDuration(smcIp: string, seconds: number, auth: string) {
    return this.post(smcIp, '/api/oled/notification/time', { seconds }, auth, null);
  }

  // --- Network ---

  static async getNetworkAdapters(smcIp: string) {
    return this.get(smcIp, '/api/networkadapters', []);
  }

  static async setNetworkAdapter(
    smcIp: string,
    mac: string,
    config: { name?: string; ip?: string; netmask?: string },
    auth: string
  ) {
    return this.post(smcIp, `/api/networkadapters/${mac}`, config, auth, null);
  }

  // --- Local Machine ---

  static async getLocalMachine(smcIp: string) {
    return this.get(smcIp, '/api/localmachine', null);
  }

  static async setHostname(smcIp: string, hostname: string, auth: string) {
    return this.post(smcIp, '/api/localmachine', { hostname }, auth, null);
  }

  // --- VFC / SMC Info ---

  static async getVFCCards(smcIp: string) {
    return this.get(smcIp, '/api/vfc', []);
  }

  static async getSMCInfo(smcIp: string) {
    return this.get(smcIp, '/api/remora', null);
  }
}
