import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import type { Issue, IssueComment } from '@/types';

export function IssueDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [issue, setIssue] = useState<Issue | null>(null);
  const [comments, setComments] = useState<IssueComment[]>([]);
  const [newComment, setNewComment] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const data = await window.d3watch?.issues?.get(id!);
        if (data) {
          setIssue(data);
          const c = await window.d3watch?.issues?.getComments(id!);
          if (c) setComments(c);
        }
      } catch {
        // Demo fallback
        setIssue({
          id: id || '1', issueNumber: 47, title: 'Genlock lost on GX3-001',
          description: 'Genlock state changed to UNLOCKED on GPU port 0. Previous state: LOCKED (14:22:55)',
          severity: 'critical', status: 'open', machineHostname: 'GX3-001',
          machineType: 'GX 3', projectName: 'PMalone_v3', sessionRole: 'Director',
          createdAt: '2026-03-19T14:23:07Z', updatedAt: '2026-03-19T14:23:07Z',
          createdBy: 'AUTO-ALERT', tags: ['genlock', 'vfc'],
          snapshot: {
            fps: 42.3, droppedFrames: 147, missedFrames: 23, genlockState: 'UNLOCKED',
            temperatures: { CPU0: 64, CPU1: 61, GPU: 73, System: 39 },
            fanSpeeds: { FAN1: 2400, FAN2: 2350 },
            vfcStatus: [], networkConfig: [], systemStates: [], gpuOutputs: [],
          },
        });
        setComments([
          { id: 'c1', issueId: id!, author: 'AUTO-ALERT', text: 'Genlock state changed to UNLOCKED on GPU port 0. Previous state: LOCKED (14:22:55)', timestamp: '2026-03-19T14:23:07Z' },
          { id: 'c2', issueId: id!, author: 'Joe Bradley', text: 'Checking BNC cable at patch panel. Cable looks secure. Swapping to backup genlock source from house sync.', timestamp: '2026-03-19T14:25:12Z' },
        ]);
      }
    })();
  }, [id]);

  async function handleSubmitComment() {
    if (!newComment.trim() || !issue) return;
    const comment: IssueComment = {
      id: crypto.randomUUID(),
      issueId: issue.id,
      author: 'User',
      text: newComment,
      timestamp: new Date().toISOString(),
    };
    try {
      await window.d3watch?.issues?.addComment(issue.id, comment);
    } catch { /* ok */ }
    setComments(prev => [...prev, comment]);
    setNewComment('');
  }

  async function handleStatusChange(status: string) {
    if (!issue) return;
    const updates: Partial<Issue> = { status: status as Issue['status'], updatedAt: new Date().toISOString() };
    if (status === 'resolved') updates.resolvedAt = new Date().toISOString();
    try {
      await window.d3watch?.issues?.update(issue.id, updates);
    } catch { /* ok */ }
    setIssue(prev => prev ? { ...prev, ...updates } : prev);
  }

  if (!issue) {
    return <div className="p-6 text-[#94A3B8]">Loading...</div>;
  }

  const severityColor = {
    critical: '#FF3B3B', warning: '#FFB800', info: '#00F0FF', resolved: '#00FF88'
  }[issue.severity] || '#94A3B8';

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      {/* Back */}
      <button onClick={() => navigate('/issues')} className="text-[#94A3B8] hover:text-[#00F0FF] transition-colors text-sm font-mono flex items-center gap-1">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
        Back to Issues
      </button>

      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-2">
          <span className="w-4 h-4 rounded-full" style={{ backgroundColor: severityColor }} />
          <span className="text-[#94A3B8] font-mono">#{String(issue.issueNumber).padStart(3, '0')}</span>
          <span className="text-[#94A3B8] font-mono text-xs uppercase">{issue.severity}</span>
        </div>
        <h1 className="text-xl font-heading font-bold text-[#F1F5F9]">{issue.title}</h1>
        <div className="flex items-center gap-4 mt-2 text-sm text-[#94A3B8] font-mono">
          <span>Machine: <span className="text-[#F1F5F9]">{issue.machineHostname}</span> ({issue.sessionRole})</span>
          <span>Project: <span className="text-[#F1F5F9]">{issue.projectName}</span></span>
        </div>
        <div className="flex items-center gap-4 mt-1 text-sm text-[#94A3B8] font-mono">
          <span>Created: {new Date(issue.createdAt).toLocaleString()}</span>
          <span>By: {issue.createdBy}</span>
        </div>
        <div className="flex gap-2 mt-3">
          {issue.tags.map(tag => (
            <span key={tag} className="px-2 py-0.5 bg-[#1E293B] text-[#94A3B8] rounded text-xs font-mono">{tag}</span>
          ))}
        </div>
      </div>

      {/* Status */}
      <div className="flex items-center gap-3">
        <label className="text-sm text-[#94A3B8] font-mono">Status:</label>
        <select
          value={issue.status}
          onChange={e => handleStatusChange(e.target.value)}
          className="bg-[#1E293B] text-[#F1F5F9] text-sm rounded px-3 py-1.5 border border-[#1E293B] focus:border-[#00F0FF] outline-none font-mono"
        >
          <option value="open">Open</option>
          <option value="investigating">Investigating</option>
          <option value="resolved">Resolved</option>
          <option value="deferred">Deferred</option>
        </select>
      </div>

      {/* Snapshot */}
      {issue.snapshot && (
        <div className="bg-[#111827] rounded-lg p-5 border border-[#1E293B]">
          <h3 className="text-sm font-mono text-[#00F0FF] mb-4 uppercase tracking-wider">Snapshot at Time of Issue</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-[#94A3B8] block">FPS</span>
              <span className="text-[#F1F5F9] font-mono text-lg">{issue.snapshot.fps}</span>
            </div>
            <div>
              <span className="text-[#94A3B8] block">Genlock</span>
              <span className={`font-mono text-lg ${issue.snapshot.genlockState === 'LOCKED' ? 'text-[#00FF88]' : 'text-[#FF3B3B]'}`}>
                {issue.snapshot.genlockState}
              </span>
            </div>
            <div>
              <span className="text-[#94A3B8] block">Dropped</span>
              <span className="text-[#FF3B3B] font-mono text-lg">{issue.snapshot.droppedFrames}</span>
            </div>
            <div>
              <span className="text-[#94A3B8] block">Missed</span>
              <span className="text-[#FFB800] font-mono text-lg">{issue.snapshot.missedFrames}</span>
            </div>
          </div>
          <div className="grid grid-cols-4 gap-4 mt-4 text-sm">
            {Object.entries(issue.snapshot.temperatures).map(([sensor, temp]) => (
              <div key={sensor}>
                <span className="text-[#94A3B8] block text-xs">{sensor}</span>
                <span className="text-[#F1F5F9] font-mono">{temp}°C</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Activity */}
      <div className="bg-[#111827] rounded-lg p-5 border border-[#1E293B]">
        <h3 className="text-sm font-mono text-[#00F0FF] mb-4 uppercase tracking-wider">Activity</h3>
        <div className="space-y-4">
          {comments.map(comment => (
            <div key={comment.id} className="border-l-2 border-[#1E293B] pl-4">
              <div className="flex items-center gap-2 text-xs text-[#94A3B8] font-mono mb-1">
                <span>{new Date(comment.timestamp).toLocaleTimeString('en-US', { hour12: false })}</span>
                <span className="text-[#F1F5F9]">{comment.author}</span>
              </div>
              <p className="text-sm text-[#F1F5F9]">{comment.text}</p>
            </div>
          ))}
        </div>

        {/* Add comment */}
        <div className="mt-6 flex gap-3">
          <input
            value={newComment}
            onChange={e => setNewComment(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSubmitComment()}
            placeholder="Add comment..."
            className="flex-1 bg-[#0A0E17] text-[#F1F5F9] text-sm rounded px-4 py-2 border border-[#1E293B] focus:border-[#00F0FF] outline-none font-mono placeholder-[#94A3B8]/50"
          />
          <button
            onClick={handleSubmitComment}
            className="px-4 py-2 bg-[#00F0FF]/10 text-[#00F0FF] border border-[#00F0FF]/30 rounded hover:bg-[#00F0FF]/20 transition-colors font-mono text-sm"
          >
            Submit
          </button>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        {issue.status !== 'resolved' && (
          <button
            onClick={() => handleStatusChange('resolved')}
            className="px-4 py-2 bg-[#00FF88]/10 text-[#00FF88] border border-[#00FF88]/30 rounded hover:bg-[#00FF88]/20 transition-colors font-mono text-sm"
          >
            Mark Resolved
          </button>
        )}
        <button
          onClick={() => handleStatusChange('deferred')}
          className="px-4 py-2 bg-[#1E293B] text-[#94A3B8] rounded border border-[#1E293B] hover:border-[#94A3B8] transition-colors font-mono text-sm"
        >
          Defer
        </button>
        <button className="px-4 py-2 bg-[#1E293B] text-[#94A3B8] rounded border border-[#1E293B] hover:border-[#94A3B8] transition-colors font-mono text-sm">
          Export PDF
        </button>
      </div>
    </div>
  );
}
