import Database from 'better-sqlite3';
import { app } from 'electron';
import path from 'path';
import crypto from 'crypto';

export class DatabaseService {
  private db: Database.Database;

  constructor() {
    const dbPath = path.join(app.getPath('userData'), 'd3watch.db');
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
    this.createTables();
  }

  private createTables(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS machines (
        id TEXT PRIMARY KEY,
        hostname TEXT,
        type TEXT,
        ip_address TEXT,
        smc_ip TEXT,
        first_seen TEXT,
        last_seen TEXT,
        metadata JSON,
        is_online INTEGER DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS health_snapshots (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        machine_id TEXT NOT NULL,
        timestamp TEXT,
        fps REAL,
        dropped_frames INTEGER,
        missed_frames INTEGER,
        system_states JSON,
        FOREIGN KEY (machine_id) REFERENCES machines(id)
      );

      CREATE TABLE IF NOT EXISTS temperature_readings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        machine_id TEXT NOT NULL,
        timestamp TEXT,
        sensor_name TEXT,
        value_celsius REAL,
        source TEXT,
        FOREIGN KEY (machine_id) REFERENCES machines(id)
      );

      CREATE TABLE IF NOT EXISTS fan_readings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        machine_id TEXT NOT NULL,
        timestamp TEXT,
        fan_name TEXT,
        rpm INTEGER,
        FOREIGN KEY (machine_id) REFERENCES machines(id)
      );

