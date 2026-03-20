import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { CreateIssueModal } from './CreateIssueModal';
import type { Issue } from '@/types';

const severityColors: Record<string, string> = {
  critical: 'bg-[#FF3B3B]',
  warning: 'bg-[#FFB800]',
  info: 'bg-[#00F0FF]',
  resolved: 'bg-[#00FF88]',
};

const statusColors: Record<string, string> = {
  open: 'text-[#FF3B3B] bg-[#FF3B3B]/10',
  investigating: 'text-[#FFB800] bg-[#FFB800]/10',
  resolved: 'text-[#00FF88] bg-[#00FF88]/10',
  deferred: 'text-[#94A3B8] bg-[#94A3B8]/10',
};

export function IssueList() {
  const navigate = useNavigate();
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [severityFilter, setSeverityFilter] = useState('all');
  const [showCreateModal, setShowCreateModal] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const data = await window.d3watch?.issues?.getAll();
        if (data) setIssues(data);
      } catch (err) {
        console.error('[d3Watch] Failed to load issues:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filtered = issues.filter(issue => {
    if (statusFilter !== 'all' && issue.status !== statusFilter) return false;
    if (severityFilter !== 'all' && issue.severity !== severityFilter) return false;
    return true;
  });

  function formatTime(iso: string) {
    try {
      return new Date(iso).toLocaleTimeString('en-US', { hour12: false });
    } catch { return iso; }
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-heading font-bold text-[#F1F5F9] tracking-wider">ISSUES</h1>
        <div className="flex gap-3">
          <button className="px-4 py-2 bg-[#1E293B] text-[#94A3B8] rounded border border-[#1E293B] hover:border-[#94A3B8] transition-colors font-mono text-sm">
            Export
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-[#00F0FF]/10 text-[#00F0FF] border border-[#00F0FF]/30 rounded hover:bg-[#00F0FF]/20 transition-colors font-mono text-sm"
          >
            + New Issue
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-4 items-center">
        <div className="flex items-center gap-2">
          <label className="text-xs text-[#94A3B8] font-mono">Status:</label>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
            className="bg-[#1E293B] text-[#F1F5F9] text-sm rounded px-3 py-1.5 border border-[#1E293B] focus:border-[#00F0FF] outline-none font-mono">
            <option value="all">All</option>
            <option value="open">Open</option>
            <option value="investigating">Investigating</option>
            <option value="resolved">Resolved</option>
            <option value="deferred">Deferred</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-[#94A3B8] font-mono">Severity:</label>
          <select value={severityFilter} onChange={e => setSeverityFilter(e.target.value)}
            className="bg-[#1E293B] text-[#F1F5F9] text-sm rounded px-3 py-1.5 border border-[#1E293B] focus:border-[#00F0FF] outline-none font-mono">
            <option value="all">All</option>
            <option value="critical">Critical</option>
            <option value="warning">Warning</option>
            <option value="info">Info</option>
          </select>
        </div>
        <span className="ml-auto text-xs text-[#94A3B8] font-mono">
          {filtered.length} issue{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Issue List */}
      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-6 h-6 border-2 border-[#00F0FF] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[#1E293B] bg-[#111827]/50 py-16">
          <p className="font-mono text-sm text-[#F1F5F9]">No issues recorded</p>
          <p className="mt-1 font-mono text-xs text-[#94A3B8]">
            {issues.length > 0 ? 'No issues match current filters' : 'Issues will appear here when created manually or triggered by alerts'}
          </p>
          <button onClick={() => setShowCreateModal(true)}
            className="mt-4 px-4 py-2 bg-[#00F0FF]/10 text-[#00F0FF] border border-[#00F0FF]/30 rounded hover:bg-[#00F0FF]/20 transition-colors font-mono text-sm">
            + Create First Issue
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(issue => (
            <button key={issue.id} onClick={() => navigate(`/issues/${issue.id}`)}
              className="w-full text-left bg-[#111827] rounded-lg p-4 border border-[#1E293B] hover:border-[#00F0FF]/30 transition-all group">
              <div className="flex items-start gap-3">
                <span className={`w-3 h-3 rounded-full mt-1 flex-shrink-0 ${severityColors[issue.severity] || 'bg-[#94A3B8]'}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-1">
                    <span className="text-[#94A3B8] font-mono text-xs">#{String(issue.issueNumber).padStart(3, '0')}</span>
                    <span className={`px-2 py-0.5 rounded text-xs font-mono uppercase ${statusColors[issue.status] || ''}`}>
                      {issue.status}
                    </span>
                    <span className="text-[#94A3B8] font-mono text-xs">{formatTime(issue.createdAt)}</span>
                    {issue.machineHostname && <span className="text-[#94A3B8] font-mono text-xs">{issue.machineHostname}</span>}
                  </div>
                  <p className="text-[#F1F5F9] text-sm group-hover:text-[#00F0FF] transition-colors truncate">{issue.title}</p>
                  {issue.tags && issue.tags.length > 0 && (
                    <div className="flex items-center gap-2 mt-2">
                      {issue.tags.map(tag => (
                        <span key={tag} className="px-2 py-0.5 bg-[#1E293B] text-[#94A3B8] rounded text-xs font-mono">{tag}</span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {showCreateModal && (
        <CreateIssueModal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)}
          onCreated={(issue) => { setIssues(prev => [issue, ...prev]); setShowCreateModal(false); }} />
      )}
    </div>
  );
}
