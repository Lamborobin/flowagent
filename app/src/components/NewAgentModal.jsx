import { useState } from 'react';
import { X, Plus } from 'lucide-react';
import { useStore } from '../store';

const ALL_PERMISSIONS = [
  { key: 'task:create', label: 'Create tasks' },
  { key: 'task:read', label: 'Read tasks' },
  { key: 'task:update', label: 'Full update tasks' },
  { key: 'task:update:status', label: 'Update task status' },
  { key: 'task:update:progress', label: 'Update progress' },
  { key: 'task:delete', label: 'Delete tasks' },
  { key: 'task:move', label: 'Move tasks between columns' },
  { key: 'task:assign', label: 'Assign tasks to agents' },
  { key: 'task:log', label: 'Add activity logs' },
  { key: 'task:request_human', label: 'Request human action' },
];

const MODELS = [
  'claude-opus-4-5',
  'claude-sonnet-4-5',
  'claude-haiku-4-5-20251001',
];

const COLORS = ['#6366f1','#3b82f6','#8b5cf6','#ec4899','#10b981','#f59e0b','#ef4444','#06b6d4'];

export default function NewAgentModal() {
  const { createAgent, setShowNewAgent } = useStore();
  const [form, setForm] = useState({
    name: '', role: '', model: 'claude-sonnet-4-5',
    description: '', permissions: ['task:read'], color: '#6366f1',
  });
  const [saving, setSaving] = useState(false);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const togglePerm = (perm) => {
    setForm(f => ({
      ...f,
      permissions: f.permissions.includes(perm)
        ? f.permissions.filter(p => p !== perm)
        : [...f.permissions, perm]
    }));
  };

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.name.trim() || !form.role.trim()) return;
    setSaving(true);
    try {
      await createAgent(form);
      setShowNewAgent(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in"
         onClick={e => e.target === e.currentTarget && setShowNewAgent(false)}>
      <div className="bg-surface-2 border border-border rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto animate-slide-in">
        <div className="flex items-center justify-between p-5 border-b border-border sticky top-0 bg-surface-2">
          <h2 className="text-base font-semibold text-gray-100">New Agent</h2>
          <button onClick={() => setShowNewAgent(false)} className="btn-ghost p-1.5 rounded-lg">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">Name *</label>
              <input value={form.name} onChange={e => set('name', e.target.value)}
                placeholder="QA Engineer"
                className="w-full bg-surface-3 border border-border rounded-lg px-3 py-2 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:border-accent transition-colors" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">Role ID *</label>
              <input value={form.role} onChange={e => set('role', e.target.value.toLowerCase().replace(/\s+/g, '_'))}
                placeholder="qa_engineer"
                className="w-full bg-surface-3 border border-border rounded-lg px-3 py-2 text-sm font-mono text-gray-100 placeholder-gray-600 focus:outline-none focus:border-accent transition-colors" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">Description</label>
            <textarea value={form.description} onChange={e => set('description', e.target.value)}
              placeholder="What does this agent do?"
              rows={2}
              className="w-full bg-surface-3 border border-border rounded-lg px-3 py-2 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:border-accent transition-colors resize-none" />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">Model</label>
            <select value={form.model} onChange={e => set('model', e.target.value)}
              className="w-full bg-surface-3 border border-border rounded-lg px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-accent">
              {MODELS.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-400 mb-2">Color</label>
            <div className="flex gap-2">
              {COLORS.map(c => (
                <button key={c} type="button" onClick={() => set('color', c)}
                  className="w-6 h-6 rounded-full transition-transform hover:scale-110"
                  style={{ background: c, outline: form.color === c ? `2px solid white` : 'none', outlineOffset: '2px' }} />
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-400 mb-2">Permissions</label>
            <div className="space-y-1.5">
              {ALL_PERMISSIONS.map(p => (
                <label key={p.key} className="flex items-center gap-2.5 cursor-pointer group">
                  <div onClick={() => togglePerm(p.key)}
                    className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                      form.permissions.includes(p.key) ? 'bg-accent border-accent' : 'border-border bg-surface-3 group-hover:border-accent/50'
                    }`}>
                    {form.permissions.includes(p.key) && (
                      <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 12 12">
                        <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    )}
                  </div>
                  <span className="text-xs text-gray-400 group-hover:text-gray-300">{p.label}</span>
                  <span className="text-[10px] font-mono text-gray-700 ml-auto">{p.key}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setShowNewAgent(false)} className="btn-ghost flex-1 justify-center py-2">
              Cancel
            </button>
            <button type="submit" disabled={saving || !form.name.trim() || !form.role.trim()}
              className="btn-primary flex-1 justify-center py-2 disabled:opacity-40">
              <Plus size={14} />
              {saving ? 'Creating...' : 'Create Agent'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
