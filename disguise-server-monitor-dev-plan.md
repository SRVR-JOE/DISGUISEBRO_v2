# ⚡ Disguise Server Monitor & Management App — Development Plan

**Project Codename:** d3Watch  
**Author:** Joe Bradley — Solotech  
**Target Hardware:** GX2C, GX3, GX3+, VX series  
**Date:** March 2026

---

## 1. Project Overview

A desktop application for real-time monitoring, health tracking, VFC card status, network configuration management, and historical logging of Disguise media servers across a production network. Designed for AV production specialists who need a single pane of glass to monitor an entire Disguise rig from rack-side or FOH.

### Target Stack (Recommended)

**Electron + React + Vite** (consistent with AV Rack AI architecture)

- **Frontend:** React 18+ with Tailwind CSS
- **Backend/Services:** Node.js with native `fetch` for HTTP API calls
- **Database:** SQLite (via `better-sqlite3`) for local history/logging
- **Charts:** Recharts or Chart.js for real-time dashboards
- **Discovery:** `bonjour-service` npm package for DNS-SD/mDNS auto-discovery

---

## 2. API Landscape — What's Available

Disguise exposes **three distinct API surfaces**. Understanding which to use for what is critical.

### 2A. Designer Service API (d3service)

Runs whenever d3service is active on the server. Does NOT require Designer (the session) to be running.

**Base URL:** `http://{server-ip}:{port}/api/service/...`  
**Default port:** 80 (configurable in d3Manager → Machine Settings → Advanced Network Configuration)

| Endpoint | Returns | Use Case |
|----------|---------|----------|
| `GET /api/service/system/detectsystems` | All machines on d3net — hostname, type, version, IP, running states (Designer, Service, Manager, NotchHost) | Auto-discovery of all servers |
| `GET /api/service/system/vfcs` | Per-host VFC card inventory — slot, type, firmware version, FPGA version, split mode, generation, per-port resolution/refresh/name | **VFC monitoring (primary target)** |
| `GET /api/service/system/gpuoutputs` | GPU port details — genlock state, emulated flag, resolution, refresh rate, bit depth, colour format | GPU/genlock health |
| `GET /api/service/system/networkadapters` | All NICs — name, MAC, enabled, DHCP, status, IP/subnet/gateway per address | Network config snapshots |
| `GET /api/service/system/projects` | Project list per host — path, last modified, version | Project management |
| `GET /api/service/system/osinfo` | Windows version + image version per host | OS tracking |

