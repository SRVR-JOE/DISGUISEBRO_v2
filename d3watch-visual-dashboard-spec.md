# ⚡ d3Watch — Visual Dashboard, 3D Server Model & Issue Tracker

## Addendum to d3Watch Development Plan
**Joe Bradley — Solotech | March 2026**

---

## Table of Contents

1. [Visual Dashboard Design](#1-visual-dashboard-design)
2. [3D Interactive Server Model](#2-3d-interactive-server-model)
3. [Comprehensive Server Info Panels](#3-comprehensive-server-info-panels)
4. [Issue Tracker & Recording System](#4-issue-tracker--recording-system)
5. [Data Architecture for Recording](#5-data-architecture-for-recording)
6. [Implementation Guidance](#6-implementation-guidance)
7. [Reference Links](#7-reference-links)

---

## 1. Visual Dashboard Design

### Design Direction: Dark Industrial Futurism

The aesthetic should feel like a mission control display crossed with high-end AV production tooling — think Disguise's own dark UI crossed with fighter jet HUDs. Dark backgrounds with glowing accent data, scan-line textures, and crisp geometric layouts.

### Color System

| Role | Color | Hex | Usage |
|------|-------|-----|-------|
| Background Primary | Near-black | `#0A0E17` | Main canvas |
| Background Secondary | Dark navy | `#111827` | Cards, panels |
| Background Tertiary | Slate | `#1E293B` | Hover states, raised elements |
| Accent Primary | Electric cyan | `#00F0FF` | Active data, selected states, key metrics |
| Accent Secondary | Neon green | `#00FF88` | Healthy/OK indicators |
| Warning | Amber pulse | `#FFB800` | Warning states |
| Critical | Hot red | `#FF3B3B` | Alarms, critical alerts |
| Text Primary | Clean white | `#F1F5F9` | Headlines, key data |
| Text Secondary | Cool gray | `#94A3B8` | Labels, secondary info |
| Disguise brand accent | Disguise magenta | `#E91E8C` | Brand touches, logo area |

### Typography

| Role | Font | Weight | Size |
|------|------|--------|------|
| Data readout / numbers | `JetBrains Mono` or `IBM Plex Mono` | 500–700 | 14–48px |
| Headers | `Rajdhani` or `Orbitron` | 600–700 | 18–32px |
| Body / labels | `IBM Plex Sans` | 400–500 | 12–14px |
| HUD overlays | `Share Tech Mono` | 400 | 10–12px |

### Main Dashboard Layout

```
┌──────────────────────────────────────────────────────────────────┐
│  ⚡ d3Watch          [Server: GX3-001 ▼]    🟢 All Systems OK   │
│  ─────────────────────────────────────────────────────────────── │
│                                                                  │
│  ┌─────────────────────────────┐  ┌───────────────────────────┐ │
│  │    SERVER OVERVIEW GRID     │  │   REAL-TIME HEALTH RING   │ │
│  │                             │  │                           │ │
│  │  ┌─────┐ ┌─────┐ ┌─────┐  │  │      ┌─────────┐         │ │
│  │  │GX3  │ │GX3  │ │VX4+ │  │  │     /   59.94   \        │ │
│  │  │-001 │ │-002 │ │-003 │  │  │    │    FPS     │        │ │
│  │  │ 🟢  │ │ 🟡  │ │ 🟢  │  │  │     \  LOCKED  /         │ │
│  │  └─────┘ └─────┘ └─────┘  │  │      └─────────┘         │ │
│  │  ┌─────┐ ┌─────┐          │  │   Dropped: 0  Missed: 0  │ │
│  │  │EX3  │ │RX3  │          │  │   Uptime: 14h 23m        │ │
│  │  │-004 │ │-R01 │          │  │                           │ │
│  │  │ 🟢  │ │ 🟢  │          │  └───────────────────────────┘ │
│  │  └─────┘ └─────┘          │                                │
│  └─────────────────────────────┘  ┌───────────────────────────┐ │
│                                    │   VFC CARD STATUS         │ │
│  ┌─────────────────────────────┐  │                           │ │
│  │   TEMPERATURE HEATMAP       │  │  Slot 1: HDMI 2.0  🟢    │ │
│  │                             │  │  Slot 2: HDMI 2.0  🟢    │ │
│  │   CPU0: ██████████░░ 62°C  │  │  Slot 3: DP 1.4    🟢    │ │
│  │   CPU1: █████████░░░ 58°C  │  │  Slot 4: IP-VFC    🟡    │ │
│  │   GPU:  ████████████ 71°C  │  │                           │ │
│  │   SYS:  ██████░░░░░░ 38°C  │  │  [Click for 3D View →]   │ │
│  │   NVMe: ███████░░░░░ 44°C  │  └───────────────────────────┘ │
│  └─────────────────────────────┘                                │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────────┐│
│  │   NOTIFICATION FEED                              [Filter ▼] ││
│  │   ─────────────────────────────────────────────────────────  ││
│  │   14:23:07  🟡 WARN   GX3-001  Genlock phase drift +2px    ││
│  │   14:22:51  ℹ️  INFO   GX3-002  Media sync complete         ││
│  │   14:21:33  🔴 CRIT   VX4+-003 VFC Slot 4 no signal        ││
│  │   14:20:15  ℹ️  INFO   GX3-001  Project loaded: PMalone_v3  ││
│  └──────────────────────────────────────────────────────────────┘│
└──────────────────────────────────────────────────────────────────┘
```

### Dashboard Components in Detail

#### A. Server Overview Grid

Each server is a clickable card tile with at-a-glance status. Cards are arranged in a responsive grid.

**Per-card data (all from APIs):**
- Machine hostname + type (from `detectsystems`)
- Role badge: `DIRECTOR` / `ACTOR` / `UNDERSTUDY` / `STANDALONE` (from `status/session`)
- Health dot: Green / Amber / Red (derived from `status/health` → severity field)
- FPS micro-readout (from `status/health` → `averageFPS`)
- Genlock indicator (from `gpuoutputs` → `genlockState`)
- Active project name (from `status/project`)
- Power state indicator (from SMC API if available)

**Visual treatment:**
- Cards have a subtle glowing border in their status color
- Hover reveals a quick-stats tooltip with CPU/GPU temp, VFC count, IP address
- Click opens the full Server Detail view
- Offline/unreachable servers show a pulsing dim card with "OFFLINE" overlay
- Animated scan-line effect sweeps across cards periodically to reinforce the "live monitoring" feel

**API sources:**
- `GET /api/service/system/detectsystems` → hostname, type, version, IP, running states
- `GET /api/session/status/health` → averageFPS, states, severity
- `GET /api/session/status/session` → role (director/actor/understudy)
- `GET /api/session/status/project` → project name

---

#### B. Real-Time Health Ring

A large animated circular gauge showing the currently selected server's FPS.

**Implementation:** Use D3.js or a custom SVG arc. The ring fills based on FPS relative to project target (e.g., 59.94/60). Color transitions smoothly from cyan (healthy) through amber to red as FPS drops.

**Inner display:**
- Large mono-font FPS number (2 decimal places)
- "LOCKED" / "UNLOCKED" genlock badge
- Dropped and missed frame counters below

**Animation:** The ring has a subtle pulse animation synced to the poll interval. When FPS drops below threshold, the ring color shifts and a ripple animation triggers.

---

#### C. Temperature Heatmap Bars

Horizontal thermal bars for each sensor zone. These use a gradient fill from cyan (cool) through green → amber → red (hot) with the current temp as a marker.

**Sensor zones (from SMC IPMI data):**
- `CPU0_TMP` — CPU socket 0 temperature
- `CPU1_TMP` — CPU socket 1 temperature (dual-socket boards)
- GPU temperature (from NVIDIA driver via SMC or system polling)
- `System Temp` — Ambient motherboard temp
- NVMe drive temp (if exposed)
- Chassis intake / exhaust (if available)

**Thresholds:**
- Green: < 60°C
- Amber: 60–75°C
- Red: > 75°C
- Critical flash: > 85°C (with desktop notification)

**Click behavior:** Clicking the temperature section opens the **3D Server Model** (Section 2 below).

---

#### D. VFC Card Status Panel

Visual representation of the Glock card cage. Each slot shows:
- Slot number (1–4)
- Card type (HDMI 2.0, DisplayPort 1.4, SDI, IP-VFC)
- Firmware version
- Per-port status indicators (resolution + refresh displayed on hover)
- Genlock state per port (color-coded dot)

**Visual:** Styled as a mini schematic of the rear panel card slots with color-coded status.

**API source:** `GET /api/service/system/vfcs` returns:
```json
{
  "hostname": "",
  "backplaneVersion": "",
  "cards": [{
    "slot": 0,
    "type": "",
    "firmwareVersion": "",
    "fpgaVersion": "",
    "splitMode": "",
    "generation": "",
    "ports": {
      "a": { "resolution": {"width":0,"height":0}, "RefreshRate": 0, "name": "" },
      "b": { ... }, "c": { ... }, "d": { ... }
    }
  }]
}
```

---

#### E. Notification Feed

A scrolling, filterable log panel at the bottom of the dashboard.

**Data source:** `GET /api/session/status/notifications`

**Features:**
- Color-coded severity badges (Critical / Warning / Info)
- Machine name column
- Timestamp column (HH:MM:SS)
- Message summary
- Filter dropdown: All / Critical only / Warnings / By machine
- Click-to-expand for full notification detail
- "Save to Issue" button on each notification (links to Issue Tracker)
- Auto-scroll with pause-on-hover

---

## 2. 3D Interactive Server Model

### Concept

When you click on a server card or the temperature section, a modal/panel slides open showing an **interactive 3D model of the Disguise server chassis**. Temperature sensors are mapped to physical locations on the model, with real-time thermal data displayed as glowing heat indicators.

### Implementation: Three.js (via React Three Fiber)

**Library:** `@react-three/fiber` + `@react-three/drei` (already available in artifact runtime via Three.js r128)

**Why Three.js:** It's already in the app's available libraries, runs in Electron's Chromium renderer, and handles the interactive 3D + click targets natively.

### 3D Model Structure

Since Disguise doesn't publish 3D CAD models publicly, the model will be **procedurally generated** using Three.js primitives to match the physical dimensions and layout of each server type.

#### GX 3 / GX 3+ Model (4U Chassis)

```
FRONT VIEW (simplified)
┌──────────────────────────────────────────┐
│  [OLED]   ○ ○ ○ ○    [FAN GRILLE]       │
│           LEDs         ████████████       │
│                        ████████████       │
│  [USB]                 ████████████       │
└──────────────────────────────────────────┘

REAR VIEW (detailed — this is the key view)
┌──────────────────────────────────────────┐
│ [PSU1] [PSU2]  │ VFC SLOT 1 │ VFC SLOT 2│
│                │  [A][B]    │  [A][B]   │
│ [1G][1G]       │ VFC SLOT 3 │ VFC SLOT 4│
│ [10G][10G]     │  [A][B]    │  [A][B]   │
│ [100G][100G]   │            │           │
│ [USB x4]       │            │           │
│ [GUI DP][4K DP]│            │           │
│ [Genlock BNC]  │            │           │
│ [MGMT]         │            │           │
└──────────────────────────────────────────┘

TOP/INTERNAL VIEW (cutaway for temp sensors)
┌──────────────────────────────────────────┐
│                                          │
│   🔴 CPU0        🔴 CPU1                │
│   [Socket]       [Socket]               │
│                                          │
│        🟡 System Temp                    │
│        [Motherboard]                     │
│                                          │
│   🟢 NVMe                               │
│   [Drive Bay]                            │
│                                          │
│              🔴 GPU                      │
│              [A6000]                     │
│                                          │
│   [FAN1] [FAN2] [FAN3] [FAN4]          │
│    ↑RPM   ↑RPM   ↑RPM   ↑RPM          │
│                                          │
│                    [PSU]  🟡 PSU Temp    │
└──────────────────────────────────────────┘
```

### 3D Model — Build Specification

#### Chassis Shell
- `BoxGeometry` for the main 4U body
- Dimensions proportional to real GX3: ~480mm W × 176mm H (4U) × 660mm D
- Dark gunmetal material (`MeshStandardMaterial` with metallic: 0.7, roughness: 0.3)
- Subtle edge chamfers using `EdgesGeometry` with thin cyan wireframe lines

#### Internal Components (visible in cutaway/X-ray mode)
Each component is a simplified geometric shape positioned at its real physical location:

| Component | Geometry | Position (approx) | Sensor Name |
|-----------|----------|-------------------|-------------|
| CPU 0 | `BoxGeometry` with heatsink fins | Front-left quadrant | `CPU0_TMP` |
| CPU 1 | `BoxGeometry` with heatsink fins | Front-right quadrant | `CPU1_TMP` |
| GPU (A6000) | Large `BoxGeometry` | Center-rear, PCIe slot | `GPU Temp` |
| NVMe drive | Thin `BoxGeometry` | Front, drive bay area | `NVMe Temp` |
| PSU modules | 2x `BoxGeometry` | Rear-left | `PSU Temp` |
| System board | Flat `PlaneGeometry` | Base layer | `System Temp` |
| Fans | `CylinderGeometry` with rotation animation | Front-center | `FAN1-4 RPM` |
| VFC cards | 4x thin `BoxGeometry` | Rear-right slots | VFC data |
| RAM DIMMs | Thin `BoxGeometry` array | Near CPU sockets | — |

#### Temperature Sensor Hotspots

Each sensor location gets an interactive **heat indicator**:

- **Mesh:** `SphereGeometry` (small, 8 segments) positioned at the sensor's physical location
- **Material:** `MeshBasicMaterial` with emissive color mapped to temperature:
  - < 50°C → Cyan (`#00F0FF`) with low emissive intensity
  - 50–65°C → Green (`#00FF88`)
  - 65–75°C → Amber (`#FFB800`) with medium pulse animation
  - 75–85°C → Red (`#FF3B3B`) with fast pulse
  - > 85°C → Bright red with alarm ring effect (expanding `RingGeometry` animation)
- **Glow effect:** `PointLight` at each sensor position, intensity mapped to temperature. Creates a volumetric glow on surrounding components.
- **Label:** `Html` component from `@react-three/drei` showing:
  ```
  CPU0_TMP
  62°C
  ▼ 3° from peak
  ```

#### Interaction

- **Orbit controls:** Click-drag to rotate, scroll to zoom. Default view shows the top-down cutaway.
- **Click sensor hotspot:** Expands an info panel showing:
  - Current temperature
  - Min / Max / Average over current session
  - Sparkline chart (last 30 minutes)
  - Alert threshold settings
  - "Log Issue" button
- **View presets** (buttons at top of 3D panel):
  - **Front** — Shows OLED, fans, drive bay
  - **Rear** — Shows VFC slots, PSU, network ports
  - **Top (X-ray)** — Cutaway showing internal layout + all sensor hotspots (default)
  - **Thermal** — All components semi-transparent, only heat indicators visible
- **Fan animation:** `CylinderGeometry` rotates at speed proportional to reported RPM. Fans with 0 RPM show a red "STOPPED" badge.

#### Server Type Variants

The 3D model adapts based on server type detected from `detectsystems`:

| Server | Chassis | Key Differences |
|--------|---------|-----------------|
| GX 3 | 4U | NVIDIA A6000, 4 VFC slots, SMC Mk I |
| GX 3+ | 4U | Updated GPU, IP-VFC support, SMC Mk II |
| GX 2C | 4U | Older GPU, 4 VFC slots, no SMC |
| VX 4+ | 2U | AMD GPU, different VFC layout |
| EX 3 | 2U | No VFC (fixed outputs), SMC Mk II |

Each variant loads a different component layout configuration from a JSON definition file. This makes it extensible — adding a new server type just means adding a new layout JSON.

#### Data Flow for 3D View

```
SMC API (/api/stats)           →  CPU temps, fan RPMs, voltages, power draw
Service API (/system/vfcs)     →  VFC card types, slots, firmware
Service API (/system/gpuoutputs) → GPU genlock state, resolution per port
Session API (/status/health)   →  System states, severity indicators
SQLite history                 →  Min/max/avg for sparklines
```

All data funnels through the same polling service that feeds the main dashboard. The 3D view is just an alternate visualization of the same data stream.

---

## 3. Comprehensive Server Info Panels

When you click a server card on the main dashboard, a full-screen detail view opens with tabbed panels.

### Tab: Overview

The dashboard view scoped to a single server — health ring, VFC status, temperature bars, notification feed (filtered to this machine).

### Tab: Hardware

| Section | Data Source | Displayed Info |
|---------|------------|----------------|
| **Machine Identity** | `detectsystems` | Hostname, type (GX3/VX4+/etc), d3 version, IP address, serial (if available via SMC) |
| **GPU** | `gpuoutputs` + SMC | GPU model, driver version, VRAM, genlock state per port, current resolution per output, bit depth, colour format |
| **VFC Cards** | `vfcs` | Full card detail per slot — type, firmware, FPGA, split mode, generation, per-port resolution/refresh/name |
| **Network Adapters** | `networkadapters` | NIC name, MAC, IP/subnet/gateway, DHCP status, link status, speed |
| **Storage** | SMC / OS info | NVMe model, capacity, health %, temperature |
| **OS** | `osinfo` | Windows version, disguise image version |
| **SMC** | SMC `/api/remora` | SMC firmware version, hardware revision (Mk I / Mk II) |

### Tab: Thermal (3D View)

The full 3D interactive server model described in Section 2.

### Tab: Performance

Real-time and historical charts:

- **FPS timeline** — Line chart showing FPS over time with project target line overlay
- **Dropped/missed frames** — Bar chart showing frame loss events
- **Temperature trends** — Multi-line chart showing all thermal sensors over time
- **Fan speed chart** — RPM values over time
- **Power draw** — Wattage over time (from SMC BMC data)

All charts use **Recharts** with dark theme styling. Time range selector: Last 15min / 1hr / 6hr / Full session.

### Tab: Network

- NIC configuration table with profile comparison
- Network status indicators (d3net sync, project file sync)
- Bandwidth utilization if available
- VLAN assignments

### Tab: Issues

Server-specific issue log (filtered from global issue tracker). Shows all issues tagged to this machine.

---

## 4. Issue Tracker & Recording System

### Core Concept

A built-in issue tracking system specifically designed for live production troubleshooting. Issues can be created manually, generated automatically from alerts, or spawned from notification events. Everything gets timestamped and linked to the machine state at the moment of creation.

### Issue Data Model

```typescript
interface Issue {
  id: string;                    // UUID
  title: string;                 // Short description
  description: string;           // Detailed notes (Markdown supported)
  severity: 'critical' | 'warning' | 'info' | 'resolved';
  status: 'open' | 'investigating' | 'resolved' | 'deferred';
  
  // Context capture (auto-populated at creation time)
  machineHostname: string;       // Which server
  machineType: string;           // GX3, VX4+, etc
  projectName: string;           // Active project
  sessionRole: string;           // Director/Actor/Understudy
  
  // Snapshot at time of issue
  snapshot: {
    fps: number;
    droppedFrames: number;
    missedFrames: number;
    genlockState: string;
    temperatures: Record<string, number>;  // All sensor readings
    fanSpeeds: Record<string, number>;     // All fan RPMs
    vfcStatus: VFCCard[];                  // Full VFC state
    networkConfig: NetworkAdapter[];         // Full NIC state
    systemStates: SystemState[];            // All health states
    notifications: Notification[];          // Recent notifications
    gpuOutputs: GPUOutput[];               // All GPU port states
  };
  
  // Metadata
  createdAt: string;             // ISO timestamp
  updatedAt: string;
  resolvedAt?: string;
  createdBy: string;             // User name or "AUTO-ALERT"
  tags: string[];                // Custom tags: "genlock", "vfc", "thermal", etc
  
  // Attachments
  attachments: Attachment[];     // Screenshots, log exports, etc
  
  // Activity log
  comments: Comment[];           // Threaded discussion / notes
}

interface Comment {
  id: string;
  author: string;
  text: string;
  timestamp: string;
  // Optional: auto-attached state diff since last comment
  stateDiff?: StateDiff;
}

interface Attachment {
  id: string;
  filename: string;
  type: 'screenshot' | 'log_export' | 'csv' | 'pdf' | 'image';
  path: string;                  // Local file path
  timestamp: string;
}
```

### Issue Creation Methods

#### 1. Manual Creation
- "New Issue" button on any dashboard view
- Pre-populates with currently selected server context
- Auto-captures full system snapshot at time of creation
- Title + description + severity + tags form

#### 2. Auto-Generated from Alerts
When alert thresholds are crossed, the system automatically creates an issue:

| Trigger | Auto-Issue Title | Severity |
|---------|-----------------|----------|
| FPS drops below threshold | "FPS drop on {hostname}: {fps} FPS" | warning/critical |
| Genlock unlock detected | "Genlock lost on {hostname}" | critical |
| Temperature exceeds limit | "{sensor} over threshold on {hostname}: {temp}°C" | warning |
| VFC card removed/failed | "VFC Slot {n} lost on {hostname}" | critical |
| Dropped frames spike | "Frame drop spike on {hostname}: {count} frames" | warning |
| Machine goes offline | "{hostname} unreachable" | critical |

Auto-issues capture the full system snapshot and include the triggering notification text.

#### 3. From Notification Feed
Each notification in the feed has a "📌 Track" button that creates an issue pre-populated with the notification data.

#### 4. From 3D View
Clicking "Log Issue" on a temperature sensor hotspot creates an issue tagged with "thermal" and the specific sensor data.

### Issue List View

```
┌──────────────────────────────────────────────────────────────────┐
│  ISSUES                    [+ New Issue]   [Export ▼]  [Filter]  │
│  ─────────────────────────────────────────────────────────────── │
│                                                                  │
│  ┌─ Filters ─────────────────────────────────────────────────┐  │
│  │ Status: [All ▼]  Severity: [All ▼]  Machine: [All ▼]     │  │
│  │ Date range: [Session ▼]   Tags: [genlock] [thermal] [+]  │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│  🔴 #047  CRITICAL  OPEN         14:23:07  GX3-001             │
│     Genlock lost on GX3-001                                      │
│     Tags: genlock, vfc    Comments: 3    Snapshot: ✓            │
│                                                                  │
│  🟡 #046  WARNING   INVESTIGATING 14:21:33  VX4+-003            │
│     VFC Slot 4 no signal on VX4+-003                             │
│     Tags: vfc, hardware   Comments: 1    Snapshot: ✓            │
│                                                                  │
│  🟢 #045  INFO      RESOLVED     13:45:00  GX3-002             │
│     FPS drop during media sync                                   │
│     Tags: performance      Resolved: 13:52:00    Duration: 7m   │
│                                                                  │
│  🔴 #044  CRITICAL  RESOLVED     12:30:15  GX3-001             │
│     CPU0 temp exceeded 80°C                                      │
│     Tags: thermal          Resolved: 12:35:00    Duration: 5m   │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

### Issue Detail View

When you click an issue, a full detail panel opens:

```
┌──────────────────────────────────────────────────────────────────┐
│  ← Back to Issues                                                │
│                                                                  │
│  🔴 #047 — Genlock lost on GX3-001                              │
│  Status: OPEN → [Investigating ▼]   Severity: CRITICAL          │
│  Machine: GX3-001 (Director)  |  Project: PMalone_v3            │
│  Created: 2026-03-19 14:23:07  |  By: AUTO-ALERT                │
│  Tags: [genlock] [vfc] [+ add tag]                              │
│                                                                  │
│  ┌─ SNAPSHOT AT TIME OF ISSUE ──────────────────────────────┐   │
│  │  FPS: 42.3 (target: 59.94)   Genlock: UNLOCKED          │   │
│  │  Dropped: 147   Missed: 23                                │   │
│  │  CPU0: 64°C  CPU1: 61°C  GPU: 73°C  SYS: 39°C          │   │
│  │  VFC1: HDMI OK  VFC2: HDMI OK  VFC3: DP OK  VFC4: DP ⚠️ │   │
│  │  [View Full Snapshot] [Compare to Current State]          │   │
│  └───────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌─ ACTIVITY ────────────────────────────────────────────────┐  │
│  │  14:23:07  AUTO-ALERT created this issue                  │  │
│  │            "Genlock state changed to UNLOCKED on GPU      │  │
│  │             port 0. Previous state: LOCKED (14:22:55)"    │  │
│  │                                                           │  │
│  │  14:25:12  Joe Bradley                                    │  │
│  │            "Checking BNC cable at patch panel. Cable       │  │
│  │             looks secure. Swapping to backup genlock       │  │
│  │             source from house sync."                       │  │
│  │            [State diff: GPU temp +2°C, FPS now 58.1]     │  │
│  │                                                           │  │
│  │  14:28:45  Joe Bradley                                    │  │
│  │            "Backup genlock restored. Reapplying feeds."   │  │
│  │            📎 screenshot_genlock_restore.png               │  │
│  │                                                           │  │
│  │  ┌─────────────────────────────────────────────────────┐  │  │
│  │  │ Add comment...                          [Attach 📎] │  │  │
│  │  │                                         [Submit →]  │  │  │
│  │  └─────────────────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│  [Mark Resolved]  [Defer]  [Export PDF]  [Delete]               │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

### Key Issue Tracker Features

#### Snapshot Comparison
Click "Compare to Current State" to see a side-by-side diff of the machine's state at issue creation vs. right now. Highlights what changed — useful for verifying a fix.

#### Export Options
- **PDF Report:** Full issue with snapshot data, comments, and attachments — suitable for post-show reports or sending to Disguise support
- **CSV:** Bulk export of all issues with timestamps and key metrics
- **JSON:** Machine-readable export for integration with external systems

#### Session-Based Organization
Issues are grouped by "session" (each time d3Watch is started or a new show day begins). This creates natural boundaries for post-show review.

#### Search & Analytics
- Full-text search across all issues
- Analytics panel: Most common issue types, mean time to resolution, issues per machine, recurring patterns
- "Show me all genlock issues from the last 7 days" type filtering

---

## 5. Data Architecture for Recording

### SQLite Schema

```sql
-- Core machine registry
CREATE TABLE machines (
  id TEXT PRIMARY KEY,
  hostname TEXT NOT NULL,
  type TEXT,              -- GX3, VX4+, EX3, etc
  ip_address TEXT,
  smc_ip TEXT,
  first_seen TEXT,
  last_seen TEXT,
  metadata JSON           -- Full detectsystems response
);

-- Periodic health snapshots (every poll interval)
CREATE TABLE health_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  machine_id TEXT NOT NULL,
  timestamp TEXT NOT NULL,
  fps REAL,
  dropped_frames INTEGER,
  missed_frames INTEGER,
  system_states JSON,      -- Full states array from health API
  FOREIGN KEY (machine_id) REFERENCES machines(id)
);

-- Temperature readings
CREATE TABLE temperature_readings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  machine_id TEXT NOT NULL,
  timestamp TEXT NOT NULL,
  sensor_name TEXT NOT NULL,  -- CPU0_TMP, GPU, System Temp, etc
  value_celsius REAL NOT NULL,
  source TEXT,                -- 'smc' or 'designer'
  FOREIGN KEY (machine_id) REFERENCES machines(id)
);

-- Fan speed readings
CREATE TABLE fan_readings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  machine_id TEXT NOT NULL,
  timestamp TEXT NOT NULL,
  fan_name TEXT NOT NULL,
  rpm INTEGER NOT NULL,
  FOREIGN KEY (machine_id) REFERENCES machines(id)
);

-- VFC state changes (event-driven, not periodic)
CREATE TABLE vfc_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  machine_id TEXT NOT NULL,
  timestamp TEXT NOT NULL,
  slot INTEGER NOT NULL,
  event_type TEXT,          -- 'detected', 'removed', 'config_change', 'genlock_change'
  card_type TEXT,
  firmware TEXT,
  port_states JSON,         -- Full port status at time of event
  FOREIGN KEY (machine_id) REFERENCES machines(id)
);

-- Network config snapshots
CREATE TABLE network_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  machine_id TEXT NOT NULL,
  timestamp TEXT NOT NULL,
  adapters JSON,            -- Full networkadapters response
  FOREIGN KEY (machine_id) REFERENCES machines(id)
);

-- GPU output state
CREATE TABLE gpu_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  machine_id TEXT NOT NULL,
  timestamp TEXT NOT NULL,
  genlock_frequency REAL,
  outputs JSON,             -- Full gpuoutputs response
  FOREIGN KEY (machine_id) REFERENCES machines(id)
);

-- Notifications from Designer
CREATE TABLE notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  machine_id TEXT NOT NULL,
  timestamp TEXT NOT NULL,
  summary TEXT,
  detail TEXT,
  severity TEXT,
  FOREIGN KEY (machine_id) REFERENCES machines(id)
);

-- Issues
CREATE TABLE issues (
  id TEXT PRIMARY KEY,       -- UUID
  issue_number INTEGER UNIQUE,
  title TEXT NOT NULL,
  description TEXT,
  severity TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  machine_id TEXT,
  project_name TEXT,
  session_role TEXT,
  snapshot JSON,             -- Full system state at creation
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  resolved_at TEXT,
  created_by TEXT,
  tags JSON,                 -- Array of tag strings
  FOREIGN KEY (machine_id) REFERENCES machines(id)
);

-- Issue comments
CREATE TABLE issue_comments (
  id TEXT PRIMARY KEY,
  issue_id TEXT NOT NULL,
  author TEXT,
  text TEXT,
  timestamp TEXT NOT NULL,
  state_diff JSON,           -- Optional state diff
  FOREIGN KEY (issue_id) REFERENCES issues(id)
);

-- Issue attachments
CREATE TABLE issue_attachments (
  id TEXT PRIMARY KEY,
  issue_id TEXT NOT NULL,
  filename TEXT NOT NULL,
  type TEXT,
  file_path TEXT NOT NULL,
  timestamp TEXT NOT NULL,
  FOREIGN KEY (issue_id) REFERENCES issues(id)
);

-- Sessions (show days / monitoring sessions)
CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  name TEXT,                 -- "Post Malone - Dallas - March 19"
  started_at TEXT NOT NULL,
  ended_at TEXT,
  notes TEXT
);

-- Indexes for performance
CREATE INDEX idx_health_machine_time ON health_snapshots(machine_id, timestamp);
CREATE INDEX idx_temp_machine_time ON temperature_readings(machine_id, timestamp);
CREATE INDEX idx_notifications_machine ON notifications(machine_id, timestamp);
CREATE INDEX idx_issues_status ON issues(status, severity);
CREATE INDEX idx_issues_machine ON issues(machine_id);
```

### Data Retention Policy

| Data Type | Default Retention | Reasoning |
|-----------|-------------------|-----------|
| Health snapshots | 30 days | High volume, useful for recent trend analysis |
| Temperature readings | 30 days | High volume |
| Fan readings | 30 days | High volume |
| VFC events | Indefinite | Low volume, high value for tracking card history |
| Network snapshots | 90 days | Medium volume, useful for config auditing |
| GPU snapshots | 30 days | Medium volume |
| Notifications | 90 days | Medium volume, useful for incident investigation |
| Issues | Indefinite | Core knowledge base, never auto-delete |
| Sessions | Indefinite | Show history |

Configurable in Settings. "Purge old data" button for manual cleanup.

---

## 6. Implementation Guidance

### Tech Stack Additions (beyond base plan)

| Component | Package | Purpose |
|-----------|---------|---------|
| 3D rendering | `three` (already available at r128) | Server model |
| 3D React bindings | `@react-three/fiber` + `@react-three/drei` | Declarative 3D in React |
| Charts | `recharts` (already available) | Performance timelines, sparklines |
| Rich text | `@uiw/react-md-editor` or simple textarea | Issue descriptions with Markdown |
| PDF export | `jspdf` + `jspdf-autotable` | Issue report generation |
| UUID generation | `crypto.randomUUID()` (built-in) | Issue IDs |
| Date handling | `date-fns` | Timestamp formatting, duration calc |

### Development Phase Integration

This addendum adds to the original phased plan:

| Phase | Additional Work |
|-------|----------------|
| Phase 1 (Foundation) | Add SQLite schema for all recording tables. Add issue table schema. |
| Phase 2 (Core Monitoring) | Build the futuristic dashboard layout with all panels. Implement notification feed with "Track" button. |
| Phase 3 (Network & Profiles) | No change. |
| Phase 4 (History & Logging) | Build issue tracker CRUD. Implement snapshot capture at issue creation. Build issue list/detail views. |
| Phase 5 (Bonus Tools) | Build 3D server model with temperature sensors. Implement thermal view mode. Add PDF export for issues. |
| Phase 6 (Polish) | Dashboard animations, scan-line effects, glow transitions. 3D model variants for each server type. Analytics panel for issue patterns. |

### Performance Considerations

- **3D view:** Only render when the panel is visible. Dispose of Three.js resources on unmount. Use `requestAnimationFrame` throttling.
- **Dashboard updates:** Use React `useMemo` and `useCallback` to prevent unnecessary re-renders. Batch SQLite writes.
- **SQLite:** Use WAL mode for concurrent read/write. Run writes in Electron main process, reads via IPC.
- **Polling:** Stagger API calls across servers to avoid burst traffic. Honor Disguise's recommendation to investigate the Live Update API for streaming.

---

## 7. Reference Links

| Resource | URL |
|----------|-----|
| **Disguise Developer Portal** | [developer.disguise.one](https://developer.disguise.one/) |
| **Service System API (VFC, GPU, Network)** | [developer.disguise.one/api/service/system](https://developer.disguise.one/api/service/system/) |
| **Session Status API (Health, Notifications)** | [developer.disguise.one/api/session/status](https://developer.disguise.one/api/session/status/) |
| **SMC Overview (temps, fans, power, VFC detection)** | [help.disguise.one/hardware/smc/smc-overview](https://help.disguise.one/hardware/smc/smc-overview) |
| **SMC API docs** | [help.disguise.one/designer/apis/smc-api](https://help.disguise.one/designer/apis/smc-api) |
| **DNS-SD Discovery** | [developer.disguise.one/api/discovery](https://developer.disguise.one/api/discovery/) |
| **Live Update API (streaming)** | [developer.disguise.one/api/session/liveupdate](https://developer.disguise.one/api/session/liveupdate/) |
| **GX 3 Overview** | [help.disguise.one/hardware/gx-range/gx3/gx3-overview](https://help.disguise.one/hardware/gx-range/gx3/gx3-overview) |
| **GX 3+ Overview** | [help.disguise.one/hardware/gx-range/gx3plus/gx3plus-overview](https://help.disguise.one/hardware/gx-range/gx3plus/gx3plus-overview) |
| **VFC Cards overview** | [help.disguise.one/hardware/vfc-cards/vfc-cards-overview](https://help.disguise.one/hardware/vfc-cards/vfc-cards-overview) |
| **IP-VFC Cards** | [help.disguise.one/hardware/ip-vfc/ip-vfc-overview](https://help.disguise.one/hardware/ip-vfc/ip-vfc-overview) |
| **Genlock Configuration** | [help.disguise.one/designer/configuration/genlock-configuration](https://help.disguise.one/designer/configuration/genlock-configuration) |
| **Network Status Widget (status indicators)** | [help.disguise.one/designer/networking/network-status-widget](https://help.disguise.one/designer/networking/network-status-widget) |
| **Three.js r128 docs** | [threejs.org/docs](https://threejs.org/docs/) |
| **React Three Fiber** | [docs.pmnd.rs/react-three-fiber](https://docs.pmnd.rs/react-three-fiber/) |
| **Recharts** | [recharts.org](https://recharts.org/) |
| **Disguise integration contact** | integrations@disguise.one |

---

*This document extends the d3Watch base development plan with full visual design specifications, 3D interactive server modeling, comprehensive server info architecture, and a production-grade issue tracking system. Ready for AI coding handoff.*
