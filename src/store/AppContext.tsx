import {
  createContext,
  useContext,
  useReducer,
  useEffect,
  useCallback,
  type ReactNode,
  type Dispatch,
} from 'react';
import type {
  Machine,
  HealthData,
  VFCData,
  GPUOutput,
  ChassisStats,
  D3Notification,
} from '@/types';

// === State ===
interface AppState {
  machines: Machine[];
  selectedMachineId: string | null;
  healthData: Record<string, HealthData>;
  vfcData: Record<string, VFCData>;
  gpuData: Record<string, GPUOutput[]>;
  chassisStats: Record<string, ChassisStats>;
  notifications: D3Notification[];
  isPolling: boolean;
  pollInterval: number;
}

const initialState: AppState = {
  machines: [],
  selectedMachineId: null,
  healthData: {},
  vfcData: {},
  gpuData: {},
  chassisStats: {},
  notifications: [],
  isPolling: false,
  pollInterval: 5000,
};

// === Actions ===
type AppAction =
  | { type: 'SET_MACHINES'; payload: Machine[] }
  | { type: 'SELECT_MACHINE'; payload: string | null }
  | { type: 'UPDATE_HEALTH'; payload: { machineId: string; data: HealthData } }
  | { type: 'UPDATE_VFC'; payload: { machineId: string; data: VFCData } }
  | { type: 'UPDATE_GPU'; payload: { machineId: string; data: GPUOutput[] } }
  | { type: 'UPDATE_CHASSIS'; payload: { machineId: string; data: ChassisStats } }
  | { type: 'ADD_NOTIFICATION'; payload: D3Notification }
  | { type: 'CLEAR_NOTIFICATIONS' }
  | { type: 'SET_POLLING'; payload: { isPolling: boolean; interval?: number } };

function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'SET_MACHINES':
      return { ...state, machines: action.payload };

    case 'SELECT_MACHINE':
      return { ...state, selectedMachineId: action.payload };

    case 'UPDATE_HEALTH':
      return {
        ...state,
        healthData: {
          ...state.healthData,
          [action.payload.machineId]: action.payload.data,
        },
      };

    case 'UPDATE_VFC':
      return {
        ...state,
        vfcData: {
          ...state.vfcData,
          [action.payload.machineId]: action.payload.data,
        },
      };

    case 'UPDATE_GPU':
      return {
        ...state,
        gpuData: {
          ...state.gpuData,
          [action.payload.machineId]: action.payload.data,
        },
      };

    case 'UPDATE_CHASSIS':
      return {
        ...state,
        chassisStats: {
          ...state.chassisStats,
          [action.payload.machineId]: action.payload.data,
        },
      };

    case 'ADD_NOTIFICATION':
      return {
        ...state,
        notifications: [action.payload, ...state.notifications].slice(0, 200),
      };

    case 'CLEAR_NOTIFICATIONS':
      return { ...state, notifications: [] };

    case 'SET_POLLING':
      return {
        ...state,
        isPolling: action.payload.isPolling,
        pollInterval: action.payload.interval ?? state.pollInterval,
      };

    default:
      return state;
  }
}

// === Context ===
interface AppContextValue {
  state: AppState;
  dispatch: Dispatch<AppAction>;
  // Convenience accessors (mirror state properties)
  machines: Machine[];
  notifications: D3Notification[];
  // Actions
  setMachines: (machines: Machine[]) => void;
  selectMachine: (id: string | null) => void;
  updateHealth: (machineId: string, data: HealthData) => void;
  updateVFC: (machineId: string, data: VFCData) => void;
  updateGPU: (machineId: string, data: GPUOutput[]) => void;
  updateChassis: (machineId: string, data: ChassisStats) => void;
  addNotification: (notification: D3Notification) => void;
  clearNotifications: () => void;
  setPolling: (isPolling: boolean, interval?: number) => void;
}

const AppContext = createContext<AppContextValue | null>(null);

