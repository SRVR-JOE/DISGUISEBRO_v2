# ⚡ d3Watch — SMC Deep Integration & Profile Deployment Engine

## Addendum #2 to d3Watch Development Plan
**Joe Bradley — Solotech | March 2026**

---

## 1. SMC API — The Full Writable Surface

This is the game-changer most people don't know about. The SMC API isn't just for reading status — it has **POST endpoints that write configuration** directly to the server hardware, bypassing the Windows OS entirely. This means d3Watch can function as a fleet management tool, not just a monitoring dashboard.

### Complete SMC API Endpoint Map

**Base URL:** `http://{smc-ip}/api/...` (MGMT port) or `http://172.31.250.9/api/...` (from host)

**Auth:** All POST endpoints require basic auth. Create account via SMC web UI with OLED verification code. The main Designer API server can also forward requests to the SMC, so you can access SMC endpoints at the same address as the Designer APIs.

| Category | Endpoint | Method | Auth | What It Does |
|----------|----------|--------|------|-------------|
| **Network Adapters** | `/api/networkadapters` | GET | No | Returns all NICs: name, IP, MAC, netmask |
| | `/api/networkadapters` | POST | Yes | **WRITES** NIC config: name, IP, netmask for ALL adapters |
| | `/api/networkadapters/{mac}` | GET | No | Returns single NIC by MAC address |
| | `/api/networkadapters/{mac}` | POST | Yes | **WRITES** config for single NIC by MAC |
| **Machine Identity** | `/api/localmachine` | GET | No | Returns hostname, serial number, machine type |
| | `/api/localmachine` | POST | Yes | **WRITES** hostname (computer name!) |
| **Power Control** | `/api/chassis/power/on` | POST | Yes | Power on via IPMI |
| | `/api/chassis/power/off` | POST | Yes | Power off via IPMI (NOT graceful — hard power off) |
| | `/api/chassis/power/cycle` | POST | Yes | Power cycle via IPMI (hard reboot) |
| | `/api/chassis/power/status` | GET | Yes | Returns power state |
| **System Stats** | `/api/chassis/stats` | GET | No | Returns fan speeds, temps, voltages, power draw via IPMI |
| **Server Identification** | `/api/chassis/whoami` | POST | No | Blinks OLED screen + rear LED strip for physical ID |
| **VFC Cards** | `/api/vfc` | GET | No | Returns installed VFC card inventory |
| **Session Info** | `/api/session` | GET | No | Returns d3Net session details |
| **SMC System** | `/api/smc` or `/api/remora` | GET | No | Returns SMC firmware version, hardware revision |
| **Front Screen** | `/api/oled/notification` | POST | Yes | **Pushes custom notification to OLED screen** (max 200 chars) |
| | `/api/oled/notification/time` | POST | Yes | Sets how long notifications display (default 10s) |
| **Rear LED Strip** | `/api/ledstrip` | Various | Yes | Controls rear chassis LED strip |

