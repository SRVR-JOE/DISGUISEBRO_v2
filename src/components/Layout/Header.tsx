import { useState, useEffect } from 'react';
import { useAppContext } from '@/store/AppContext';

export default function Header() {
  const { state } = useAppContext();
  const [currentTime, setCurrentTime] = useState(formatTime());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(formatTime());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const onlineCount = state.machines.filter((m) => m.isOnline).length;
  const totalCount = state.machines.length;
  const isMonitoring = state.isPolling || totalCount > 0;

  return (
    <header className="h-14 bg-[#0A0E17]/90 backdrop-blur-sm border-b border-[#1E293B]/60 flex items-center justify-between px-6 shrink-0 z-30">
      {/* Left: App name */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          {/* Lightning bolt */}
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="text-[#00F0FF]">
            <path
              d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"
              fill="currentColor"
              opacity="0.9"
            />
          </svg>
          <h1 className="text-lg font-bold tracking-wider">
            <span className="text-[#E91E8C] text-glow-magenta">d3</span>
            <span className="text-[#F1F5F9]">Watch</span>
          </h1>
        </div>

        {/* Separator */}
        <div className="w-px h-5 bg-[#1E293B] mx-1" />

        {/* Machine count badge */}
        <div className="flex items-center gap-1.5 bg-[#111827] border border-[#1E293B] rounded-md px-2.5 py-1">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
            <line x1="8" y1="21" x2="16" y2="21" />
            <line x1="12" y1="17" x2="12" y2="21" />
          </svg>
          <span className="text-xs text-[#94A3B8] font-medium">
            <span className="text-[#00F0FF]">{onlineCount}</span>
            <span className="text-[#1E293B] mx-0.5">/</span>
            {totalCount}
          </span>
        </div>
      </div>

      {/* Right: Status + time */}
      <div className="flex items-center gap-4">
        {/* Connection status */}
        <div className="flex items-center gap-2">
          <div className="relative">
            <div
              className={`w-2 h-2 rounded-full ${
                isMonitoring ? 'bg-[#00FF88]' : 'bg-[#FF3B3B]'
              }`}
            />
            {isMonitoring && (
              <div className="absolute inset-0 w-2 h-2 rounded-full bg-[#00FF88] animate-ping opacity-40" />
            )}
          </div>
          <span className={`text-xs font-medium tracking-wide ${
            isMonitoring ? 'text-[#00FF88]' : 'text-[#FF3B3B]'
          }`}>
            {isMonitoring ? 'Monitoring' : 'Offline'}
          </span>
        </div>

        {/* Separator */}
        <div className="w-px h-5 bg-[#1E293B]" />

        {/* Time display */}
        <div className="font-mono text-sm text-[#94A3B8] tracking-widest tabular-nums">
          {currentTime}
        </div>
      </div>
    </header>
  );
}

function formatTime(): string {
  const now = new Date();
  return now.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}
