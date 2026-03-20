import { app, BrowserWindow, ipcMain, Notification } from 'electron';
import path from 'path';
import { DatabaseService } from './database';
import { PollerService } from './poller';
import { DiscoveryService } from './discovery';
import { DesignerAPI } from './designer-api';
import { SMCAPI } from './smc-api';

let mainWindow: BrowserWindow | null = null;
let db: DatabaseService;
let poller: PollerService;
let discovery: DiscoveryService;

const DIST = path.join(__dirname, '../dist');
const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1600,
    height: 1000,
    minWidth: 1200,
    minHeight: 800,
    title: 'd3Watch',
    backgroundColor: '#0A0E17',
    titleBarStyle: 'hiddenInset',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    icon: path.join(__dirname, '../public/icon.png'),
  });

  if (VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(VITE_DEV_SERVER_URL);
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(DIST, 'index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function setupIPC() {
  // Database queries
  ipcMain.handle('db:getMachines', () => db.getMachines());
  ipcMain.handle('db:getMachine', (_e, id: string) => db.getMachine(id));
  ipcMain.handle('db:getHealthSnapshots', (_e, machineId: string, limit: number) =>
    db.getHealthSnapshots(machineId, limit)
  );
  ipcMain.handle('db:getTemperatureReadings', (_e, machineId: string, limit: number) =>
    db.getTemperatureReadings(machineId, limit)
  );
  ipcMain.handle('db:getNotifications', (_e, machineId: string, limit: number) =>
    db.getNotifications(machineId, limit)
  );
  ipcMain.handle('db:getVFCEvents', (_e, machineId: string) =>
    db.getVFCEvents(machineId)
  );

  // Issues
  ipcMain.handle('db:getIssues', (_e, filters?: Record<string, string>) =>
    db.getIssues(filters)
  );
  ipcMain.handle('db:getIssue', (_e, id: string) => db.getIssue(id));
  ipcMain.handle('db:createIssue', (_e, issue: Record<string, unknown>) =>
    db.createIssue(issue)
  );
  ipcMain.handle('db:updateIssue', (_e, id: string, updates: Record<string, unknown>) =>
    db.updateIssue(id, updates)
  );
  ipcMain.handle('db:addComment', (_e, issueId: string, comment: Record<string, unknown>) =>
    db.addComment(issueId, comment)
  );
  ipcMain.handle('db:getComments', (_e, issueId: string) =>
    db.getComments(issueId)
  );

  // Network profiles
  ipcMain.handle('db:getProfiles', () => db.getProfiles());
  ipcMain.handle('db:saveProfile', (_e, profile: Record<string, unknown>) =>
    db.saveProfile(profile)
  );
  ipcMain.handle('db:deleteProfile', (_e, id: string) => db.deleteProfile(id));

  // API calls
  ipcMain.handle('api:detectSystems', (_e, serverIp: string) =>
    DesignerAPI.detectSystems(serverIp)
  );
  ipcMain.handle('api:getVFCs', (_e, serverIp: string) =>
    DesignerAPI.getVFCs(serverIp)
  );
  ipcMain.handle('api:getGPUOutputs', (_e, serverIp: string) =>
    DesignerAPI.getGPUOutputs(serverIp)
  );
  ipcMain.handle('api:getHealth', (_e, serverIp: string) =>
    DesignerAPI.getHealth(serverIp)
  );
  ipcMain.handle('api:getNetworkAdapters', (_e, serverIp: string) =>
    DesignerAPI.getNetworkAdapters(serverIp)
  );
  ipcMain.handle('api:getNotifications', (_e, serverIp: string) =>
    DesignerAPI.getNotifications(serverIp)
  );
  ipcMain.handle('api:getSessionStatus', (_e, serverIp: string) =>
    DesignerAPI.getSessionStatus(serverIp)
  );
  ipcMain.handle('api:getProjectStatus', (_e, serverIp: string) =>
    DesignerAPI.getProjectStatus(serverIp)
  );
  ipcMain.handle('api:getOSInfo', (_e, serverIp: string) =>
    DesignerAPI.getOSInfo(serverIp)
  );

  // SMC API calls
  ipcMain.handle('smc:getChassisStats', (_e, smcIp: string) =>
    SMCAPI.getChassisStats(smcIp)
  );
  ipcMain.handle('smc:getPowerStatus', (_e, smcIp: string) =>
    SMCAPI.getPowerStatus(smcIp)
  );
  ipcMain.handle('smc:powerOn', (_e, smcIp: string, auth: string) =>
    SMCAPI.powerOn(smcIp, auth)
  );
  ipcMain.handle('smc:powerOff', (_e, smcIp: string, auth: string) =>
    SMCAPI.powerOff(smcIp, auth)
  );
  ipcMain.handle('smc:powerCycle', (_e, smcIp: string, auth: string) =>
    SMCAPI.powerCycle(smcIp, auth)
  );
  ipcMain.handle('smc:identify', (_e, smcIp: string) =>
    SMCAPI.identify(smcIp)
  );
  ipcMain.handle('smc:sendOLED', (_e, smcIp: string, message: string, auth: string) =>
    SMCAPI.sendOLEDNotification(smcIp, message, auth)
  );
  ipcMain.handle('smc:getNetworkAdapters', (_e, smcIp: string) =>
    SMCAPI.getNetworkAdapters(smcIp)
  );
  ipcMain.handle('smc:setNetworkAdapter', (_e, smcIp: string, mac: string, config: Record<string, string>, auth: string) =>
    SMCAPI.setNetworkAdapter(smcIp, mac, config, auth)
  );
  ipcMain.handle('smc:setHostname', (_e, smcIp: string, hostname: string, auth: string) =>
    SMCAPI.setHostname(smcIp, hostname, auth)
  );
  ipcMain.handle('smc:getLocalMachine', (_e, smcIp: string) =>
    SMCAPI.getLocalMachine(smcIp)
  );

  // Discovery
  ipcMain.handle('discovery:start', () => {
    discovery.start();
  });
  ipcMain.handle('discovery:stop', () => {
    discovery.stop();
  });
  ipcMain.handle('discovery:addManual', (_e, ip: string) => {
    discovery.addManualServer(ip);
  });

  // Poller controls
  ipcMain.handle('poller:start', () => poller.start());
  ipcMain.handle('poller:stop', () => poller.stop());
  ipcMain.handle('poller:setInterval', (_e, ms: number) => poller.setInterval(ms));

  // Notifications
  ipcMain.handle('notify:desktop', (_e, title: string, body: string) => {
    new Notification({ title, body }).show();
  });

  // Settings
  ipcMain.handle('settings:get', (_e, key: string) => db.getSetting(key));
  ipcMain.handle('settings:set', (_e, key: string, value: string) => db.setSetting(key, value));
}

app.whenReady().then(() => {
  db = new DatabaseService();
  discovery = new DiscoveryService(db, (data) => {
    mainWindow?.webContents.send('discovery:update', data);
  });
  poller = new PollerService(db, (event, data) => {
    mainWindow?.webContents.send(event, data);
  });

  createWindow();
  setupIPC();

  discovery.start();
  poller.start();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  poller.stop();
  discovery.stop();
  db.close();
  if (process.platform !== 'darwin') app.quit();
});
