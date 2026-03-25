import type {
  NetworkProfile,
  ProfileAdapter,
  NetworkAdapter,
  ValidationResult,
  ValidationError,
  ValidationWarning,
  DriftResult,
  AdapterDrift,
  ProfileTemplate,
} from '@/types';

// ── ID Generation ────────────────────────────────────────────────────────────

export function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// ── IP Helpers ───────────────────────────────────────────────────────────────

const IPV4_RE = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/;

export function ipToNumber(ip: string): number {
  const parts = ip.split('.').map(Number);
  return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
}

export function isValidIPv4(ip: string): boolean {
  if (!IPV4_RE.test(ip)) return false;
  return ip.split('.').every((o) => {
    const n = Number(o);
    return n >= 0 && n <= 255;
  });
}

const VALID_NETMASK_NUMBERS: Set<number> = (() => {
  const s = new Set<number>();
  for (let prefix = 1; prefix <= 32; prefix++) {
    s.add((0xffffffff << (32 - prefix)) >>> 0);
  }
  return s;
})();

export function isValidNetmask(mask: string): boolean {
  if (!isValidIPv4(mask)) return false;
  return VALID_NETMASK_NUMBERS.has(ipToNumber(mask));
}

export function getSubnet(ip: string, mask: string): string {
  const ipNum = ipToNumber(ip);
  const maskNum = ipToNumber(mask);
  const net = (ipNum & maskNum) >>> 0;
  return [
    (net >>> 24) & 0xff,
    (net >>> 16) & 0xff,
    (net >>> 8) & 0xff,
    net & 0xff,
  ].join('.');
}

// ── Empty Factories ──────────────────────────────────────────────────────────

export function emptyAdapter(): ProfileAdapter {
  return { matchBy: 'position', position: 0, name: '', ip: '', netmask: '255.255.255.0' };
}

export function emptyProfile(): NetworkProfile {
  return {
    id: uid(),
    profileName: '',
    profileVersion: '1.0',
    createdBy: 'operator',
    createdAt: new Date().toISOString(),
    showName: '',
    machine: { hostname: '', role: 'actor' },
    networkAdapters: [emptyAdapter()],
  };
}

// ── Validation ───────────────────────────────────────────────────────────────

