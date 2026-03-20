// === Machine & Discovery Types ===
export interface Machine {
  id: string;
  hostname: string;
  type: string;
  ipAddress: string;
  smcIp?: string;
  version?: string;
  firstSeen: string;
  lastSeen: string;
  isOnline: boolean;
  runningDesigner?: boolean;
  runningService?: boolean;
  runningManager?: boolean;
}

export interface DetectedSystem {
  hostname: string;
  type: string;
  version: string;
  ipAddress: string;
  runningDesigner: boolean;
  runningService: boolean;
  runningManager: boolean;
  runningNotchHost: boolean;
}

// === Health Types ===
export interface HealthData {
  machineId: string;
  hostname: string;
  averageFPS: number;
  videoDroppedFrames: number;
  videoMissedFrames: number;
  states: SystemState[];
}

export interface SystemState {
  name: string;
  detail: string;
  category: string;
  severity: 'critical' | 'warning' | 'info' | 'good';
}

// === VFC Types ===
export interface VFCCard {
  slot: number;
  type: string;
  firmwareVersion: string;
  fpgaVersion: string;
  splitMode: string;
  generation: string;
  ports: {
    a: VFCPort;
    b: VFCPort;
    c: VFCPort;
    d: VFCPort;
  };
}

export interface VFCPort {
  resolution: { width: number; height: number };
  refreshRate: number;
  name: string;
}

export interface VFCData {
  hostname: string;
  backplaneVersion: string;
  cards: VFCCard[];
}

// === GPU Types ===
export interface GPUOutput {
  port: number;
  genlockState: string;
  emulated: boolean;
  resolution: { width: number; height: number };
  refreshRate: number;
  bitDepth: number;
  colourFormat: string;
}

// === Network Types ===
export interface NetworkAdapter {
  name: string;
  mac: string;
  enabled: boolean;
  dhcp: boolean;
  status: string;
  addresses: NetworkAddress[];
}

export interface NetworkAddress {
  ip: string;
  subnet: string;
  gateway: string;
}

// === Session Types ===
export interface SessionStatus {
  director?: string;
  actors: string[];
  understudies: string[];
  soloMode: boolean;
  dedicatedDirector: boolean;
}

export interface ProjectStatus {
  projectPath: string;
  version: string;
}

// === Temperature / SMC Types ===
export interface ChassisStats {
  temperatures: SensorReading[];
  fans: FanReading[];
  voltages: SensorReading[];
  powerDraw?: number;
}

export interface SensorReading {
  name: string;
  value: number;
  unit: string;
}

export interface FanReading {
  name: string;
  rpm: number;
}

// === Notification Types ===
export interface D3Notification {
  id?: number;
  machineId: string;
  hostname: string;
  timestamp: string;
  summary: string;
  detail: string;
  severity: 'critical' | 'warning' | 'info';
}

// === Issue Types ===
export interface Issue {
  id: string;
  issueNumber: number;
  title: string;
  description: string;
  severity: 'critical' | 'warning' | 'info' | 'resolved';
  status: 'open' | 'investigating' | 'resolved' | 'deferred';
  machineId?: string;
  machineHostname?: string;
  machineType?: string;
  projectName?: string;
  sessionRole?: string;
  snapshot?: SystemSnapshot;
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string;
  createdBy: string;
  tags: string[];
}

export interface SystemSnapshot {
  fps: number;
  droppedFrames: number;
  missedFrames: number;
  genlockState: string;
  temperatures: Record<string, number>;
  fanSpeeds: Record<string, number>;
  vfcStatus: VFCCard[];
  networkConfig: NetworkAdapter[];
  systemStates: SystemState[];
  gpuOutputs: GPUOutput[];
}

export interface IssueComment {
  id: string;
  issueId: string;
  author: string;
  text: string;
  timestamp: string;
}

// === Network Profile Types ===
export interface NetworkProfile {
  id: string;
  profileName: string;
  profileVersion: string;
  createdBy: string;
  createdAt: string;
  showName: string;
  machine: {
    hostname: string;
    role: string;
  };
  networkAdapters: ProfileAdapter[];
}

export interface ProfileAdapter {
  matchBy: 'position' | 'speed' | 'mac';
  position?: number;
  speed?: string;
  mac?: string;
  name: string;
  ip: string;
  netmask: string;
}