      CREATE TABLE IF NOT EXISTS vfc_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        machine_id TEXT NOT NULL,
        timestamp TEXT,
        slot INTEGER,
        event_type TEXT,
        card_type TEXT,
        firmware TEXT,
        port_states JSON,
        FOREIGN KEY (machine_id) REFERENCES machines(id)
      );

      CREATE TABLE IF NOT EXISTS network_snapshots (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        machine_id TEXT NOT NULL,
        timestamp TEXT,
        adapters JSON,
        FOREIGN KEY (machine_id) REFERENCES machines(id)
      );

      CREATE TABLE IF NOT EXISTS gpu_snapshots (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        machine_id TEXT NOT NULL,
        timestamp TEXT,
        genlock_frequency REAL,
        outputs JSON,
        FOREIGN KEY (machine_id) REFERENCES machines(id)
      );

      CREATE TABLE IF NOT EXISTS notifications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        machine_id TEXT,
        timestamp TEXT,
        summary TEXT,
        detail TEXT,
        severity TEXT,
        FOREIGN KEY (machine_id) REFERENCES machines(id)
      );

      CREATE TABLE IF NOT EXISTS issues (
        id TEXT PRIMARY KEY,
        issue_number INTEGER UNIQUE,
        title TEXT,
        description TEXT,
        severity TEXT,
        status TEXT DEFAULT 'open',
        machine_id TEXT,
        machine_hostname TEXT,
        machine_type TEXT,
        project_name TEXT,
        session_role TEXT,
        snapshot JSON,
        created_at TEXT,
        updated_at TEXT,
        resolved_at TEXT,
        created_by TEXT,
        tags JSON,
        FOREIGN KEY (machine_id) REFERENCES machines(id)
      );

      CREATE TABLE IF NOT EXISTS issue_comments (
        id TEXT PRIMARY KEY,
        issue_id TEXT NOT NULL,
        author TEXT,
        text TEXT,
        timestamp TEXT,
        state_diff JSON,
        FOREIGN KEY (issue_id) REFERENCES issues(id)
      );

      CREATE TABLE IF NOT EXISTS issue_attachments (
        id TEXT PRIMARY KEY,
        issue_id TEXT NOT NULL,
        filename TEXT,
        type TEXT,
        file_path TEXT,
        timestamp TEXT,
        FOREIGN KEY (issue_id) REFERENCES issues(id)
      );

      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        name TEXT,
        started_at TEXT,
        ended_at TEXT,
        notes TEXT
      );

      CREATE TABLE IF NOT EXISTS network_profiles (
        id TEXT PRIMARY KEY,
        data JSON
      );

      CREATE TABLE IF NOT EXISTS deployment_logs (
        id TEXT PRIMARY KEY,
        profile_id TEXT,
        profile_name TEXT,
        target_machine_id TEXT,
        target_hostname TEXT,
        operator TEXT,
        timestamp TEXT,
        status TEXT,
        duration_ms INTEGER,
        results JSON,
        error_message TEXT
      );

      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT
      );

      -- Indexes for performance
      CREATE INDEX IF NOT EXISTS idx_health_machine_ts ON health_snapshots(machine_id, timestamp);
      CREATE INDEX IF NOT EXISTS idx_temp_machine_ts ON temperature_readings(machine_id, timestamp);
      CREATE INDEX IF NOT EXISTS idx_fan_machine_ts ON fan_readings(machine_id, timestamp);
      CREATE INDEX IF NOT EXISTS idx_vfc_machine_ts ON vfc_events(machine_id, timestamp);
      CREATE INDEX IF NOT EXISTS idx_network_machine_ts ON network_snapshots(machine_id, timestamp);
      CREATE INDEX IF NOT EXISTS idx_gpu_machine_ts ON gpu_snapshots(machine_id, timestamp);
      CREATE INDEX IF NOT EXISTS idx_notifications_machine_ts ON notifications(machine_id, timestamp);
      CREATE INDEX IF NOT EXISTS idx_issues_status ON issues(status);
      CREATE INDEX IF NOT EXISTS idx_issues_severity ON issues(severity);
      CREATE INDEX IF NOT EXISTS idx_issues_machine ON issues(machine_id);
      CREATE INDEX IF NOT EXISTS idx_issue_comments_issue ON issue_comments(issue_id);
      CREATE INDEX IF NOT EXISTS idx_issue_attachments_issue ON issue_attachments(issue_id);
      CREATE INDEX IF NOT EXISTS idx_machines_online ON machines(is_online);
      CREATE INDEX IF NOT EXISTS idx_deploy_logs_profile ON deployment_logs(profile_id, timestamp);
    `);
  }

  close(): void {
    this.db.close();
  }

  // ── Machines ──────────────────────────────────────────────────────

  upsertMachine(machine: Record<string, unknown>): void {
    const stmt = this.db.prepare(`
      INSERT INTO machines (id, hostname, type, ip_address, smc_ip, first_seen, last_seen, metadata, is_online)
      VALUES (@id, @hostname, @type, @ip_address, @smc_ip, @first_seen, @last_seen, @metadata, @is_online)
      ON CONFLICT(id) DO UPDATE SET
        hostname = excluded.hostname,
        type = excluded.type,
        ip_address = excluded.ip_address,
        smc_ip = excluded.smc_ip,
        last_seen = excluded.last_seen,
        metadata = excluded.metadata,
        is_online = excluded.is_online
    `);
    stmt.run({
      id: machine.id,
      hostname: machine.hostname ?? null,
      type: machine.type ?? null,
      ip_address: machine.ip_address ?? null,
      smc_ip: machine.smc_ip ?? null,
      first_seen: machine.first_seen ?? new Date().toISOString(),
      last_seen: machine.last_seen ?? new Date().toISOString(),
      metadata: machine.metadata ? JSON.stringify(machine.metadata) : null,
      is_online: machine.is_online ?? 0,
    });
  }

  getMachines(): Record<string, unknown>[] {
    const stmt = this.db.prepare('SELECT * FROM machines');
    const rows = stmt.all() as Record<string, unknown>[];
    return rows.map(this.parseMachineRow);
  }

  getMachine(id: string): Record<string, unknown> | undefined {
    const stmt = this.db.prepare('SELECT * FROM machines WHERE id = ?');
    const row = stmt.get(id) as Record<string, unknown> | undefined;
    return row ? this.parseMachineRow(row) : undefined;
  }

  private parseMachineRow(row: Record<string, unknown>): Record<string, unknown> {
    if (row.metadata && typeof row.metadata === 'string') {
      try { row.metadata = JSON.parse(row.metadata as string); } catch { /* keep as string */ }
    }
    return row;
  }

  // ── Health Snapshots ──────────────────────────────────────────────

  insertHealthSnapshot(data: Record<string, unknown>): void {
    const stmt = this.db.prepare(`
      INSERT INTO health_snapshots (machine_id, timestamp, fps, dropped_frames, missed_frames, system_states)
      VALUES (@machine_id, @timestamp, @fps, @dropped_frames, @missed_frames, @system_states)
    `);
    stmt.run({
      machine_id: data.machine_id,
      timestamp: data.timestamp ?? new Date().toISOString(),
      fps: data.fps ?? null,
      dropped_frames: data.dropped_frames ?? null,
      missed_frames: data.missed_frames ?? null,
      system_states: data.system_states ? JSON.stringify(data.system_states) : null,
    });
  }

  getHealthSnapshots(machineId: string, limit = 100): Record<string, unknown>[] {
    const stmt = this.db.prepare(
      'SELECT * FROM health_snapshots WHERE machine_id = ? ORDER BY timestamp DESC LIMIT ?'
    );
    const rows = stmt.all(machineId, limit) as Record<string, unknown>[];
    return rows.map((row) => {
      if (row.system_states && typeof row.system_states === 'string') {
        try { row.system_states = JSON.parse(row.system_states as string); } catch { /* keep */ }
      }
      return row;
    });
  }

  // ── Temperature Readings ──────────────────────────────────────────

  insertTemperatureReading(data: Record<string, unknown>): void {
    const stmt = this.db.prepare(`
      INSERT INTO temperature_readings (machine_id, timestamp, sensor_name, value_celsius, source)
      VALUES (@machine_id, @timestamp, @sensor_name, @value_celsius, @source)
    `);
    stmt.run({
      machine_id: data.machine_id,
      timestamp: data.timestamp ?? new Date().toISOString(),
      sensor_name: data.sensor_name ?? null,
      value_celsius: data.value_celsius ?? null,
      source: data.source ?? null,
    });
  }

  getTemperatureReadings(machineId: string, limit = 100): Record<string, unknown>[] {
    const stmt = this.db.prepare(
      'SELECT * FROM temperature_readings WHERE machine_id = ? ORDER BY timestamp DESC LIMIT ?'
    );
    return stmt.all(machineId, limit) as Record<string, unknown>[];
  }

  // ── Notifications ─────────────────────────────────────────────────

  insertNotification(data: Record<string, unknown>): void {
    const stmt = this.db.prepare(`
      INSERT INTO notifications (machine_id, timestamp, summary, detail, severity)
      VALUES (@machine_id, @timestamp, @summary, @detail, @severity)
    `);
    stmt.run({
      machine_id: data.machine_id ?? null,
      timestamp: data.timestamp ?? new Date().toISOString(),
      summary: data.summary ?? null,
      detail: data.detail ?? null,
      severity: data.severity ?? null,
    });
  }

  getNotifications(machineId: string, limit = 100): Record<string, unknown>[] {
    if (machineId) {
      const stmt = this.db.prepare(
        'SELECT * FROM notifications WHERE machine_id = ? ORDER BY timestamp DESC LIMIT ?'
      );
      return stmt.all(machineId, limit) as Record<string, unknown>[];
    }
    const stmt = this.db.prepare(
      'SELECT * FROM notifications ORDER BY timestamp DESC LIMIT ?'
    );
    return stmt.all(limit) as Record<string, unknown>[];
  }

  // ── VFC Events ────────────────────────────────────────────────────

  insertVFCEvent(data: Record<string, unknown>): void {
    const stmt = this.db.prepare(`
      INSERT INTO vfc_events (machine_id, timestamp, slot, event_type, card_type, firmware, port_states)
      VALUES (@machine_id, @timestamp, @slot, @event_type, @card_type, @firmware, @port_states)
    `);
    stmt.run({
      machine_id: data.machine_id,
      timestamp: data.timestamp ?? new Date().toISOString(),
      slot: data.slot ?? null,
      event_type: data.event_type ?? null,
      card_type: data.card_type ?? null,
      firmware: data.firmware ?? null,
      port_states: data.port_states ? JSON.stringify(data.port_states) : null,
    });
  }

  getVFCEvents(machineId: string): Record<string, unknown>[] {
    const stmt = this.db.prepare(
      'SELECT * FROM vfc_events WHERE machine_id = ? ORDER BY timestamp DESC'
    );
    const rows = stmt.all(machineId) as Record<string, unknown>[];
    return rows.map((row) => {
      if (row.port_states && typeof row.port_states === 'string') {
        try { row.port_states = JSON.parse(row.port_states as string); } catch { /* keep */ }
      }
      return row;
    });
  }

  // ── Issues ────────────────────────────────────────────────────────

  getIssues(filters?: Record<string, string>): Record<string, unknown>[] {
    let query = 'SELECT * FROM issues';
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (filters) {
      if (filters.status) {
        conditions.push('status = ?');
        params.push(filters.status);
      }
      if (filters.severity) {
        conditions.push('severity = ?');
        params.push(filters.severity);
      }
      if (filters.machineId) {
        conditions.push('machine_id = ?');
        params.push(filters.machineId);
      }
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }
    query += ' ORDER BY created_at DESC';

    const stmt = this.db.prepare(query);
    const rows = stmt.all(...params) as Record<string, unknown>[];
    return rows.map(this.parseIssueRow);
  }

  getIssue(id: string): Record<string, unknown> | undefined {
    const stmt = this.db.prepare('SELECT * FROM issues WHERE id = ?');
    const row = stmt.get(id) as Record<string, unknown> | undefined;
    if (!row) return undefined;

    const issue = this.parseIssueRow(row);
    issue.comments = this.getComments(id);

    const attachStmt = this.db.prepare(
      'SELECT * FROM issue_attachments WHERE issue_id = ? ORDER BY timestamp ASC'
    );
    issue.attachments = attachStmt.all(id);

    return issue;
  }

  createIssue(issue: Record<string, unknown>): Record<string, unknown> {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    // Auto-increment issue_number
    const maxRow = this.db.prepare(
      'SELECT MAX(issue_number) as max_num FROM issues'
    ).get() as Record<string, unknown> | undefined;
    const issueNumber = ((maxRow?.max_num as number) ?? 0) + 1;

    const stmt = this.db.prepare(`
      INSERT INTO issues (
        id, issue_number, title, description, severity, status,
        machine_id, machine_hostname, machine_type, project_name, session_role,
        snapshot, created_at, updated_at, resolved_at, created_by, tags
      ) VALUES (
        @id, @issue_number, @title, @description, @severity, @status,
        @machine_id, @machine_hostname, @machine_type, @project_name, @session_role,
        @snapshot, @created_at, @updated_at, @resolved_at, @created_by, @tags
      )
    `);

    stmt.run({
      id,
      issue_number: issueNumber,
      title: issue.title ?? null,
      description: issue.description ?? null,
      severity: issue.severity ?? 'medium',
      status: issue.status ?? 'open',
      machine_id: issue.machine_id ?? null,
      machine_hostname: issue.machine_hostname ?? null,
      machine_type: issue.machine_type ?? null,
      project_name: issue.project_name ?? null,
      session_role: issue.session_role ?? null,
      snapshot: issue.snapshot ? JSON.stringify(issue.snapshot) : null,
      created_at: now,
      updated_at: now,
      resolved_at: issue.resolved_at ?? null,
      created_by: issue.created_by ?? null,
      tags: issue.tags ? JSON.stringify(issue.tags) : null,
    });

    return this.getIssue(id)!;
  }

  updateIssue(id: string, updates: Record<string, unknown>): Record<string, unknown> | undefined {
    const setClauses: string[] = [];
    const params: Record<string, unknown> = { id };

    const allowedFields = [
      'title', 'description', 'severity', 'status',
      'machine_id', 'machine_hostname', 'machine_type',
      'project_name', 'session_role', 'resolved_at', 'created_by',
    ];

    for (const field of allowedFields) {
      if (field in updates) {
        setClauses.push(`${field} = @${field}`);
        params[field] = updates[field];
      }
    }

    // Handle JSON fields separately
    if ('snapshot' in updates) {
      setClauses.push('snapshot = @snapshot');
      params.snapshot = updates.snapshot ? JSON.stringify(updates.snapshot) : null;
    }
    if ('tags' in updates) {
      setClauses.push('tags = @tags');
      params.tags = updates.tags ? JSON.stringify(updates.tags) : null;
    }

    if (setClauses.length === 0) return this.getIssue(id);

    setClauses.push('updated_at = @updated_at');
    params.updated_at = new Date().toISOString();

    const stmt = this.db.prepare(
      `UPDATE issues SET ${setClauses.join(', ')} WHERE id = @id`
    );
    stmt.run(params);

    return this.getIssue(id);
  }

  private parseIssueRow(row: Record<string, unknown>): Record<string, unknown> {
    if (row.snapshot && typeof row.snapshot === 'string') {
      try { row.snapshot = JSON.parse(row.snapshot as string); } catch { /* keep */ }
    }
    if (row.tags && typeof row.tags === 'string') {
      try { row.tags = JSON.parse(row.tags as string); } catch { /* keep */ }
    }
    return row;
  }

  // ── Issue Comments ────────────────────────────────────────────────

  addComment(issueId: string, comment: Record<string, unknown>): Record<string, unknown> {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    const stmt = this.db.prepare(`
      INSERT INTO issue_comments (id, issue_id, author, text, timestamp, state_diff)
      VALUES (@id, @issue_id, @author, @text, @timestamp, @state_diff)
    `);
    stmt.run({
      id,
      issue_id: issueId,
      author: comment.author ?? null,
      text: comment.text ?? null,
      timestamp: comment.timestamp ?? now,
      state_diff: comment.state_diff ? JSON.stringify(comment.state_diff) : null,
    });

    // Update issue's updated_at timestamp
    this.db.prepare('UPDATE issues SET updated_at = ? WHERE id = ?').run(now, issueId);

    return { id, issue_id: issueId, ...comment, timestamp: comment.timestamp ?? now };
  }

  getComments(issueId: string): Record<string, unknown>[] {
    const stmt = this.db.prepare(
      'SELECT * FROM issue_comments WHERE issue_id = ? ORDER BY timestamp ASC'
    );
    const rows = stmt.all(issueId) as Record<string, unknown>[];
    return rows.map((row) => {
      if (row.state_diff && typeof row.state_diff === 'string') {
        try { row.state_diff = JSON.parse(row.state_diff as string); } catch { /* keep */ }
      }
      return row;
    });
  }

  // ── Network Profiles ──────────────────────────────────────────────

  getProfiles(): Record<string, unknown>[] {
    const stmt = this.db.prepare('SELECT * FROM network_profiles');
    const rows = stmt.all() as Record<string, unknown>[];
    return rows.map((row) => {
      if (row.data && typeof row.data === 'string') {
        try { row.data = JSON.parse(row.data as string); } catch { /* keep */ }
      }
      return row;
    });
  }

  saveProfile(profile: Record<string, unknown>): void {
    const id = (profile.id as string) ?? crypto.randomUUID();
    const stmt = this.db.prepare(`
      INSERT INTO network_profiles (id, data)
      VALUES (@id, @data)
      ON CONFLICT(id) DO UPDATE SET data = excluded.data
    `);
    stmt.run({
      id,
      data: profile.data ? JSON.stringify(profile.data) : JSON.stringify(profile),
    });
  }

  deleteProfile(id: string): void {
    const stmt = this.db.prepare('DELETE FROM network_profiles WHERE id = ?');
    stmt.run(id);
  }

  // ── Deployment Logs ────────────────────────────────────────────────

  getDeploymentLogs(profileId?: string): Record<string, unknown>[] {
    if (profileId) {
      const stmt = this.db.prepare('SELECT * FROM deployment_logs WHERE profile_id = ? ORDER BY timestamp DESC');
      const rows = stmt.all(profileId) as Record<string, unknown>[];
      return rows.map((row) => {
        if (row.results && typeof row.results === 'string') {
          try { row.results = JSON.parse(row.results as string); } catch { /* keep */ }
        }
        return row;
      });
    }
    const stmt = this.db.prepare('SELECT * FROM deployment_logs ORDER BY timestamp DESC LIMIT 100');
    const rows = stmt.all() as Record<string, unknown>[];
    return rows.map((row) => {
      if (row.results && typeof row.results === 'string') {
        try { row.results = JSON.parse(row.results as string); } catch { /* keep */ }
      }
      return row;
    });
  }

  saveDeploymentLog(log: Record<string, unknown>): void {
    const id = (log.id as string) ?? crypto.randomUUID();
    const stmt = this.db.prepare(`
      INSERT INTO deployment_logs (id, profile_id, profile_name, target_machine_id, target_hostname, operator, timestamp, status, duration_ms, results, error_message)
      VALUES (@id, @profileId, @profileName, @targetMachineId, @targetHostname, @operator, @timestamp, @status, @durationMs, @results, @errorMessage)
    `);
    stmt.run({
      id,
      profileId: log.profileId ?? log.profile_id ?? '',
      profileName: log.profileName ?? log.profile_name ?? '',
      targetMachineId: log.targetMachineId ?? log.target_machine_id ?? '',
      targetHostname: log.targetHostname ?? log.target_hostname ?? '',
      operator: log.operator ?? 'operator',
      timestamp: log.timestamp ?? new Date().toISOString(),
      status: log.status ?? 'unknown',
      durationMs: log.durationMs ?? log.duration_ms ?? 0,
      results: JSON.stringify({
        hostnameResult: log.hostnameResult,
        adapterResults: log.adapterResults,
      }),
      errorMessage: log.errorMessage ?? log.error_message ?? null,
    });
  }

  // ── Settings ──────────────────────────────────────────────────────

  getSetting(key: string): string | undefined {
    const stmt = this.db.prepare('SELECT value FROM settings WHERE key = ?');
    const row = stmt.get(key) as { value: string } | undefined;
    return row?.value;
  }

  setSetting(key: string, value: string): void {
    const stmt = this.db.prepare(`
      INSERT INTO settings (key, value)
      VALUES (@key, @value)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `);
    stmt.run({ key, value });
  }

  // ── Data Retention ────────────────────────────────────────────────

  purgeOldData(daysToKeep: number): void {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - daysToKeep);
    const cutoffISO = cutoff.toISOString();

    const tables = [
      'health_snapshots',
      'temperature_readings',
      'fan_readings',
      'vfc_events',
      'network_snapshots',
      'gpu_snapshots',
      'notifications',
    ];

    const purge = this.db.transaction(() => {
      for (const table of tables) {
        this.db.prepare(`DELETE FROM ${table} WHERE timestamp < ?`).run(cutoffISO);
      }
    });

    purge();
  }
}
