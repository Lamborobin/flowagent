import { useState, useRef, useEffect } from 'react';
import { Bot, Plus, Settings, ChevronDown, ChevronRight, AlertCircle, FileText, X, Cpu, Pencil, LayoutTemplate, AlignStartHorizontal, Home } from 'lucide-react';
import { useStore } from '../store';

function AgentPanel({ agent, onClose, onEdit }) {
  const instructionFiles = agent.instruction_files || [];

  return (
    <div className="mt-1 mb-2 mx-1 bg-surface-3 border border-border rounded-xl p-3 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[9px] font-bold shrink-0"
            style={{ background: agent.color }}>
            {agent.name[0]}
          </div>
          <span className="text-xs font-semibold text-gray-200">{agent.name}</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={onEdit}
            className="text-gray-600 hover:text-accent transition-colors p-1 rounded"
            title="Edit agent"
          >
            <Pencil size={11} />
          </button>
          <button onClick={onClose} className="text-gray-600 hover:text-gray-400 transition-colors p-1 rounded">
            <X size={12} />
          </button>
        </div>
      </div>

      {agent.is_template && (
        <span className="self-start text-[9px] font-medium px-1.5 py-0.5 rounded-full bg-accent/15 text-accent border border-accent/25 uppercase tracking-wide">
          Template
        </span>
      )}

      {agent.description && (
        <p className="text-[11px] text-gray-500 leading-relaxed">{agent.description}</p>
      )}

      <div className="flex items-center gap-1.5">
        <Cpu size={10} className="text-gray-600 shrink-0" />
        <span className="text-[10px] font-mono text-gray-600">{agent.model}</span>
      </div>

      {agent.prompt_file && (
        <div>
          <p className="text-[10px] font-medium text-gray-500 mb-1.5">System Prompt</p>
          <div className="flex items-center gap-1.5 px-2 py-1.5 bg-accent/10 border border-accent/20 rounded-lg">
            <FileText size={10} className="text-accent shrink-0" />
            <span className="text-[10px] font-mono text-accent truncate">
              {agent.prompt_file.replace(/^instructions\//, '').replace(/\.md$/, '')}
            </span>
          </div>
        </div>
      )}

      {instructionFiles.length > 0 && (
        <div>
          <p className="text-[10px] font-medium text-gray-500 mb-1.5">Context Files</p>
          <div className="space-y-1">
            {instructionFiles.map(f => (
              <div key={f} className="flex items-center gap-1.5 px-2 py-1.5 bg-surface-1 border border-border rounded-lg">
                <FileText size={10} className="text-gray-600 shrink-0" />
                <span className="text-[10px] font-mono text-gray-500 truncate">
                  {f.replace(/^instructions\//, '').replace(/\.md$/, '')}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <p className="text-[10px] font-medium text-gray-500 mb-1.5">Always loaded (global)</p>
        <div className="space-y-1">
          {['CLAUDE.md', 'README.md'].map(f => (
            <div key={f} className="flex items-center gap-1.5 px-2 py-1.5 bg-surface-1 border border-border rounded-lg opacity-50">
              <FileText size={10} className="text-gray-600 shrink-0" />
              <span className="text-[10px] font-mono text-gray-600 truncate">{f}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const NAV_ITEMS = [
  { label: 'Board', icon: Home, page: 'board' },
  { label: 'Settings', icon: Settings, page: 'settings' },
];

export default function Sidebar() {
  const { agents, tasks, agentTemplates, setShowNewAgent, setShowNewTask, setShowTemplates, setEditingAgent, currentPage, setCurrentPage } = useStore();
  const [agentsOpen, setAgentsOpen] = useState(true);
  const [selectedAgentId, setSelectedAgentId] = useState(null);
  const [navOpen, setNavOpen] = useState(false);
  const navRef = useRef(null);

  const humanActionCount = tasks.filter(t => t.column_id === 'col_humanaction').length;

  useEffect(() => {
    function handleOutsideClick(e) {
      if (navRef.current && !navRef.current.contains(e.target)) {
        setNavOpen(false);
      }
    }
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  function toggleAgent(agentId) {
    setSelectedAgentId(prev => prev === agentId ? null : agentId);
  }

  return (
    <>
      <aside className="w-56 bg-surface-1 border-r border-border flex flex-col shrink-0">
        {/* Logo */}
        <div className="p-4 border-b border-border">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-gray-100 tracking-wide">AutoKan</span>

            {/* Nav menu */}
            <div className="relative" ref={navRef}>
              <button
                onClick={() => setNavOpen(o => !o)}
                className={`p-1.5 rounded-md transition-colors ${navOpen ? 'bg-surface-3 text-gray-300' : 'text-gray-600 hover:text-gray-300 hover:bg-surface-3'}`}
                title="Navigate"
              >
                <AlignStartHorizontal size={13} />
              </button>

              {navOpen && (
                <div className="absolute left-0 top-full mt-1.5 w-36 bg-surface-2 border border-border rounded-xl shadow-xl z-50 py-1 overflow-hidden">
                  {NAV_ITEMS.map(({ label, icon: Icon, page }) => (
                    <button
                      key={page}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs hover:bg-surface-3 transition-colors ${currentPage === page ? 'text-accent' : 'text-gray-400 hover:text-gray-100'}`}
                      onClick={() => { setCurrentPage(page); setNavOpen(false); }}
                    >
                      <Icon size={12} />
                      {label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="p-3 space-y-1 border-b border-border">
          <button
            onClick={() => setShowNewTask(true)}
            className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg bg-accent/10 text-accent text-sm font-medium hover:bg-accent/20 transition-colors"
          >
            <Plus size={14} />
            New Task
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
            <div className="space-y-0.5">
              {agents.filter(a => a.active).map(agent => {
                const isSelected = selectedAgentId === agent.id;
                const originTemplate = agent.created_from_template_id
                  ? agentTemplates.find(t => t.id === agent.created_from_template_id)
                  : null;
                const templateArchived = originTemplate?.archived_at;
                const showTemplateBadge = agent.is_template || !!agent.created_from_template_id;
                return (
                  <div key={agent.id}>
                    <button
                      onClick={() => toggleAgent(agent.id)}
                      className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg transition-colors text-left ${
                        isSelected ? 'bg-surface-3' : 'hover:bg-surface-3'
                      }`}
                    >
                      <div className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[9px] font-bold shrink-0"
                        style={{ background: agent.color }}>
                        {agent.name[0]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="text-xs font-medium text-gray-300 truncate">{agent.name}</p>
                          {showTemplateBadge && (
                            <span
                              title={originTemplate ? `From template: ${originTemplate.name}${templateArchived ? ' (archived)' : ''}` : 'Template agent'}
                              className={`shrink-0 text-[8px] font-medium px-1 py-px rounded uppercase tracking-wide leading-none ${
                                templateArchived
                                  ? 'bg-amber-500/15 text-amber-400 border border-amber-500/20'
                                  : 'bg-accent/15 text-accent border border-accent/20'
                              }`}>
                              T
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-gray-600 truncate">{agent.role}</p>
                      </div>
                    </button>

                    {isSelected && (
                      <AgentPanel
                        agent={agent}
                        onClose={() => setSelectedAgentId(null)}
                        onEdit={() => { setSelectedAgentId(null); setEditingAgent(agent); }}
                      />
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
              <button
                onClick={() => setShowTemplates(true)}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-gray-600 hover:text-gray-400 hover:bg-surface-3 transition-colors text-xs"
              >
                <LayoutTemplate size={11} />
                Templates
                {agentTemplates.filter(t => !t.archived_at).length > 0 && (
                  <span className="ml-auto text-[10px] font-mono text-gray-600">
                    {agentTemplates.filter(t => !t.archived_at).length}
                  </span>
                )}
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-border">
          <button
            onClick={() => setCurrentPage(currentPage === 'settings' ? 'board' : 'settings')}
            className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg transition-colors text-xs ${
              currentPage === 'settings'
                ? 'bg-accent/15 text-accent'
                : 'text-gray-600 hover:text-gray-400 hover:bg-surface-3'
            }`}
          >
            <Settings size={12} />
            Settings
          </button>
        </div>
      </aside>
    </>
  );
}
