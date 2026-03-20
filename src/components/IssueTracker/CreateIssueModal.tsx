import { useState } from 'react';
import { useAppContext } from '@/store/AppContext';
import type { Issue } from '@/types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  machineId?: string;
  onCreated: (issue: Issue) => void;
}

export function CreateIssueModal({ isOpen, onClose, machineId, onCreated }: Props) {
  const { state } = useAppContext();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [severity, setSeverity] = useState<'critical' | 'warning' | 'info'>('warning');
  const [selectedMachine, setSelectedMachine] = useState(machineId || '');
  const [tags, setTags] = useState('');

  if (!isOpen) return null;

  async function handleCreate() {
    if (!title.trim()) return;

    const issue: Partial<Issue> = {
      id: crypto.randomUUID(),
      title,
      description,
      severity,
      status: 'open',
      machineId: selectedMachine || undefined,
      machineHostname: state.machines.find(m => m.id === selectedMachine)?.hostname,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: 'User',
      tags: tags.split(',').map(t => t.trim()).filter(Boolean),
    };

    try {
      const created = await window.d3watch?.issues?.create(issue);
      onCreated(created || issue as Issue);
    } catch {
      onCreated(issue as Issue);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-[#111827] rounded-lg border border-[#1E293B] p-6 w-full max-w-lg shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <h2 className="text-lg font-heading font-bold text-[#F1F5F9] mb-6">New Issue</h2>

        <div className="space-y-4">
          <div>
            <label className="block text-xs text-[#94A3B8] font-mono mb-1">Title</label>
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="w-full bg-[#0A0E17] text-[#F1F5F9] text-sm rounded px-4 py-2 border border-[#1E293B] focus:border-[#00F0FF] outline-none font-mono"
              placeholder="Brief issue description..."
            />
          </div>

          <div>
            <label className="block text-xs text-[#94A3B8] font-mono mb-1">Description</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={4}
              className="w-full bg-[#0A0E17] text-[#F1F5F9] text-sm rounded px-4 py-2 border border-[#1E293B] focus:border-[#00F0FF] outline-none font-mono resize-none"
              placeholder="Detailed notes (Markdown supported)..."
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-[#94A3B8] font-mono mb-1">Severity</label>
              <select
                value={severity}
                onChange={e => setSeverity(e.target.value as 'critical' | 'warning' | 'info')}
                className="w-full bg-[#0A0E17] text-[#F1F5F9] text-sm rounded px-3 py-2 border border-[#1E293B] focus:border-[#00F0FF] outline-none font-mono"
              >
                <option value="critical">Critical</option>
                <option value="warning">Warning</option>
                <option value="info">Info</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-[#94A3B8] font-mono mb-1">Machine</label>
              <select
                value={selectedMachine}
                onChange={e => setSelectedMachine(e.target.value)}
                className="w-full bg-[#0A0E17] text-[#F1F5F9] text-sm rounded px-3 py-2 border border-[#1E293B] focus:border-[#00F0FF] outline-none font-mono"
              >
                <option value="">Select machine...</option>
                {state.machines.map(m => (
                  <option key={m.id} value={m.id}>{m.hostname}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs text-[#94A3B8] font-mono mb-1">Tags (comma-separated)</label>
            <input
              value={tags}
              onChange={e => setTags(e.target.value)}
              className="w-full bg-[#0A0E17] text-[#F1F5F9] text-sm rounded px-4 py-2 border border-[#1E293B] focus:border-[#00F0FF] outline-none font-mono"
              placeholder="genlock, vfc, thermal..."
            />
          </div>

          <div className="flex items-center gap-2">
            <input type="checkbox" id="autoSnapshot" defaultChecked className="accent-[#00F0FF]" />
            <label htmlFor="autoSnapshot" className="text-sm text-[#94A3B8]">Auto-capture system snapshot</label>
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 text-[#94A3B8] hover:text-[#F1F5F9] transition-colors font-mono text-sm"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            className="px-6 py-2 bg-[#00F0FF]/10 text-[#00F0FF] border border-[#00F0FF]/30 rounded hover:bg-[#00F0FF]/20 transition-colors font-mono text-sm"
          >
            Create Issue
          </button>
        </div>
      </div>
    </div>
  );
}