// === OS Info ===
export interface OSInfo {
  windowsVersion: string;
  imageVersion: string;
}

// === App State ===
export interface AppState {
  machines: Machine[];
  selectedMachineId: string | null;
  healthData: Record<string, HealthData>;
  vfcData: Record<string, VFCData>;
  gpuData: Record<string, GPUOutput[]>;
  chassisStats: Record<string, ChassisStats>;
  notifications: D3Notification[];
  sessionStatus: SessionStatus | null;
  isPolling: boolean;
  pollInterval: number;
}

// === Window API ===
export interface D3WatchAPI {
  db: {
    getMachines: () => Promise<Machine[]>;
    getMachine: (id: string) => Promise<Machine | null>;
    getHealthSnapshots: (machineId: string, limit?: number) => Promise<HealthSnapshot[]>;
    getTemperatureReadings: (machineId: string, limit?: number) => Promise<TemperatureReading[]>;
    getNotifications: (machineId: string, limit?: number) => Promise<D3Notification[]>;
    getVFCEvents: (machineId: string) => Promise<VFCEvent[]>;
  };
  issues: {
    getAll: (filters?: Record<string, string>) => Promise<Issue[]>;
    get: (id: string) => Promise<Issue | null>;
    create: (issue: Partial<Issue>) => Promise<Issue>;
    update: (id: string, updates: Partial<Issue>) => Promise<Issue>;
    addComment: (issueId: string, comment: Partial<IssueComment>) => Promise<IssueComment>;
    getComments: (issueId: string) => Promise<IssueComment[]>;
  };
  profiles: {
    getAll: () => Promise<NetworkProfile[]>;
    save: (profile: NetworkProfile) => Promise<void>;
    delete: (id: string) => Promise<void>;
  };
  api: {
    detectSystems: (ip: string) => Promise<DetectedSystem[]>;
    getVFCs: (ip: string) => Promise<VFCData>;
    getGPUOutputs: (ip: string) => Promise<GPUOutput[]>;
    getHealth: (ip: string) => Promise<HealthData>;
    getNetworkAdapters: (ip: string) => Promise<NetworkAdapter[]>;
    getNotifications: (ip: string) => Promise<D3Notification[]>;
    getSessionStatus: (ip: string) => Promise<SessionStatus>;
    getProjectStatus: (ip: string) => Promise<ProjectStatus>;
    getOSInfo: (ip: string) => Promise<OSInfo>;
  };
  smc: {
    getChassisStats: (ip: string) => Promise<ChassisStats>;
    getPowerStatus: (ip: string) => Promise<{ state: string }>;
    powerOn: (ip: string, auth: string) => Promise<void>;
    powerOff: (ip: string, auth: string) => Promise<void>;
    powerCycle: (ip: string, auth: string) => Promise<void>;
    identify: (ip: string) => Promise<void>;
    sendOLED: (ip: string, message: string, auth: string) => Promise<void>;
    getNetworkAdapters: (ip: string) => Promise<NetworkAdapter[]>;
    setNetworkAdapter: (ip: string, mac: string, config: Record<string, string>, auth: string) => Promise<void>;
    setHostname: (ip: string, hostname: string, auth: string) => Promise<void>;
    getLocalMachine: (ip: string) => Promise<{ hostname: string; serial: string; type: string }>;
  };
  discovery: {
    start: () => Promise<void>;
    stop: () => Promise<void>;
    addManual: (ip: string) => Promise<void>;
  };
  poller: {
    start: () => Promise<void>;
    stop: () => Promise<void>;
    setInterval: (ms: number) => Promise<void>;
  };
  notify: (title: string, body: string) => Promise<void>;
  settings: {
    get: (key: string) => Promise<string | null>;
    set: (key: string, value: string) => Promise<void>;
  };
  on: (channel: string, callback: (...args: unknown[]) => void) => () => void;
}

export interface HealthSnapshot {
  id: number;
  machineId: string;
  timestamp: string;
  fps: number;
  droppedFrames: number;
  missedFrames: number;
}

export interface TemperatureReading {
  id: number;
  machineId: string;
  timestamp: string;
  sensorName: string;
  valueCelsius: number;
}

export interface VFCEvent {
  id: number;
  machineId: string;
  timestamp: string;
  slot: number;
  eventType: string;
  cardType: string;
  firmware: string;
}

declare global {
  interface Window {
    d3watch: D3WatchAPI;
  }
}
