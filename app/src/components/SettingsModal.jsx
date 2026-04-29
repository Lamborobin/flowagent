import { useState } from 'react';
import { X, Settings, Layers, Bot } from 'lucide-react';
import { useStore } from '../store';

export default function SettingsModal({ onClose }) {
  const { columns, agents } = useStore();
  const [tab, setTab] = useState('board');

  const activeColumns = columns.filter(c => !c.archived_at);
  const activeAgents = agents.filter(a => a.active);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-surface-1 border border-border rounded-2xl w-full max-w-lg shadow-2xl" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2.5">
            <Settings size={15} className="text-accent" />
            <span className="text-sm font-semibold text-gray-100">Settings</span>
          </div>
          <button onClick={onClose} className="text-gray-600 hover:text-gray-300 transition-colors p-1 rounded">
            <X size={16} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border px-5">
          {[
            { id: 'board', label: 'Board', icon: Layers },
            { id: 'agents', label: 'Agents', icon: Bot },
          ].map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`flex items-center gap-1.5 px-3 py-3 text-xs font-medium border-b-2 transition-colors ${
                tab === id
                  ? 'border-accent text-accent'
                  : 'border-transparent text-gray-500 hover:text-gray-300'
              }`}
            >
              <Icon size={12} />
              {label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 max-h-96 overflow-y-auto">
          {tab === 'board' && (
            <div>
              <p className="text-xs font-medium text-gray-400 mb-3">
                Columns <span className="text-gray-600 font-normal">({activeColumns.length} active)</span>
              </p>
              <div className="space-y-1.5">
                {activeColumns.map(col => (
                  <div key={col.id} className="flex items-center gap-3 px-3 py-2.5 bg-surface-2 border border-border rounded-lg">
                    <div className="w-2 h-2 rounded-full shrink-0" style={{ background: col.color }} />
                    <span className="text-xs text-gray-300 flex-1">{col.name}</span>
                    <span className="text-[10px] font-mono text-gray-600">{col.id}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {tab === 'agents' && (
            <div>
              <p className="text-xs font-medium text-gray-400 mb-3">
                Agents <span className="text-gray-600 font-normal">({activeAgents.length} active)</span>
              </p>
              <div className="space-y-1.5">
                {activeAgents.map(agent => (
                  <div key={agent.id} className="flex items-center gap-3 px-3 py-2.5 bg-surface-2 border border-border rounded-lg">
                    <div
                      className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[9px] font-bold shrink-0"
                      style={{ background: agent.color }}
                    >
                      {agent.name[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-gray-300">{agent.name}</p>
                      <p className="text-[10px] font-mono text-gray-600 truncate">{agent.model}</p>
                    </div>
                    {agent.is_template && (
                      <span className="text-[8px] font-medium px-1 py-px rounded uppercase tracking-wide bg-accent/15 text-accent border border-accent/20">
                        T
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="px-5 py-3 border-t border-border">
          <p className="text-[10px] text-gray-600">AutoKan v0.1.0</p>
        </div>
      </div>
    </div>
  );
}
