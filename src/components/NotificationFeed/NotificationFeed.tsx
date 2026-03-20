import React, { useRef, useEffect, useState, useCallback } from 'react';
import type { D3Notification } from '@/types';

interface NotificationFeedProps {
  notifications: D3Notification[];
  machineFilter?: string;
}

type FilterMode = 'all' | 'critical' | 'warning' | 'machine';

const severityBadge: Record<string, { bg: string; text: string; label: string }> = {
  critical: { bg: 'bg-[#FF3B3B]/15', text: 'text-[#FF3B3B]', label: 'CRIT' },
  warning: { bg: 'bg-[#FFB800]/15', text: 'text-[#FFB800]', label: 'WARN' },
  info: { bg: 'bg-[#00F0FF]/15', text: 'text-[#00F0FF]', label: 'INFO' },
};

function formatTime(ts: string): string {
  try {
    const d = new Date(ts);
    return d.toLocaleTimeString('en-GB', { hour12: false });
  } catch {
    return ts;
  }
}

const NotificationFeed: React.FC<NotificationFeedProps> = ({ notifications, machineFilter }) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [filter, setFilter] = useState<FilterMode>('all');
  const [selectedMachine, setSelectedMachine] = useState<string>(machineFilter ?? '');

  // Auto-scroll
  useEffect(() => {
    if (!isPaused && scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
  }, [notifications, isPaused]);

  // Get unique machine names
  const machines = React.useMemo(() => {
    const set = new Set<string>();
    notifications.forEach((n) => set.add(n.hostname));
    return Array.from(set).sort();
  }, [notifications]);

  // Filter notifications
  const filtered = React.useMemo(() => {
    let list = notifications;
    if (filter === 'critical') list = list.filter((n) => n.severity === 'critical');
    else if (filter === 'warning') list = list.filter((n) => n.severity === 'warning');
    else if (filter === 'machine' && selectedMachine) {
      list = list.filter((n) => n.hostname === selectedMachine);
    }
    if (machineFilter) {
      list = list.filter((n) => n.machineId === machineFilter || n.hostname === machineFilter);
    }
    return list;
  }, [notifications, filter, selectedMachine, machineFilter]);

  const handleTrack = useCallback((notification: D3Notification) => {
    if (!window.d3watch?.issues) return;
    window.d3watch.issues.create({
      title: notification.summary,
      description: notification.detail,
      severity: notification.severity,
      status: 'open',
      machineId: notification.machineId,
      machineHostname: notification.hostname,
      createdBy: 'd3watch-auto',
      tags: [notification.severity],
    });
  }, []);

  return (
    <div className="rounded-xl border border-[#1E293B] bg-[#111827] p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
        <h3 className="font-mono text-xs font-bold tracking-wider text-[#94A3B8]">
          NOTIFICATIONS
          <span className="ml-2 rounded bg-[#1E293B] px-1.5 py-0.5 font-mono text-[10px] tabular-nums text-[#00F0FF]">
            {filtered.length}
          </span>
        </h3>

        {/* Filters */}
        <div className="flex items-center gap-1.5">
          {(['all', 'critical', 'warning'] as FilterMode[]).map((mode) => (
            <button
              key={mode}
              onClick={() => setFilter(mode)}
              className={`rounded px-2 py-0.5 font-mono text-[10px] font-bold tracking-wider transition-colors ${
                filter === mode
                  ? 'bg-[#00F0FF]/15 text-[#00F0FF]'
                  : 'text-[#94A3B8] hover:text-[#F1F5F9]'
              }`}
            >
              {mode.toUpperCase()}
            </button>
          ))}
          {/* Machine filter */}
          {machines.length > 1 && (
            <select
              value={filter === 'machine' ? selectedMachine : ''}
              onChange={(e) => {
                if (e.target.value) {
                  setFilter('machine');
                  setSelectedMachine(e.target.value);
                } else {
                  setFilter('all');
                }
              }}
              className="rounded bg-[#0A0E17] border border-[#1E293B] px-1.5 py-0.5 font-mono text-[10px] text-[#94A3B8] outline-none focus:border-[#00F0FF]/40"
            >
              <option value="">By Machine</option>
              {machines.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Scrolling log */}
      <div
        ref={scrollRef}
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
        className="max-h-64 overflow-y-auto scrollbar-thin scrollbar-track-[#0A0E17] scrollbar-thumb-[#1E293B] space-y-1"
      >
        {filtered.length === 0 && (
          <p className="py-6 text-center font-mono text-xs text-[#94A3B8]/50">
            No notifications to display
          </p>
        )}
        {filtered.map((n, idx) => {
          const badge = severityBadge[n.severity] ?? severityBadge.info;
          return (
            <div
              key={n.id ?? idx}
              className="group flex items-start gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-[#1E293B]/50"
            >
              {/* Severity badge */}
              <span
                className={`shrink-0 rounded px-1.5 py-0.5 font-mono text-[9px] font-bold ${badge.bg} ${badge.text}`}
              >
                {badge.label}
              </span>

              {/* Timestamp */}
              <span className="shrink-0 font-mono text-[11px] tabular-nums text-[#94A3B8]/70">
                {formatTime(n.timestamp)}
              </span>

              {/* Machine */}
              <span className="shrink-0 font-mono text-[11px] font-semibold text-[#00F0FF]/70">
                {n.hostname}
              </span>

              {/* Message */}
              <span className="min-w-0 flex-1 font-mono text-[11px] text-[#F1F5F9]/80 truncate">
                {n.summary}
              </span>

              {/* Track button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleTrack(n);
                }}
                className="shrink-0 rounded border border-[#1E293B] px-1.5 py-0.5 font-mono text-[9px] text-[#94A3B8] opacity-0 transition-all hover:border-[#00F0FF]/40 hover:text-[#00F0FF] group-hover:opacity-100"
              >
                TRACK
              </button>
            </div>
          );
        })}
      </div>

      {/* Pause indicator */}
      {isPaused && (
        <div className="mt-1 text-center">
          <span className="font-mono text-[9px] text-[#FFB800]/60">PAUSED - hover to hold</span>
        </div>
      )}
    </div>
  );
};

export default NotificationFeed;
