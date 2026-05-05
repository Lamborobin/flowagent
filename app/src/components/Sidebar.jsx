import { useState, useRef, useEffect } from 'react';
import { Bot, Plus, Settings, ChevronDown, ChevronRight, AlertCircle, FileText, X, Cpu, Pencil, LayoutTemplate, AlignStartHorizontal, Home, Archive, LogOut, Check, FolderOpen, Briefcase } from 'lucide-react';
import ArchivedTasksModal from './ArchivedTasksModal';
import { useDraggable } from '@dnd-kit/core';
import { useStore } from '../store';

function AgentPanel({ agent, onClose, onEdit }) {
  const { roles } = useStore();
  const instructionFiles = agent.instruction_files || [];
  const agentRoles = (agent.role_ids || [])
    .map(id => roles.find(r => r.id === id))
    .filter(Boolean);

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
          <button onClick={onEdit} className="text-gray-600 hover:text-accent transition-colors p-1 rounded" title="Edit agent">
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

      {agentRoles.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {agentRoles.map(role => (
            <span key={role.id} className="text-[9px] font-medium px-1.5 py-0.5 rounded-full border"
              style={{ color: role.color, borderColor: role.color + '40', background: role.color + '18' }}>
              {role.name}
            </span>
          ))}
        </div>
      )}

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