export function validateProfile(profile: NetworkProfile): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  if (!profile.profileName.trim()) {
    errors.push({
      field: 'profileName',
      message: 'Profile name is required',
      code: 'MISSING_PROFILE_NAME',
    });
  }

  if (!profile.machine.hostname.trim()) {
    errors.push({
      field: 'machine.hostname',
      message: 'Machine hostname is required',
      code: 'MISSING_HOSTNAME',
    });
  }

  const seenIPs = new Map<string, number>();

  profile.networkAdapters.forEach((adapter, idx) => {
    if (!adapter.name.trim()) {
      errors.push({
        field: 'name',
        adapter: idx,
        message: `Adapter ${idx + 1}: name is required`,
        code: 'MISSING_NAME',
      });
    }

    if (!adapter.ip.trim()) {
      errors.push({
        field: 'ip',
        adapter: idx,
        message: `Adapter ${idx + 1}: IP address is required`,
        code: 'MISSING_IP',
      });
    } else if (!isValidIPv4(adapter.ip)) {
      errors.push({
        field: 'ip',
        adapter: idx,
        message: `Adapter ${idx + 1}: invalid IPv4 address "${adapter.ip}"`,
        code: 'INVALID_IP',
      });
    }

    if (adapter.netmask && !isValidNetmask(adapter.netmask)) {
      errors.push({
        field: 'netmask',
        adapter: idx,
        message: `Adapter ${idx + 1}: invalid netmask "${adapter.netmask}"`,
        code: 'INVALID_NETMASK',
      });
    }

    if (adapter.matchBy === 'mac' && !adapter.mac?.trim()) {
      errors.push({
        field: 'mac',
        adapter: idx,
        message: `Adapter ${idx + 1}: MAC address is required when matchBy is "mac"`,
        code: 'MISSING_MAC',
      });
    }

    // Duplicate IP check
    if (adapter.ip && isValidIPv4(adapter.ip)) {
      const prev = seenIPs.get(adapter.ip);
      if (prev !== undefined) {
        errors.push({
          field: 'ip',
          adapter: idx,
          message: `Adapter ${idx + 1}: duplicate IP "${adapter.ip}" (same as adapter ${prev + 1})`,
          code: 'DUPLICATE_IP',
        });
      } else {
        seenIPs.set(adapter.ip, idx);
      }
    }
  });

  // Same-subnet warning: check all pairs with valid IPs & netmasks
  const validAdapters = profile.networkAdapters
    .map((a, i) => ({ a, i }))
    .filter(({ a }) => isValidIPv4(a.ip) && isValidNetmask(a.netmask));

  for (let i = 0; i < validAdapters.length; i++) {
    for (let j = i + 1; j < validAdapters.length; j++) {
      const ai = validAdapters[i];
      const aj = validAdapters[j];
      const subnetI = getSubnet(ai.a.ip, ai.a.netmask);
      const subnetJ = getSubnet(aj.a.ip, aj.a.netmask);
      if (subnetI === subnetJ && ai.a.netmask === aj.a.netmask) {
        warnings.push({
          field: 'ip',
          adapter: aj.i,
          message: `Adapters ${ai.i + 1} and ${aj.i + 1} share the same subnet (${subnetI}/${ai.a.netmask})`,
          code: 'SAME_SUBNET',
        });
      }
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}

// ── Drift Detection ──────────────────────────────────────────────────────────

function findMatchingAdapter(
  profileAdapter: ProfileAdapter,
  currentAdapters: NetworkAdapter[],
  idx: number,
): NetworkAdapter | undefined {
  // Try matching by MAC first
  if (profileAdapter.matchBy === 'mac' && profileAdapter.mac) {
    const macLower = profileAdapter.mac.toLowerCase();
    return currentAdapters.find((a) => a.mac.toLowerCase() === macLower);
  }
  // Try matching by position (index)
  if (profileAdapter.matchBy === 'position' && idx < currentAdapters.length) {
    return currentAdapters[idx];
  }
  // Fallback: match by name
  return currentAdapters.find(
    (a) => a.name.toLowerCase() === profileAdapter.name.toLowerCase(),
  );
}

function primaryAddress(adapter: NetworkAdapter): { ip: string; subnet: string } {
  if (adapter.addresses.length > 0) {
    return { ip: adapter.addresses[0].ip, subnet: adapter.addresses[0].subnet };
  }
  return { ip: '', subnet: '' };
}

export function detectDrift(
  profile: NetworkProfile,
  currentAdapters: NetworkAdapter[],
  currentHostname: string,
  machineId: string,
): DriftResult {
  const hostnameDrift = profile.machine.hostname !== currentHostname;

  const adapterDrifts: AdapterDrift[] = profile.networkAdapters.map((pa, idx) => {
    const current = findMatchingAdapter(pa, currentAdapters, idx);
    const addr = current ? primaryAddress(current) : { ip: '', subnet: '' };

    const ipDrift = pa.ip !== addr.ip;
    const netmaskDrift = pa.netmask !== addr.subnet;
    const nameDrift = current ? pa.name !== current.name : true;

    return {
      adapterName: pa.name,
      position: pa.position,
      mac: pa.mac,
      currentIp: addr.ip,
      expectedIp: pa.ip,
      currentNetmask: addr.subnet,
      expectedNetmask: pa.netmask,
      currentName: current?.name ?? '',
      expectedName: pa.name,
      ipDrift,
      netmaskDrift,
      nameDrift,
    };
  });

  const hasDrift = hostnameDrift || adapterDrifts.some((d) => d.ipDrift || d.netmaskDrift || d.nameDrift);

  return {
    profileId: profile.id,
    machineId,
    timestamp: new Date().toISOString(),
    hostnameDrift,
    currentHostname,
    expectedHostname: profile.machine.hostname,
    adapterDrifts,
    hasDrift,
  };
}

// ── Profile Helpers ──────────────────────────────────────────────────────────

export function cloneProfile(profile: NetworkProfile, newName?: string): NetworkProfile {
  const clone: NetworkProfile = JSON.parse(JSON.stringify(profile));
  clone.id = uid();
  clone.profileName = newName ?? `Copy of ${profile.profileName}`;
  clone.createdAt = new Date().toISOString();
  return clone;
}

export function createProfileFromSnapshot(
  adapters: NetworkAdapter[],
  hostname: string,
  role: string,
  showName: string,
): NetworkProfile {
  const profileAdapters: ProfileAdapter[] = adapters.map((a, idx) => {
    const addr = a.addresses[0];
    return {
      matchBy: 'position' as const,
      position: idx,
      mac: a.mac,
      name: a.name,
      ip: addr?.ip ?? '',
      netmask: addr?.subnet ?? '',
    };
  });

  return {
    id: uid(),
    profileName: `${hostname} — Snapshot`,
    profileVersion: '1.0',
    createdBy: 'snapshot',
    createdAt: new Date().toISOString(),
    showName,
    machine: { hostname, role },
    networkAdapters: profileAdapters,
  };
}

// ── Solotech Standard Templates ──────────────────────────────────────────────

function solotechAdapters(lastOctet: number): ProfileAdapter[] {
  return [
    { matchBy: 'position', position: 0, name: 'A - d3net 1Gbit', ip: `10.0.0.${lastOctet}`, netmask: '255.255.255.0' },
    { matchBy: 'position', position: 1, name: 'B - d3net 10Gbit', ip: `10.0.1.${lastOctet}`, netmask: '255.255.255.0' },
    { matchBy: 'position', position: 2, name: 'C - NDI', ip: `10.30.0.${lastOctet}`, netmask: '255.255.0.0' },
    { matchBy: 'position', position: 3, name: 'D - MGMT', ip: `192.168.1.${lastOctet}`, netmask: '255.255.255.0' },
  ];
}

export function getProfileTemplates(): ProfileTemplate[] {
  return [
    {
      id: 'tpl-solotech-director',
      name: 'Solotech Director — Standard Touring',
      description: 'Standard Solotech director configuration for touring productions with d3net, NDI, and management VLANs',
      category: 'solotech-standard',
      icon: '🎬',
      profile: {
        profileName: 'Solotech Director — Standard Touring',
        profileVersion: '1.0',
        createdBy: 'Solotech Standard',
        showName: '',
        machine: { hostname: 'DIR-GX3-01', role: 'director' },
        networkAdapters: solotechAdapters(1),
      },
    },
    {
      id: 'tpl-solotech-actor',
      name: 'Solotech Actor — Standard Touring',
      description: 'Standard Solotech actor configuration for touring productions',
      category: 'solotech-standard',
      icon: '🎭',
      profile: {
        profileName: 'Solotech Actor — Standard Touring',
        profileVersion: '1.0',
        createdBy: 'Solotech Standard',
        showName: '',
        machine: { hostname: 'ACT-GX2C-01', role: 'actor' },
        networkAdapters: solotechAdapters(2),
      },
    },
    {
      id: 'tpl-solotech-understudy',
      name: 'Solotech Understudy — Standard Touring',
      description: 'Standard Solotech understudy configuration',
      category: 'solotech-standard',
      icon: '📡',
      profile: {
        profileName: 'Solotech Understudy — Standard Touring',
        profileVersion: '1.0',
        createdBy: 'Solotech Standard',
        showName: '',
        machine: { hostname: 'UND-GX2C-01', role: 'understudy' },
        networkAdapters: solotechAdapters(10),
      },
    },
    {
      id: 'tpl-broadcast-studio',
      name: 'Broadcast — Studio Install',
      description: 'Studio broadcast configuration with Dante audio and NDI video networks',
      category: 'broadcast',
      icon: '📺',
      profile: {
        profileName: 'Broadcast — Studio Install',
        profileVersion: '1.0',
        createdBy: 'Solotech Standard',
        showName: '',
        machine: { hostname: 'BCAST-GX3-01', role: 'director' },
        networkAdapters: [
          { matchBy: 'position', position: 0, name: 'A - d3net Primary', ip: '10.0.0.1', netmask: '255.255.255.0' },
          { matchBy: 'position', position: 1, name: 'B - d3net Backup', ip: '10.0.1.1', netmask: '255.255.255.0' },
          { matchBy: 'position', position: 2, name: 'C - NDI Video', ip: '10.30.0.1', netmask: '255.255.0.0' },
          { matchBy: 'position', position: 3, name: 'D - Dante Audio', ip: '172.31.0.1', netmask: '255.255.0.0' },
          { matchBy: 'position', position: 4, name: 'E - Management', ip: '192.168.1.1', netmask: '255.255.255.0' },
        ],
      },
    },
    {
      id: 'tpl-minimal-single',
      name: 'Minimal — Single Network',
      description: 'Simple single-network configuration for basic setups or testing',
      category: 'custom',
      icon: '🔧',
      profile: {
        profileName: 'Minimal — Single Network',
        profileVersion: '1.0',
        createdBy: 'Solotech Standard',
        showName: '',
        machine: { hostname: 'D3-SERVER-01', role: 'actor' },
        networkAdapters: [
          { matchBy: 'position', position: 0, name: 'A - d3net', ip: '10.0.0.1', netmask: '255.255.255.0' },
        ],
      },
    },
  ];
}