// === Provider ===
export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(appReducer, initialState);

  const setMachines = useCallback(
    (machines: Machine[]) => dispatch({ type: 'SET_MACHINES', payload: machines }),
    []
  );

  const selectMachine = useCallback(
    (id: string | null) => dispatch({ type: 'SELECT_MACHINE', payload: id }),
    []
  );

  const updateHealth = useCallback(
    (machineId: string, data: HealthData) =>
      dispatch({ type: 'UPDATE_HEALTH', payload: { machineId, data } }),
    []
  );

  const updateVFC = useCallback(
    (machineId: string, data: VFCData) =>
      dispatch({ type: 'UPDATE_VFC', payload: { machineId, data } }),
    []
  );

  const updateGPU = useCallback(
    (machineId: string, data: GPUOutput[]) =>
      dispatch({ type: 'UPDATE_GPU', payload: { machineId, data } }),
    []
  );

  const updateChassis = useCallback(
    (machineId: string, data: ChassisStats) =>
      dispatch({ type: 'UPDATE_CHASSIS', payload: { machineId, data } }),
    []
  );

  const addNotification = useCallback(
    (notification: D3Notification) =>
      dispatch({ type: 'ADD_NOTIFICATION', payload: notification }),
    []
  );

  const clearNotifications = useCallback(
    () => dispatch({ type: 'CLEAR_NOTIFICATIONS' }),
    []
  );

  const setPolling = useCallback(
    (isPolling: boolean, interval?: number) =>
      dispatch({ type: 'SET_POLLING', payload: { isPolling, interval } }),
    []
  );

  // Load machines on mount
  useEffect(() => {
    async function loadMachines() {
      try {
        if (window.d3watch?.db?.getMachines) {
          const machines = await window.d3watch.db.getMachines();
          setMachines(machines);
        }
      } catch (err) {
        console.error('[d3Watch] Failed to load machines:', err);
      }
    }
    loadMachines();
  }, [setMachines]);

  // Listen for IPC events from Electron
  useEffect(() => {
    if (!window.d3watch?.on) return;

    const unsubscribers: (() => void)[] = [];

    unsubscribers.push(
      window.d3watch.on('machines-updated', (machines: unknown) => {
        setMachines(machines as Machine[]);
      })
    );

    unsubscribers.push(
      window.d3watch.on('health-updated', (payload: unknown) => {
        const { machineId, data } = payload as { machineId: string; data: HealthData };
        updateHealth(machineId, data);
      })
    );

    unsubscribers.push(
      window.d3watch.on('vfc-updated', (payload: unknown) => {
        const { machineId, data } = payload as { machineId: string; data: VFCData };
        updateVFC(machineId, data);
      })
    );

    unsubscribers.push(
      window.d3watch.on('gpu-updated', (payload: unknown) => {
        const { machineId, data } = payload as { machineId: string; data: GPUOutput[] };
        updateGPU(machineId, data);
      })
    );

    unsubscribers.push(
      window.d3watch.on('chassis-updated', (payload: unknown) => {
        const { machineId, data } = payload as { machineId: string; data: ChassisStats };
        updateChassis(machineId, data);
      })
    );

    unsubscribers.push(
      window.d3watch.on('notification', (notification: unknown) => {
        addNotification(notification as D3Notification);
      })
    );

    unsubscribers.push(
      window.d3watch.on('polling-status', (payload: unknown) => {
        const { isPolling, interval } = payload as { isPolling: boolean; interval?: number };
        setPolling(isPolling, interval);
      })
    );

    return () => {
      unsubscribers.forEach((unsub) => unsub());
    };
  }, [setMachines, updateHealth, updateVFC, updateGPU, updateChassis, addNotification, setPolling]);

  const value: AppContextValue = {
    state,
    dispatch,
    machines: state.machines,
    notifications: state.notifications,
    setMachines,
    selectMachine,
    updateHealth,
    updateVFC,
    updateGPU,
    updateChassis,
    addNotification,
    clearNotifications,
    setPolling,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

// === Hook ===
export function useAppContext(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return ctx;
}

export default AppContext;