function DraggableAgentRow({ agent, isSelected, showTemplateBadge, templateArchived, originTemplate, onToggle }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: agent.id });
  return (
    <div ref={setNodeRef} style={{ opacity: isDragging ? 0.4 : 1 }}>
      <button
        {...attributes}
        {...listeners}
        onClick={() => onToggle(agent.id)}
        className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg transition-colors text-left ${
          isSelected ? 'bg-surface-3' : 'hover:bg-surface-3'
        }`}
        title="Click to expand · Drag to assign to a task"
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
    </div>
  );
}

function ProjectSwitcher() {
  const { projects, currentProjectId, setCurrentProject, createProject } = useStore();
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newClient, setNewClient] = useState('');
  const [creating, setCreating] = useState(false);
  const ref = useRef(null);
  const inputRef = useRef(null);

  const current = projects.find(p => p.id === currentProjectId) || projects[0];
  const active = projects.filter(p => !p.archived_at);

  useEffect(() => {
    function handleOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) { setOpen(false); setAdding(false); }
    }
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  useEffect(() => {
    if (adding) setTimeout(() => inputRef.current?.focus(), 50);
  }, [adding]);

  async function handleCreate(e) {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const proj = await createProject({ name: newName.trim(), client_name: newClient.trim() || null });
      setCurrentProject(proj.id);
      setAdding(false);
      setOpen(false);
      setNewName('');
      setNewClient('');
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => { setOpen(o => !o); setAdding(false); }}
        className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg hover:bg-surface-3 transition-colors group"
      >
        <div className="w-6 h-6 rounded-md flex items-center justify-center text-sm shrink-0"
          style={{ background: current?.color ? current.color + '22' : '#6366f122', border: `1px solid ${current?.color || '#6366f1'}33` }}>
          {current?.emoji || '📋'}
        </div>
        <div className="flex-1 min-w-0 text-left">
          <p className="text-xs font-semibold text-gray-200 truncate">{current?.name || 'No board'}</p>
          {current?.client_name && (
            <p className="text-[10px] text-gray-600 truncate">{current.client_name}</p>
          )}
        </div>
        <ChevronDown size={10} className={`text-gray-600 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full mt-1 bg-surface-2 border border-border rounded-xl shadow-2xl z-50 overflow-hidden">
          {/* Project list */}
          <div className="py-1 max-h-48 overflow-y-auto">
            {active.map(p => (
              <button
                key={p.id}
                onClick={() => { setCurrentProject(p.id); setOpen(false); }}
                className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-surface-3 transition-colors"
              >
                <div className="w-5 h-5 rounded flex items-center justify-center text-xs shrink-0"
                  style={{ background: p.color + '22' }}>
                  {p.emoji || '📋'}
                </div>
                <div className="flex-1 min-w-0 text-left">
                  <p className="text-xs font-medium text-gray-300 truncate">{p.name}</p>
                  {p.client_name && <p className="text-[10px] text-gray-600 truncate">{p.client_name}</p>}
                </div>
                {p.id === currentProjectId && <Check size={11} className="text-accent shrink-0" />}
              </button>
            ))}
          </div>

          <div className="border-t border-border">
            {adding ? (
              <form onSubmit={handleCreate} className="p-2.5 space-y-2">
                <input
                  ref={inputRef}
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  placeholder="Board name"
                  className="w-full bg-surface-3 border border-border rounded-lg px-2 py-1.5 text-xs text-gray-200 placeholder-gray-600 outline-none focus:border-accent/50"
                />
                <input
                  value={newClient}
                  onChange={e => setNewClient(e.target.value)}
                  placeholder="Client name (optional)"
                  className="w-full bg-surface-3 border border-border rounded-lg px-2 py-1.5 text-xs text-gray-200 placeholder-gray-600 outline-none focus:border-accent/50"
                />
                <div className="flex gap-1.5">
                  <button type="button" onClick={() => setAdding(false)}
                    className="flex-1 py-1 text-xs text-gray-600 hover:text-gray-400 transition-colors">
                    Cancel
                  </button>
                  <button type="submit" disabled={creating || !newName.trim()}
                    className="flex-1 py-1 text-xs font-medium text-white bg-accent hover:bg-accent/80 rounded-lg transition-colors disabled:opacity-40">
                    {creating ? '...' : 'Create'}
                  </button>
                </div>
              </form>
            ) : (
              <button
                onClick={() => setAdding(true)}
                className="w-full flex items-center gap-2 px-3 py-2.5 text-xs text-gray-600 hover:text-gray-400 hover:bg-surface-3 transition-colors"
              >
                <Plus size={11} />
                New board
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function UserMenu() {
  const { user, logout, updateProfile } = useStore();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [company, setCompany] = useState(user?.company_name || '');
  const [saving, setSaving] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function handleOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) { setOpen(false); setEditing(false); }
    }
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  async function handleSave() {
    setSaving(true);
    try {
      await updateProfile({ company_name: company });
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  const displayName = user ? `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email : '';

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-surface-3 transition-colors"
        title={displayName}
      >
        {user?.picture ? (
          <img src={user.picture} alt="" className="w-6 h-6 rounded-full shrink-0 ring-1 ring-border" />
        ) : (
          <div className="w-6 h-6 rounded-full bg-accent/20 border border-accent/30 flex items-center justify-center text-[10px] font-bold text-accent shrink-0">
            {(user?.first_name?.[0] || user?.email?.[0] || '?').toUpperCase()}
          </div>
        )}
        <div className="flex-1 min-w-0 text-left">
          <p className="text-xs font-medium text-gray-300 truncate">{displayName || user?.email}</p>
          {user?.company_name && (
            <p className="text-[10px] text-gray-600 truncate">{user.company_name}</p>
          )}
        </div>
        <ChevronDown size={10} className={`text-gray-600 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute left-0 right-0 bottom-full mb-1 bg-surface-2 border border-border rounded-xl shadow-2xl z-50 overflow-hidden">
          {/* Profile header */}
          <div className="px-3 py-3 border-b border-border">
            <div className="flex items-center gap-2.5 mb-2.5">
              {user?.picture ? (
                <img src={user.picture} alt="" className="w-8 h-8 rounded-full ring-1 ring-border" />
              ) : (
                <div className="w-8 h-8 rounded-full bg-accent/20 border border-accent/30 flex items-center justify-center text-sm font-bold text-accent">
                  {(user?.first_name?.[0] || '?').toUpperCase()}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-gray-200 truncate">{displayName}</p>
                <p className="text-[10px] text-gray-600 truncate">{user?.email}</p>
              </div>
            </div>

            {editing ? (
              <div className="space-y-1.5">
                <input
                  value={company}
                  onChange={e => setCompany(e.target.value)}
                  placeholder="Company name"
                  className="w-full bg-surface-3 border border-border rounded-lg px-2 py-1.5 text-xs text-gray-200 placeholder-gray-600 outline-none focus:border-accent/50"
                  autoFocus
                  onKeyDown={e => e.key === 'Enter' && handleSave()}
                />
                <div className="flex gap-1">
                  <button onClick={() => setEditing(false)} className="flex-1 py-1 text-[10px] text-gray-600 hover:text-gray-400">Cancel</button>
                  <button onClick={handleSave} disabled={saving}
                    className="flex-1 py-1 text-[10px] font-medium text-white bg-accent hover:bg-accent/80 rounded transition-colors disabled:opacity-40">
                    {saving ? '...' : 'Save'}
                  </button>
                </div>
              </div>
            ) : (
              <button onClick={() => { setCompany(user?.company_name || ''); setEditing(true); }}
                className="w-full flex items-center gap-1.5 text-[10px] text-gray-600 hover:text-accent transition-colors">
                <Briefcase size={9} />
                {user?.company_name ? user.company_name : 'Add company name…'}
              </button>
            )}
          </div>

          <button
            onClick={() => { setOpen(false); logout(); }}
            className="w-full flex items-center gap-2 px-3 py-2.5 text-xs text-gray-500 hover:text-red-400 hover:bg-surface-3 transition-colors"
          >
            <LogOut size={11} />
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}

const NAV_ITEMS = [
  { label: 'Board', icon: Home, page: 'board' },
  { label: 'Settings', icon: Settings, page: 'settings' },
];

export default function Sidebar() {
  const { agents, tasks, archivedTasks, agentTemplates, setShowNewAgent, setShowNewTask, setShowTemplates, setEditingAgent, currentPage, setCurrentPage } = useStore();
  const [agentsOpen, setAgentsOpen] = useState(true);
  const [selectedAgentId, setSelectedAgentId] = useState(null);
  const [navOpen, setNavOpen] = useState(false);
  const [showArchivedModal, setShowArchivedModal] = useState(false);
  const navRef = useRef(null);

  const humanActionCount = tasks.filter(t => t.column_id === 'col_humanaction').length;

  useEffect(() => {
    function handleOutsideClick(e) {
      if (navRef.current && !navRef.current.contains(e.target)) setNavOpen(false);
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
        {/* Header — project switcher + nav */}
        <div className="p-3 border-b border-border space-y-1">
          <div className="flex items-center justify-between px-0.5 mb-1.5">
            <span className="text-[10px] font-medium text-gray-600 uppercase tracking-widest">FlowAgent</span>
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
          <ProjectSwitcher />
        </div>

        {/* Actions */}
        <nav className="p-3 space-y-1 border-b border-border">
          <button
            onClick={() => setShowNewTask(true)}
            className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg bg-accent/10 text-accent text-sm font-medium hover:bg-accent/20 transition-colors"
          >
            <Plus size={14} />
            New Task
          </button>

          {archivedTasks.length > 0 && (
            <button
              onClick={() => setShowArchivedModal(true)}
              className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-gray-600 hover:text-gray-400 hover:bg-surface-3 text-xs transition-colors"
            >
              <Archive size={12} />
              Archived tasks
              <span className="ml-auto font-mono text-[10px]">{archivedTasks.length}</span>
            </button>
          )}

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
                    <DraggableAgentRow
                      agent={agent}
                      isSelected={isSelected}
                      showTemplateBadge={showTemplateBadge}
                      templateArchived={templateArchived}
                      originTemplate={originTemplate}
                      onToggle={toggleAgent}
                    />
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

              <button onClick={() => setShowNewAgent(true)}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-gray-600 hover:text-gray-400 hover:bg-surface-3 transition-colors text-xs">
                <Plus size={11} />
                Add agent
              </button>
              <button onClick={() => setShowTemplates(true)}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-gray-600 hover:text-gray-400 hover:bg-surface-3 transition-colors text-xs">
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

        {/* Footer — user menu */}
        <div className="p-3 border-t border-border space-y-1">
          <button
            onClick={() => setCurrentPage(currentPage === 'settings' ? 'board' : 'settings')}
            className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg transition-colors text-xs ${
              currentPage === 'settings' ? 'bg-accent/15 text-accent' : 'text-gray-600 hover:text-gray-400 hover:bg-surface-3'
            }`}
          >
            <Settings size={12} />
            Settings
          </button>
          <UserMenu />
        </div>
      </aside>

      {showArchivedModal && <ArchivedTasksModal onClose={() => setShowArchivedModal(false)} />}
    </>
  );
}
