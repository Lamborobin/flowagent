import { useState } from 'react';
import { Bot, Plus, Settings, Layers, ChevronDown, ChevronRight, Zap, AlertCircle } from 'lucide-react';
import { useStore } from '../store';

export default function Sidebar() {
  const { agents, tasks, setShowNewAgent, setShowNewTask } = useStore();
  const [agentsOpen, setAgentsOpen] = useState(true);

  const humanActionCount = tasks.filter(t => t.column_id === 'col_humanaction').length;

  return (
    <aside className="w-56 bg-surface-1 border-r border-border flex flex-col shrink-0">
      {/* Logo */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 bg-accent rounded-lg flex items-center justify-center">
            <Zap size={14} className="text-white" />
          </div>
          <span className="text-sm font-semibold text-gray-100 tracking-wide">FlowAgent</span>
        </div>
      </div>

      {/* Nav */}
      <nav className="p-3 space-y-1 border-b border-border">
        <button className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg bg-accent/10 text-accent text-sm font-medium">
          <Layers size={14} />
          Kanban Board
        </button>

        {humanActionCount > 0 && (
          <button className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-amber-400 hover:bg-surface-3 text-sm transition-colors">
            <AlertCircle size={14} />
            Human Action
            <span className="ml-auto bg-amber-500/20 text-amber-400 text-xs px-1.5 py-0.5 rounded-full font-mono">
              {humanActionCount}
            </span>
          </button>
        )}
      </nav>

      {/* Agents */}
      <div className="flex-1 overflow-y-auto p-3">
        <button
          onClick={() => setAgentsOpen(o => !o)}
          className="w-full flex items-center justify-between px-1 py-1 mb-1 text-xs font-medium text-gray-500 hover:text-gray-300 transition-colors"
        >
          <span className="flex items-center gap-1.5">
            <Bot size={11} />
            AGENTS
          </span>
          {agentsOpen ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
        </button>

        {agentsOpen && (
          <div className="space-y-1">
            {agents.filter(a => a.active).map(agent => {
              const agentTasks = tasks.filter(t => t.assigned_agent_id === agent.id);
              return (
                <div key={agent.id}
                  className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg hover:bg-surface-3 transition-colors cursor-pointer">
                  <div className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[9px] font-bold shrink-0"
                    style={{ background: agent.color }}>
                    {agent.name[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-gray-300 truncate">{agent.name}</p>
                    <p className="text-[10px] text-gray-600 truncate">{agent.role}</p>
                  </div>
                  {agentTasks.length > 0 && (
                    <span className="text-[10px] font-mono text-gray-600">{agentTasks.length}</span>
                  )}
                </div>
              );
            })}

            <button
              onClick={() => setShowNewAgent(true)}
              className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-gray-600 hover:text-gray-400 hover:bg-surface-3 transition-colors text-xs"
            >
              <Plus size={11} />
              Add agent
            </button>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-3 border-t border-border">
        <button className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-gray-600 hover:text-gray-400 hover:bg-surface-3 transition-colors text-xs">
          <Settings size={12} />
          Settings
        </button>
      </div>
    </aside>
  );
}