**Ref links:**
- Network Adapters: [developer.disguise.one/smc/api/adapters](https://developer.disguise.one/smc/api/adapters/)
- Machine: [developer.disguise.one/smc/api/machine](https://developer.disguise.one/smc/api/machine/)
- Chassis: [developer.disguise.one/smc/api/chassis](https://developer.disguise.one/smc/api/chassis/)
- Front Screen: [developer.disguise.one/smc/api/oled](https://developer.disguise.one/smc/api/oled/)
- VFC: [developer.disguise.one/smc/api/vfc](https://developer.disguise.one/smc/api/vfc/)
- Session: [developer.disguise.one/smc/api/session](https://developer.disguise.one/smc/api/session/)
- SMC: [developer.disguise.one/smc/api/smc](https://developer.disguise.one/smc/api/smc/)
- Lighting: [developer.disguise.one/smc/api/ledstrip](https://developer.disguise.one/smc/api/ledstrip/)
- OpenAPI spec download: [developer.disguise.one/smc/openapi](https://developer.disguise.one/smc/openapi/)
- SMC intro & auth: [developer.disguise.one/smc/introduction](https://developer.disguise.one/smc/introduction/)

---

## 2. Profile Deployment Engine — The Killer Feature

### The Problem This Solves

Right now when Solotech preps a rack of Disguise servers for a new tour, someone manually:
1. Logs into each server
2. Renames each NIC (A - d3net 1Gbit, B - NDI 10Gbit, etc.)
3. Sets IPs, subnets, gateways on every adapter
4. Renames the computer hostname to match the show convention
5. Repeats for every server in the rack
6. Prays nothing gets fat-fingered

This is error-prone, time-consuming, and undocumented. d3Watch replaces all of this with a one-click profile deployment system.

### How It Works

#### Step 1: Define a Profile

A profile is a JSON template that describes the complete network + identity configuration for a specific server role in a specific show.

```json
{
  "profileName": "Post Malone 2026 - Director",
  "profileVersion": "1.2",
  "createdBy": "Joe Bradley",
  "createdAt": "2026-03-20T14:00:00Z",
  "showName": "Post Malone - F-1 Trillion Tour 2026",
  
  "machine": {
    "hostname": "PM26-DIR-GX3",
    "role": "Director"
  },
  
  "networkAdapters": [
    {
      "matchBy": "position",
      "position": 1,
      "name": "A - d3net 1Gbit",
      "ip": "10.0.0.1",
      "netmask": "255.255.255.0"
    },
    {
      "matchBy": "position",
      "position": 2,
      "name": "B - NDI 10Gbit",
      "ip": "10.30.0.1",
      "netmask": "255.255.255.0"
    },
    {
      "matchBy": "position",
      "position": 3,
      "name": "C - Content 100Gbit",
      "ip": "10.50.0.1",
      "netmask": "255.255.255.0"
    },
    {
      "matchBy": "speed",
      "speed": "1Gbps",
      "name": "D - Mgmt 1Gbit",
      "ip": "192.168.1.1",
      "netmask": "255.255.255.0"
    }
  ],

  "vlans": {
    "10": "D3 Net",
    "30": "NDI",
    "50": "Content / Media",
    "1300": "Dante Primary",
    "1301": "Dante Secondary"
  }
}
```

#### Step 2: Assign Profile to Server

In d3Watch, you see all discovered servers. You drag-and-drop (or select) a profile onto a server. The app:

1. Reads current NIC config via `GET /api/networkadapters`
2. Matches physical NICs to profile entries by MAC position or link speed
3. Shows a **preview diff** — current config vs. proposed config, highlighted
4. User reviews and confirms

#### Step 3: Deploy

On confirmation, d3Watch:

1. `POST /api/localmachine` with the new hostname — **this renames the computer**
2. `POST /api/networkadapters/{mac}` for each NIC — **this sets IP, name, and netmask**
3. Optionally: `POST /api/oled/notification` to push a message to the server's front OLED: "Config applied by d3Watch — PM26-DIR-GX3"
4. Logs the deployment event with full before/after snapshots in the issue tracker
5. Verifies by re-reading config and comparing to expected state

#### Step 4: Validate

After deployment, d3Watch automatically:
- Re-queries all NIC configs to confirm they match the profile
- Pings the new IP addresses to confirm network connectivity
- Flags any mismatches as issues
- Generates a deployment report (PDF or stored in session history)

### Profile Templates — Solotech Standards

Pre-built template library based on Solotech's standard VLAN conventions:

| Template | Hostname Pattern | d3net IP | NDI IP | Content IP |
|----------|-----------------|----------|--------|------------|
| Tour Director GX3 | {SHOW}-DIR-GX3 | 10.0.0.1 | 10.30.0.1 | 10.50.0.1 |
| Tour Actor 1 GX3 | {SHOW}-ACT1-GX3 | 10.0.0.11 | 10.30.0.11 | 10.50.0.11 |
| Tour Actor 2 GX3 | {SHOW}-ACT2-GX3 | 10.0.0.12 | 10.30.0.12 | 10.50.0.12 |
| Tour Understudy GX3 | {SHOW}-USD-GX3 | 10.0.0.21 | 10.30.0.21 | 10.50.0.21 |
| Festival Director EX3 | {FEST}-DIR-EX3 | 10.0.0.1 | — | 10.50.0.1 |
| Render Node RX3 | {SHOW}-RX-{N} | 10.0.0.{100+N} | — | 10.50.0.{100+N} |

Templates use variables (`{SHOW}`, `{N}`) that get filled in at assignment time.

### Bulk Deployment

For a full rack of servers:

1. Create a **Deployment Plan** that maps profiles to servers:
   ```
   GX3-44150  →  "Post Malone 2026 - Director"
   GX3-44151  →  "Post Malone 2026 - Actor 1"
   GX3-44152  →  "Post Malone 2026 - Actor 2"
   GX3-44153  →  "Post Malone 2026 - Understudy"
   RX3-55201  →  "Post Malone 2026 - Render 1"
   RX3-55202  →  "Post Malone 2026 - Render 2"
   ```

2. Preview ALL changes across ALL servers in a single summary view
3. Deploy ALL at once — d3Watch fires POST requests to each SMC in parallel
4. Watch a live progress indicator as each server reports back success
5. Full validation pass across all servers
6. Generate a "Rack Ready" report

### Profile Versioning

Each profile saves its history. When you modify a profile, the previous version is retained. This creates an audit trail:

- "v1.0 — Initial setup"
- "v1.1 — Changed NDI subnet from /24 to /16 per festival request"
- "v1.2 — Added Dante VLAN adapters"

### Profile Import/Export

Profiles export as `.d3profile` files (just JSON with a custom extension) that can be:
- Shared between d3Watch instances
- Emailed to other Solotech techs
- Stored in a shared network drive as a company library
- Version-controlled in Git

---

## 3. Game-Changing SMC Integrations

### A. Fleet Power Management Dashboard

Since the SMC lets you power on/off/cycle servers via IPMI, d3Watch can serve as a power management console for the entire rack.

**Features:**
- Visual rack layout showing power state of every server
- Bulk power-on sequence (power up Director first, then Actors, then Render nodes — with configurable delay between each)
- Bulk power-off with safety confirmation (red "Are you sure?" modal)
- Scheduled power operations (e.g., "Power on all servers at 08:00 for soundcheck")
- **Safety lock:** Option to lock out power-off during show hours to prevent accidents
- Power cycle individual servers for troubleshooting

**Critical safety note:** The SMC power-off is a **hard IPMI power cut** — it does NOT gracefully shut down Windows. d3Watch should always warn users and recommend using Windows shutdown first. The IPMI power-off should be labeled as "EMERGENCY POWER OFF" in the UI.

**API calls:**
- `GET /api/chassis/power/status` — poll power state
- `POST /api/chassis/power/on` — power on
- `POST /api/chassis/power/off` — emergency hard power off
- `POST /api/chassis/power/cycle` — hard power cycle

**Ref:** [developer.disguise.one/smc/api/chassis](https://developer.disguise.one/smc/api/chassis/)

---

### B. Physical Server Identification ("Find My Server")

In a rack room with 20 identical-looking Disguise servers, finding a specific one is a pain. The SMC has a brilliant endpoint for this.

`POST /api/chassis/whoami` — **blinks the OLED screen AND rear LED strip** on the target server.

**d3Watch integration:**
- Right-click any server in the dashboard → "Identify" → server starts blinking
- Or click a "Find Me" button on the server detail view
- Visual feedback in d3Watch shows which server is currently blinking
- Useful during cable tracing, troubleshooting, and initial rack documentation

**Ref:** [developer.disguise.one/smc/api/chassis](https://developer.disguise.one/smc/api/chassis/)

---

### C. OLED Message System ("Push to Screen")

The SMC can push custom notifications to the front OLED display on any server. This is incredibly powerful for production communication.

`POST /api/oled/notification` — send up to 200 characters to the front screen.

**Use cases:**
- **Deployment status:** "Config applied ✓ — PM26-DIR-GX3" pushed to the OLED after profile deployment
- **Show status:** "SHOW LIVE — DO NOT TOUCH" pushed to all servers during performance
- **Maintenance alerts:** "Scheduled reboot in 5 min" pushed before planned maintenance
- **Tech identification:** "Assigned to: Joe B. — Rack 3" pushed during prep week
- **Custom messages:** Free-form text field in d3Watch to push any message to any server's OLED

**Implementation in d3Watch:**
- Message composer with character counter (200 max)
- Target selector: single server, all servers, or tagged group
- Duration setting via `/api/oled/notification/time`
- Message templates library (pre-built common messages)
- Scheduled messages (push "SHOW LIVE" message at showtime automatically)

**Ref:** [developer.disguise.one/smc/api/oled](https://developer.disguise.one/smc/api/oled/)

---

### D. Rear LED Strip Control

The SMC controls the rear LED strip on the chassis. d3Watch can use this for:

- **Visual rack mapping:** Set different LED colors per server role (Director = blue, Actor = green, Understudy = amber)
- **Alert visualization:** Flash red when a server has a critical issue
- **Cable tracing:** Light up a specific server's rear LED while tracing connections at the patch panel

**Ref:** [developer.disguise.one/smc/api/ledstrip](https://developer.disguise.one/smc/api/ledstrip/)

---

### E. Comprehensive Hardware Telemetry via `/api/chassis/stats`

This endpoint returns ALL IPMI sensor data — the full spread of what the BMC can see:

- CPU temperatures (per socket)
- System/ambient temperature
- GPU temperature
- Fan speeds (RPM per fan)
- Voltages (3.3V, 5V, 12V, VBAT, CPU Vcore, DIMM)
- Power draw (watts)
- Power supply status (redundancy, faults)
- Chassis intrusion detection

**d3Watch uses this for:**
- The 3D thermal model (Addendum #1)
- Real-time voltage monitoring (detect PSU issues before they cause crashes)
- Fan failure detection (if any fan reads 0 RPM while server is on)
- Power consumption tracking over time (useful for venue power planning)
- Historical logging for trend analysis and failure prediction

**Ref:** [developer.disguise.one/smc/api/chassis](https://developer.disguise.one/smc/api/chassis/)

---

### F. Pre-Show Automated Health Sweep + OLED Feedback

Combining multiple SMC and Designer APIs into a single automated workflow:

1. **Discovery:** Auto-discover all servers via DNS-SD + SMC network scan
2. **Power check:** Verify all expected servers are powered on via chassis status
3. **Identity check:** Confirm hostnames match expected deployment plan via localmachine
4. **Network check:** Verify all NIC configs match the deployed profile via networkadapters
5. **VFC check:** Confirm all expected VFC cards are present with correct firmware
6. **Health check:** Query Designer health API for FPS, genlock, system states
7. **Thermal check:** Query chassis stats for temperatures within spec
8. **Report:** Generate go/no-go checklist with timestamp
9. **OLED feedback:** Push "✓ PRE-SHOW CHECK PASSED" or "⚠ CHECK FAILED — SEE d3Watch" to each server's OLED

This runs as a one-click "Pre-Show Check" button in d3Watch. The entire sweep takes seconds because all API calls are parallelized across servers.

---

### G. Configuration Drift Detection

After profiles are deployed, d3Watch continuously monitors for configuration drift:

- Every poll cycle, compare current NIC config against the deployed profile
- If someone manually changes an IP address, renames a NIC, or modifies the hostname, d3Watch immediately flags it
- Option to auto-remediate: "Drift detected on GX3-44150 — NIC B changed from 10.30.0.1 to DHCP. [Restore] [Ignore] [Create Issue]"

This is critical in production environments where multiple techs have access to servers.

---

## 4. Hybrid API Strategy — SMC + Designer + PowerShell

The SMC API handles network adapter IPs, names, and netmasks, plus hostname. But some configuration tasks go beyond what the SMC API exposes:

| Configuration Task | Available Via SMC API? | Alternative Approach |
|-------------------|----------------------|---------------------|
| NIC IP address | ✅ Yes — POST networkadapters | — |
| NIC name (friendly name) | ✅ Yes — POST networkadapters | — |
| NIC netmask | ✅ Yes — POST networkadapters | — |
| Computer hostname | ✅ Yes — POST localmachine | — |
| NIC teaming | ❌ No | PowerShell via WinRM/SSH: `New-NetLbfoTeam` |
| VLAN creation (Hyper-V) | ❌ No | PowerShell: `Add-VMNetworkAdapter`, `Set-VMNetworkAdapterVlan` |
| VLAN creation (PowerShell) | ❌ No | PowerShell: `Add-NetLbfoTeamNic -VlanID` |
| DNS settings | ❌ No | PowerShell: `Set-DnsClientServerAddress` |
| Gateway settings | ❓ Unclear — netmask is there, gateway not in docs | PowerShell: `New-NetRoute` |
| Firewall rules | ❌ No | PowerShell: `New-NetFirewallRule` |
| SMB shares | ❌ No | PowerShell: `New-SmbShare` |
| Windows hostname (full) | ❌ No | PowerShell: `Rename-Computer` |

**Recommendation:** For Phase 1, use the SMC API for everything it supports natively (IP, NIC name, netmask, hostname). For Phase 2, add a PowerShell remoting layer (via WinRM or SSH to the Windows OS) for advanced operations like NIC teaming, VLANs, DNS, firewall, and SMB shares. This builds on top of the d3Config app spec you've already designed.

The PowerShell layer would use the same profile JSON — it just extends the schema with additional fields:

```json
{
  "advanced": {
    "nicTeams": [
      {
        "teamName": "Content Team",
        "members": ["NIC3", "NIC4"],
        "teamingMode": "LACP",
        "loadBalancing": "HyperVPort"
      }
    ],
    "vlans": [
      {
        "parentAdapter": "Content Team",
        "vlanId": 50,
        "name": "Content VLAN 50",
        "ip": "10.50.0.1",
        "netmask": "255.255.255.0"
      }
    ],
    "dns": ["8.8.8.8", "8.8.4.4"],
    "firewall": {
      "enablePing": true,
      "openPorts": [80, 443, 7401, 7402]
    },
    "smbShares": [
      {
        "name": "d3media",
        "path": "D:\\d3media",
        "fullAccess": ["Everyone"]
      }
    ]
  }
}
```

---

## 5. Complete SMC-Integrated Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                       d3Watch App                            │
├──────────┬──────────┬──────────┬──────────┬─────────────────┤
│ Dashboard│ 3D View  │ Profiles │ Issues   │ Fleet Mgmt      │
│          │          │          │          │                  │
│ Health   │ Thermal  │ Create   │ Track    │ Power Control    │
│ Monitor  │ Sensors  │ Assign   │ Record   │ Identify (blink)│
│ VFC View │ Fan RPM  │ Deploy   │ Resolve  │ OLED Messages   │
│ Alerts   │ Voltages │ Validate │ Export   │ LED Strip Ctrl  │
│          │          │ Drift    │          │ Bulk Deploy      │
│          │          │ Detect   │          │ Pre-Show Check   │
└──────────┴──────────┴──────────┴──────────┴─────────────────┘
         ↕               ↕              ↕              ↕
    ┌──────────┐   ┌───────────┐  ┌──────────┐  ┌──────────┐
    │ Designer │   │ SMC API   │  │ WinRM/   │  │ SQLite   │
    │ API      │   │ (MGMT)    │  │ SSH      │  │ Local DB │
    │          │   │           │  │ (Phase2) │  │          │
    │ Service: │   │ Chassis:  │  │          │  │ History  │
    │  detect  │   │  stats    │  │ NIC Team │  │ Profiles │
    │  vfcs    │   │  power    │  │ VLANs    │  │ Issues   │
    │  network │   │  whoami   │  │ DNS      │  │ Snapshots│
    │  gpu     │   │           │  │ Firewall │  │ Events   │
    │          │   │ Machine:  │  │ SMB      │  │          │
    │ Session: │   │  hostname │  │          │  │          │
    │  health  │   │  serial   │  │          │  │          │
    │  status  │   │           │  │          │  │          │
    │  notify  │   │ Network:  │  │          │  │          │
    │  transp  │   │  adapters │  │          │  │          │
    │          │   │  (R/W!)   │  │          │  │          │
    │ Live     │   │           │  │          │  │          │
    │ Update:  │   │ OLED:     │  │          │  │          │
    │  stream  │   │  notify   │  │          │  │          │
    │          │   │           │  │          │  │          │
    │ Port 80  │   │ LED Strip │  │          │  │          │
    └──────────┘   └───────────┘  └──────────┘  └──────────┘
```

---

## 6. Development Phases for SMC Integration

| Phase | Work | Priority |
|-------|------|----------|
| **Phase 1** | SMC auth setup (account creation flow with OLED code). Read-only SMC integration: chassis stats (temps, fans, voltages, power), localmachine (hostname/serial/type), VFC cards, network adapters. Feed data into dashboard, 3D view, and health monitoring. | High — foundation |
| **Phase 2** | Profile engine: create, edit, assign profiles. Preview diff. Deploy hostname via `POST /localmachine` and NIC config via `POST /networkadapters/{mac}`. Validation pass. Deployment logging. | High — the killer feature |
| **Phase 3** | Fleet management: power on/off/cycle dashboard, server identification (whoami/blink), OLED messaging system, rear LED strip control. | High — production value |
| **Phase 4** | Bulk deployment: multi-server deployment plans, parallel execution, progress tracking, "Rack Ready" report generation. | Medium — scale |
| **Phase 5** | Pre-show automated health sweep with OLED feedback. Configuration drift detection with auto-remediation option. | Medium — reliability |
| **Phase 6** | PowerShell remoting layer for advanced config (NIC teaming, VLANs, DNS, firewall, SMB). Extends profile schema. | Lower — d3Config overlap |
| **Phase 7** | Profile library: Solotech standard templates, version history, import/export as `.d3profile` files, shared network library. | Medium — team value |

---

## 7. Reference Links

| Resource | URL |
|----------|-----|
| **SMC API — Full Developer Docs** | [developer.disguise.one/smc](https://developer.disguise.one/smc/) |
| **SMC Introduction & Auth** | [developer.disguise.one/smc/introduction](https://developer.disguise.one/smc/introduction/) |
| **Network Adapter API (READ + WRITE)** | [developer.disguise.one/smc/api/adapters](https://developer.disguise.one/smc/api/adapters/) |
| **Local Machine API (hostname WRITE)** | [developer.disguise.one/smc/api/machine](https://developer.disguise.one/smc/api/machine/) |
| **Chassis API (power, stats, whoami)** | [developer.disguise.one/smc/api/chassis](https://developer.disguise.one/smc/api/chassis/) |
| **Front Screen / OLED API** | [developer.disguise.one/smc/api/oled](https://developer.disguise.one/smc/api/oled/) |
| **VFC API** | [developer.disguise.one/smc/api/vfc](https://developer.disguise.one/smc/api/vfc/) |
| **Session API** | [developer.disguise.one/smc/api/session](https://developer.disguise.one/smc/api/session/) |
| **LED Strip API** | [developer.disguise.one/smc/api/ledstrip](https://developer.disguise.one/smc/api/ledstrip/) |
| **SMC API (system info)** | [developer.disguise.one/smc/api/smc](https://developer.disguise.one/smc/api/smc/) |
| **OpenAPI Spec Download** | [developer.disguise.one/smc/openapi](https://developer.disguise.one/smc/openapi/) |
| **SMC User Guide (overview, access, auth)** | [help.disguise.one/hardware/smc/smc-overview](https://help.disguise.one/hardware/smc/smc-overview) |
| **SMC Troubleshooting** | [help.disguise.one/hardware/smc/smc-troubleshooting](https://help.disguise.one/hardware/smc/smc-troubleshooting) |
| **Designer Service API (system)** | [developer.disguise.one/api/service/system](https://developer.disguise.one/api/service/system/) |
| **Designer Session API (status)** | [developer.disguise.one/api/session/status](https://developer.disguise.one/api/session/status/) |
| **Live Update API (streaming)** | [developer.disguise.one/api/session/liveupdate](https://developer.disguise.one/api/session/liveupdate/) |
| **DNS-SD Discovery** | [developer.disguise.one/api/discovery](https://developer.disguise.one/api/discovery/) |
| **Network Configuration Guide** | [help.disguise.one/designer/networking/disguise-system-network-configuration](https://help.disguise.one/designer/networking/disguise-system-network-configuration) |
| **VLAN with Hyper-V** | [help.disguise.one/designer/networking/create-a-vlan-hyperv](https://help.disguise.one/designer/networking/create-a-vlan-hyperv) |
| **VLAN with PowerShell** | [help.disguise.one/designer/networking/create-a-vlan-powershell](https://help.disguise.one/designer/networking/create-a-vlan-powershell) |
| **NIC Teaming** | [help.disguise.one/designer/networking/teaming](https://help.disguise.one/designer/networking/teaming) |
| **Disguise integration contact** | integrations@disguise.one |

---

*This document completes the d3Watch three-part spec package. Combined with the base development plan and the visual dashboard addendum, you have a comprehensive blueprint for a production-grade Disguise fleet management tool that no one else in the industry has.*
