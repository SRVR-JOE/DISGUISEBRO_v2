import { contextBridge, ipcRenderer } from 'electron';

const api = {
  // Database
  db: {
    getMachines: () => ipcRenderer.invoke('db:getMachines'),
    getMachine: (id: string) => ipcRenderer.invoke('db:getMachine', id),
    getHealthSnapshots: (machineId: string, limit = 100) =>
      ipcRenderer.invoke('db:getHealthSnapshots', machineId, limit),
    getTemperatureReadings: (machineId: string, limit = 100) =>
      ipcRenderer.invoke('db:getTemperatureReadings', machineId, limit),
    getNotifications: (machineId: string, limit = 100) =>
      ipcRenderer.invoke('db:getNotifications', machineId, limit),
    getVFCEvents: (machineId: string) =>
      ipcRenderer.invoke('db:getVFCEvents', machineId),
  },

  // Issues
  issues: {
    getAll: (filters?: Record<string, string>) =>
      ipcRenderer.invoke('db:getIssues', filters),
    get: (id: string) => ipcRenderer.invoke('db:getIssue', id),
    create: (issue: Record<string, unknown>) =>
      ipcRenderer.invoke('db:createIssue', issue),
    update: (id: string, updates: Record<string, unknown>) =>
      ipcRenderer.invoke('db:updateIssue', id, updates),
    addComment: (issueId: string, comment: Record<string, unknown>) =>
      ipcRenderer.invoke('db:addComment', issueId, comment),
    getComments: (issueId: string) =>
      ipcRenderer.invoke('db:getComments', issueId),
  },

  // Network Profiles
  profiles: {
    getAll: () => ipcRenderer.invoke('db:getProfiles'),
    save: (profile: Record<string, unknown>) =>
      ipcRenderer.invoke('db:saveProfile', profile),
    delete: (id: string) => ipcRenderer.invoke('db:deleteProfile', id),
    getLogs: (profileId?: string) => ipcRenderer.invoke('db:getDeploymentLogs', profileId),
    saveLog: (log: Record<string, unknown>) => ipcRenderer.invoke('db:saveDeploymentLog', log),
  },

  // Designer API
  api: {
    detectSystems: (ip: string) => ipcRenderer.invoke('api:detectSystems', ip),
    getVFCs: (ip: string) => ipcRenderer.invoke('api:getVFCs', ip),
    getGPUOutputs: (ip: string) => ipcRenderer.invoke('api:getGPUOutputs', ip),
    getHealth: (ip: string) => ipcRenderer.invoke('api:getHealth', ip),
    getNetworkAdapters: (ip: string) =>
      ipcRenderer.invoke('api:getNetworkAdapters', ip),
    getNotifications: (ip: string) =>
      ipcRenderer.invoke('api:getNotifications', ip),
    getSessionStatus: (ip: string) =>
      ipcRenderer.invoke('api:getSessionStatus', ip),
    getProjectStatus: (ip: string) =>
      ipcRenderer.invoke('api:getProjectStatus', ip),
    getOSInfo: (ip: string) => ipcRenderer.invoke('api:getOSInfo', ip),
  },

  // SMC API
  smc: {
    getChassisStats: (ip: string) =>
      ipcRenderer.invoke('smc:getChassisStats', ip),
    getPowerStatus: (ip: string) =>
      ipcRenderer.invoke('smc:getPowerStatus', ip),
    powerOn: (ip: string, auth: string) =>
      ipcRenderer.invoke('smc:powerOn', ip, auth),
    powerOff: (ip: string, auth: string) =>
      ipcRenderer.invoke('smc:powerOff', ip, auth),
    powerCycle: (ip: string, auth: string) =>
      ipcRenderer.invoke('smc:powerCycle', ip, auth),
    identify: (ip: string) => ipcRenderer.invoke('smc:identify', ip),
    sendOLED: (ip: string, message: string, auth: string) =>
      ipcRenderer.invoke('smc:sendOLED', ip, message, auth),
    getNetworkAdapters: (ip: string) =>
      ipcRenderer.invoke('smc:getNetworkAdapters', ip),
    setNetworkAdapter: (ip: string, mac: string, config: Record<string, string>, auth: string) =>
      ipcRenderer.invoke('smc:setNetworkAdapter', ip, mac, config, auth),
    setHostname: (ip: string, hostname: string, auth: string) =>
      ipcRenderer.invoke('smc:setHostname', ip, hostname, auth),
    getLocalMachine: (ip: string) =>
      ipcRenderer.invoke('smc:getLocalMachine', ip),
  },

  // Discovery
  discovery: {
    start: () => ipcRenderer.invoke('discovery:start'),
    stop: () => ipcRenderer.invoke('discovery:stop'),
    addManual: (ip: string) => ipcRenderer.invoke('discovery:addManual', ip),
  },

  // Poller
  poller: {
    start: () => ipcRenderer.invoke('poller:start'),
    stop: () => ipcRenderer.invoke('poller:stop'),
    setInterval: (ms: number) => ipcRenderer.invoke('poller:setInterval', ms),
  },

  // Desktop notifications
  notify: (title: string, body: string) =>
    ipcRenderer.invoke('notify:desktop', title, body),

  // Settings
  settings: {
    get: (key: string) => ipcRenderer.invoke('settings:get', key),
    set: (key: string, value: string) =>
      ipcRenderer.invoke('settings:set', key, value),
  },

  // Event listeners
  on: (channel: string, callback: (...args: unknown[]) => void) => {
    const subscription = (_event: Electron.IpcRendererEvent, ...args: unknown[]) =>
      callback(...args);
    ipcRenderer.on(channel, subscription);
    return () => ipcRenderer.removeListener(channel, subscription);
  },
};

contextBridge.exposeInMainWorld('d3watch', api);
