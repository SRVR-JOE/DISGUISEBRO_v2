/**
 * DesignerAPI - Static client for the Disguise Designer REST API.
 * All methods use native fetch with a 5-second timeout.
 */
export class DesignerAPI {
  private static readonly TIMEOUT_MS = 5000;

  private static async request<T>(
    serverIp: string,
    port: number,
    path: string,
    fallback: T
  ): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), DesignerAPI.TIMEOUT_MS);

    try {
      const response = await fetch(`http://${serverIp}:${port}${path}`, {
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      return (await response.json()) as T;
    } catch (error) {
      console.error(`[DesignerAPI] ${path} on ${serverIp}:${port} failed:`, error);
      return fallback;
    } finally {
      clearTimeout(timeout);
    }
  }

  static async detectSystems(serverIp: string, port = 80) {
    return this.request(serverIp, port, '/api/service/system/detectsystems', []);
  }

  static async getVFCs(serverIp: string, port = 80) {
    return this.request(serverIp, port, '/api/service/system/vfcs', []);
  }

  static async getGPUOutputs(serverIp: string, port = 80) {
    return this.request(serverIp, port, '/api/service/system/gpuoutputs', []);
  }

  static async getNetworkAdapters(serverIp: string, port = 80) {
    return this.request(serverIp, port, '/api/service/system/networkadapters', []);
  }

  static async getProjects(serverIp: string, port = 80) {
    return this.request(serverIp, port, '/api/service/system/projects', []);
  }

  static async getOSInfo(serverIp: string, port = 80) {
    return this.request(serverIp, port, '/api/service/system/osinfo', null);
  }

  static async getHealth(serverIp: string, port = 80) {
    return this.request(serverIp, port, '/api/session/status/health', null);
  }

  static async getNotifications(serverIp: string, port = 80) {
    return this.request(serverIp, port, '/api/session/status/notifications', []);
  }

  static async getProjectStatus(serverIp: string, port = 80) {
    return this.request(serverIp, port, '/api/session/status/project', null);
  }

  static async getSessionStatus(serverIp: string, port = 80) {
    return this.request(serverIp, port, '/api/session/status/session', null);
  }

  static async getTransportStatus(serverIp: string, port = 80) {
    return this.request(serverIp, port, '/api/session/transport', null);
  }
}