**Ref:** [developer.disguise.one/api/service/system](https://developer.disguise.one/api/service/system/)

### 2B. Designer Session API (requires active Designer session)

Only responds when Designer is running a session.

**Base URL:** `http://{server-ip}:{port}/api/session/...`

| Endpoint | Returns | Use Case |
|----------|---------|----------|
| `GET /api/session/status/health` | Per-machine: averageFPS, video dropped/missed frames, system states (name, detail, category, severity) | **Real-time health dashboard** |
| `GET /api/session/status/notifications` | Per-machine notifications (summary + detail) | Alert/warning feed |
| `GET /api/session/status/project` | Running project path + version | Show status |
| `GET /api/session/status/session` | Session topology — director, actors, understudies, solo mode, dedicated director flag | Session overview |
| `GET /api/session/transport/*` | Transport controls, current timecodes, play state | Timeline monitoring |
| `GET /api/session/sequencing/*` | Track/section/cue list data | Show sequencing |

**Ref:** [developer.disguise.one/api/session/status](https://developer.disguise.one/api/session/status/)

### 2C. SMC API (System Management Controller — out-of-band hardware)

Runs on the SMC module inside supported hardware. Completely independent of Windows/d3 — works even when the server OS is down.

**Base URL:** `http://{smc-ip}/api/...`  
**Local access from host:** `http://172.31.250.9/api/...`  
**Remote access:** Via MGMT ethernet port (IP shown on front OLED)

| Capability | Details |
|------------|---------|
| Power state | Read + remote power on/off (requires auth) |
| VFC cards inserted | Physical slot detection even when server is off |
| Network adapters | NIC config from hardware level |
| Temperature sensors | CPU, GPU, ambient temps via IPMI/BMC |
| Power draw | Wattage monitoring |
| Fan speeds | Chassis fan RPMs |
| d3Net session info | Session details at hardware level |
| Remote machines | Other SMCs discovered on MGMT subnet |

**Auth:** GET (read) requests generally don't require auth. POST/PUT (state changes like power control) require basic auth tokens. Create account via SMC web UI (requires physical OLED verification code).

**Supported hardware:**
- SMC Mk I: VX 1, VX 2, VX 2+, VX 4, VX 4+, GX 3
- SMC Mk II: EX 2, EX 2C, EX 3+, RX III, GX 3+

**Ref:** [help.disguise.one/hardware/smc/smc-overview](https://help.disguise.one/hardware/smc/smc-overview) | [help.disguise.one/designer/apis/smc-api](https://help.disguise.one/designer/apis/smc-api)

### 2D. DNS-SD Auto-Discovery (r30.4+)

Disguise servers advertise themselves via mDNS/DNS-SD, enabling zero-config discovery.

| Service | DNS-SD Name | When Published |
|---------|------------|----------------|
| Host (any machine with d3service) | `_d3host._tcp` | Always when d3service running |
| Director (hosting a session) | `_d3director._tcp` | When actively hosting a session |

A Python reference script using `zeroconf` is provided by Disguise that discovers instances and queries their health endpoint automatically.

**Ref:** [developer.disguise.one/api/discovery](https://developer.disguise.one/api/discovery/)

---

## 3. Core Modules — The Build

### Module 1: Auto-Discovery & Server Registry

**Purpose:** Find all Disguise machines on the network without manual IP entry.

**Implementation:**
1. **DNS-SD scan** using `bonjour-service` (Node.js) — browse for `_d3host._tcp` and `_d3director._tcp` services
2. **Fallback:** Call `GET /api/service/system/detectsystems` on any known server to enumerate the full d3net cluster
3. **SMC subnet scan:** Ping-sweep or mDNS browse on MGMT network for SMC devices (`smc.local`)
4. **Persist** discovered servers in SQLite with last-seen timestamps
5. **Manual add** option for servers on different subnets

**UI:** Network map / topology view showing Director → Actors → Understudies → Render nodes with live status badges.

---

### Module 2: VFC Card Monitor (Glock Slots)

**Purpose:** Real-time tracking of every VFC card across every server — the "Glock" card cage status.

**Data Sources:**
- `GET /api/service/system/vfcs` — card type, firmware, FPGA version, split mode, generation, per-port resolution/refresh
- `GET /api/service/system/gpuoutputs` — genlock state per GPU port, emulated flag, resolution, refresh rate, bit depth, colour format
- SMC API — physical slot detection even when server is off

**Features:**
- Visual card layout matching physical Glock positions (slot 1–4)
- Per-port status: resolution, refresh rate, genlock state with colour indicators (green/amber/red matching Designer's status widget convention)
- Firmware version tracking with alerts when cards are mismatched across servers
- Split mode display (single/dual/quad)
- Historical logging — record every state change to SQLite with timestamps for post-show review

**Polling Strategy:** Every 5–10 seconds for VFC data; every 10–15 seconds matches SMC web UI refresh rate.

---

### Module 3: Health & Performance Dashboard

**Purpose:** Real-time system health for all machines in a session.

**Data Source:** `GET /api/session/status/health`

**Displays per machine:**
- **FPS gauge** — averageFPS with thresholds (green >59, amber >55, red <55 for 60fps projects)
- **Dropped/missed frames** counter with delta rate (frames lost per minute)
- **System states** — parsed into severity-sorted cards (Critical → Warning → Info)
- **Genlock status** — extracted from states array and GPU outputs
- **Notification feed** — from `/api/session/status/notifications`, streaming into a log panel

**Alerts:**
- Configurable thresholds for FPS drops, frame losses, genlock unlock
- Desktop notifications (Electron notification API)
- Optional: webhook to Slack/Teams for remote monitoring

**Note from Disguise:** Frequent polling of REST endpoints is discouraged for performance reasons. For production use, investigate the **Live Update API** for streaming data instead of polling. Referenced in r31 release notes as the recommended approach.

**Ref:** [developer.disguise.one/api/session/status](https://developer.disguise.one/api/session/status/)

---

### Module 4: Network Profile Manager

**Purpose:** Snapshot, store, compare, and deploy network configurations across servers.

**Data Source:** `GET /api/service/system/networkadapters`

**Features:**
- **Snapshot:** Pull complete NIC config (name, MAC, IP, subnet, gateway, DHCP, enabled state) from all machines and save as a named profile (e.g., "Post Malone Tour — Show Config", "Festival Main Stage")
- **Compare:** Diff two profiles side-by-side to catch misconfigurations before load-in
- **Templates:** Pre-built Solotech standard profiles based on your VLAN standards:
  - VLAN 10 = D3 Net
  - VLAN 30 = NDI
  - VLAN 1300 = Dante Primary
  - etc.
- **Deploy (advanced):** Push NIC names and IP configs to servers. This requires PowerShell remoting or SMC API endpoints for network adapter configuration. The SMC web interface already shows adapter info; the API may support write operations with auth.
- **Validation:** Flag common issues — duplicate IPs, wrong subnets, missing gateways, DHCP where static is expected

**Storage:** Profiles saved as JSON in app data directory + optional export to shareable files.

---

### Module 5: Session & Transport Monitor

**Purpose:** Show-time monitoring of what's playing, where, and when.

**Data Sources:**
- `GET /api/session/status/session` — topology (director/actors/understudies), GUI mode, solo status
- `GET /api/session/status/project` — project name + version
- `GET /api/session/transport/*` — current timecode, play state, track info

**Features:**
- Session topology diagram with role assignments
- Transport state display with SMPTE timecode
- Project version mismatch detection across machines

---

### Module 6: Historical Data Recorder

**Purpose:** Log everything to local SQLite for post-show analysis and incident investigation.

**Logged Data:**
- Health snapshots (FPS, dropped frames, system states) at configurable intervals
- VFC state changes (card inserted/removed, resolution changes, genlock lock/unlock)
- Network config changes
- Notification/error events with timestamps
- Session topology changes (failover events, machines joining/leaving)

**Export:** CSV/JSON export for reports. Optional: feed into Grafana via SQLite datasource for advanced visualization.

---

## 4. Bonus Tools — Extra Value

### Tool A: Media Server Comparison View

Pull `GET /api/service/system/osinfo` and `/projects` across all servers to create a compatibility matrix — which servers have which OS image version, which Designer version, which project version. Flag mismatches instantly.

### Tool B: Genlock Health Timeline

Record genlock state over time using GPU output data. Visualize lock/unlock events on a timeline against the show's transport timecode. Helps diagnose intermittent sync issues after the fact.

### Tool C: Pre-Show Checklist Automation

Automated go/no-go checklist that queries all APIs and validates:
- All expected servers discovered and online
- All VFC cards present and at correct firmware
- Genlock locked on all machines
- Network config matches expected profile
- Project version consistent across all machines
- FPS within threshold
- No critical notifications

Generates a timestamped PDF report.

### Tool D: SMC Power Manager

For hardware with SMC — remote power on/off/reboot of servers from the app. Useful for rack rooms where physical access is limited. Requires SMC auth setup.

### Tool E: Notification Aggregator & Log

Centralize all Designer notifications from all machines into a single searchable, filterable log with severity-based color coding. Export for troubleshooting reports.

### Tool F: Remote EDID Monitor

Track EDID info across VFC ports. Detect when a display drops off or EDID changes unexpectedly — common issue with long HDMI/DP runs in live production.

---

## 5. Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│                    Electron Shell                     │
├───────────────┬─────────────────────────────────────┤
│  React UI     │  Main Process (Node.js)             │
│               │                                      │
│  ┌──────────┐ │  ┌───────────────────┐              │
│  │Dashboard │ │  │ Discovery Engine  │ ← DNS-SD     │
│  │VFC View  │ │  │ (bonjour-service) │              │
│  │Network   │ │  ├───────────────────┤              │
│  │Profiles  │ │  │ Poller Service    │ ← HTTP GET   │
│  │History   │ │  │ (configurable     │   to all APIs│
│  │Alerts    │ │  │  intervals)       │              │
│  │Checklist │ │  ├───────────────────┤              │
│  └──────────┘ │  │ SQLite Logger     │ → history.db │
│               │  ├───────────────────┤              │
│               │  │ Profile Store     │ → profiles/  │
│               │  ├───────────────────┤              │
│               │  │ Alert Engine      │ → Notif/Hook │
│               │  └───────────────────┘              │
└───────────────┴─────────────────────────────────────┘
         ↕                    ↕                ↕
    ┌─────────┐      ┌──────────────┐  ┌────────────┐
    │ Designer│      │   d3service  │  │   SMC API  │
    │ Session │      │  Service API │  │ (MGMT net) │
    │   API   │      │  (port 80)   │  │            │
    └─────────┘      └──────────────┘  └────────────┘
```

---

## 6. Development Phases

### Phase 1 — Foundation (Weeks 1–2)
- Electron + Vite + React scaffold (mirror AV Rack AI structure)
- DNS-SD discovery engine + manual server add
- Basic server list with online/offline status from `detectsystems`
- SQLite schema for servers, snapshots, events

### Phase 2 — Core Monitoring (Weeks 3–4)
- VFC card monitor with visual slot layout
- GPU output / genlock status display
- Health dashboard with FPS, dropped frames, system states
- Notification feed panel
- Polling service with configurable intervals

### Phase 3 — Network & Profiles (Weeks 5–6)
- Network adapter viewer
- Profile snapshot/save/compare engine
- Template system for Solotech VLAN standards
- Diff view for profile comparison

### Phase 4 — History & Logging (Week 7)
- SQLite logging of all polled data
- Historical timeline view with filtering
- CSV/JSON export

### Phase 5 — Bonus Tools (Weeks 8–10)
- Pre-show checklist automation
- SMC integration (power management, hardware temps)
- Genlock timeline
- OS/project version comparison matrix
- Alert webhooks (Slack/Teams)

### Phase 6 — Polish & Package (Week 11–12)
- Custom app icon
- Windows `.exe` installer (electron-builder, same as AV Rack AI)
- Settings panel (poll intervals, alert thresholds, API ports, SMC credentials)
- Documentation

---

## 7. Key Reference Links

| Resource | URL |
|----------|-----|
| **Designer API — Full docs** | [developer.disguise.one/api](https://developer.disguise.one/api/) |
| **Service System API (VFC, GPU, Network, OS)** | [developer.disguise.one/api/service/system](https://developer.disguise.one/api/service/system/) |
| **Session Status API (Health, Notifications)** | [developer.disguise.one/api/session/status](https://developer.disguise.one/api/session/status/) |
| **DNS-SD Discovery (Python example)** | [developer.disguise.one/api/discovery](https://developer.disguise.one/api/discovery/) |
| **SMC Overview + API access** | [help.disguise.one/hardware/smc/smc-overview](https://help.disguise.one/hardware/smc/smc-overview) |
| **SMC API docs** | [help.disguise.one/designer/apis/smc-api](https://help.disguise.one/designer/apis/smc-api) |
| **API Introduction + port config** | [help.disguise.one/designer/apis/api-overview](https://help.disguise.one/designer/apis/api-overview) |
| **Disguise Developer Portal (home)** | [developer.disguise.one](https://developer.disguise.one/) |
| **OpenAPI spec** | [developer.disguise.one/api/openapi](https://developer.disguise.one/api/openapi/) |
| **Live Update API (streaming alternative to polling)** | [developer.disguise.one/api/session/liveupdate](https://developer.disguise.one/api/session/liveupdate/) |
| **Network Status Widget (genlock indicators reference)** | [help.disguise.one/designer/networking/network-status-widget](https://help.disguise.one/designer/networking/network-status-widget) |
| **VFC Cards overview** | [help.disguise.one/hardware/vfc-cards/vfc-cards-overview](https://help.disguise.one/hardware/vfc-cards/vfc-cards-overview) |
| **IP-VFC Cards** | [help.disguise.one/hardware/ip-vfc/ip-vfc-overview](https://help.disguise.one/hardware/ip-vfc/ip-vfc-overview) |
| **Genlock Configuration** | [help.disguise.one/designer/configuration/genlock-configuration](https://help.disguise.one/designer/configuration/genlock-configuration) |
| **Disguise integration contact** | integrations@disguise.one |

---

## 8. Notes for AI Coding

When handing this to an AI coding agent (Claude Code, Cursor, etc.):

1. **Start with the Service API** — it works without a live Designer session, so you can develop/test against any powered-on Disguise server
2. **Use the OpenAPI spec** at `http://{server}:{port}/docs/v1/index.html` (accessible from d3Manager → Help → Open API Documentation) to auto-generate TypeScript types
3. **Poll responsibly** — Disguise explicitly warns against frequent polling. Start at 10-second intervals. Investigate the Live Update API for streaming if latency matters
4. **SMC requires separate network path** — the MGMT port is on a different subnet (172.31.250.x internally, DHCP or static on the external MGMT network). Plan for dual-network access
5. **Auth for SMC writes** — read-only SMC endpoints don't need auth, but power control and config changes require basic auth tokens obtained by creating an account via the SMC web UI
6. **VFC response is empty on non-Disguise hardware** — the API returns empty arrays on consumer PCs running Designer. You'll need actual Disguise hardware for testing VFC/GPU endpoints
7. **DNS-SD uses `_d3host._tcp` and `_d3director._tcp`** — the `bonjour-service` npm package handles this. Service names include hostname and TXT records with metadata

---

*This plan is ready to hand off to an AI coding agent or development team. Each module has specific API endpoints, data formats, and implementation guidance.*
