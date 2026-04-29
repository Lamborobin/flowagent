import { create } from 'zustand';
import { tasksApi, columnsApi, agentsApi, secretsApi, agentTemplatesApi, instructionsApi } from '../api';

export const useStore = create((set, get) => ({
  columns: [],
  tasks: [],
  agents: [],
  secrets: [],
  agentTemplates: [],
  instructionFiles: [],
  loading: false,
  selectedTask: null,
  showNewTask: false,
  showNewAgent: false,
  showTemplates: false,
  editingAgent: null,
  currentPage: 'board', // 'board' | 'settings'
  theme: localStorage.getItem('theme') || 'dark',

  // Load everything
  async load() {
    set({ loading: true });
    try {
      const [columns, tasks, agents, agentTemplates] = await Promise.all([
        columnsApi.list(true), // include archived so they can be restored
        tasksApi.list(),
        agentsApi.list(),
        agentTemplatesApi.list(true),
      ]);
      set({ columns, tasks, agents, agentTemplates, loading: false });
    } catch (e) {
      console.error('Load failed:', e);
      set({ loading: false });
    }
  },

  // Tasks
  async createTask(data) {
    const task = await tasksApi.create(data);
    set(s => ({ tasks: [task, ...s.tasks] }));
    return task;
  },

  async updateTask(id, data) {
    const updated = await tasksApi.update(id, data);
    set(s => ({ tasks: s.tasks.map(t => t.id === id ? updated : t) }));
    return updated;
  },

  async moveTask(taskId, columnId) {
    const updated = await tasksApi.move(taskId, columnId);
    set(s => ({ tasks: s.tasks.map(t => t.id === taskId ? updated : t) }));
    return updated;
  },

  async deleteTask(id) {
    await tasksApi.delete(id);
    set(s => ({ tasks: s.tasks.filter(t => t.id !== id), selectedTask: s.selectedTask?.id === id ? null : s.selectedTask }));
  },

  async archiveTask(id) {
    await tasksApi.archive(id);
    set(s => ({ tasks: s.tasks.filter(t => t.id !== id), selectedTask: s.selectedTask?.id === id ? null : s.selectedTask }));
  },

  async bypassPm(id) {
    const updated = await tasksApi.bypassPm(id);
    set(s => ({ tasks: s.tasks.map(t => t.id === id ? updated : t), selectedTask: s.selectedTask?.id === id ? updated : s.selectedTask }));
    return updated;
  },

  // Agents
  async createAgent(data) {
    const agent = await agentsApi.create(data);
    set(s => ({ agents: [...s.agents, agent] }));
    return agent;
  },

  async updateAgent(id, data) {
    const updated = await agentsApi.update(id, data);
    set(s => ({ agents: s.agents.map(a => a.id === id ? updated : a) }));
  },

  async archiveAgent(id) {
    await agentsApi.archive(id);
    set(s => ({ agents: s.agents.map(a => a.id === id ? { ...a, active: 0, archived_at: new Date().toISOString() } : a) }));
  },

  async deleteAgent(id) {
    await agentsApi.delete(id);
    set(s => ({ agents: s.agents.filter(a => a.id !== id) }));
  },

  // Columns
  async createColumn(data) {
    const col = await columnsApi.create(data);
    set(s => ({ columns: [...s.columns, col] }));
  },

  async updateColumn(id, data) {
    const updated = await columnsApi.update(id, data);
    set(s => ({ columns: s.columns.map(c => c.id === id ? updated : c) }));
    return updated;
  },

  // Optimistic local reorder — call this before firing API updates
  reorderColumnsLocally(orderedActiveIds) {
    set(s => {
      const archived = s.columns.filter(c => !!c.archived_at);
      const active = orderedActiveIds
        .map((id, idx) => {
          const col = s.columns.find(c => c.id === id);
          return col ? { ...col, position: idx } : null;
        })
        .filter(Boolean);
      return { columns: [...active, ...archived] };
    });
  },

  async archiveColumn(id) {
    await columnsApi.archive(id);
    set(s => ({ columns: s.columns.map(c => c.id === id ? { ...c, archived_at: new Date().toISOString() } : c) }));
  },

  async unarchiveColumn(id) {
    await columnsApi.unarchive(id);
    set(s => ({ columns: s.columns.map(c => c.id === id ? { ...c, archived_at: null } : c) }));
  },

  async deleteColumn(id) {
    await columnsApi.delete(id);
    set(s => ({ columns: s.columns.filter(c => c.id !== id) }));
  },

  // Agent Templates
  async createTemplate(data) {
    const tpl = await agentTemplatesApi.create(data);
    set(s => ({ agentTemplates: [tpl, ...s.agentTemplates] }));
    return tpl;
  },

  async updateTemplate(id, data) {
    const updated = await agentTemplatesApi.update(id, data);
    set(s => ({ agentTemplates: s.agentTemplates.map(t => t.id === id ? updated : t) }));
    return updated;
  },

  async archiveTemplate(id) {
    await agentTemplatesApi.archive(id);
    set(s => ({
      agentTemplates: s.agentTemplates.map(t =>
        t.id === id ? { ...t, archived_at: new Date().toISOString() } : t
      ),
    }));
  },

  async unarchiveTemplate(id) {
    await agentTemplatesApi.unarchive(id);
    set(s => ({
      agentTemplates: s.agentTemplates.map(t =>
        t.id === id ? { ...t, archived_at: null } : t
      ),
    }));
  },

  async deleteTemplate(id) {
    await agentTemplatesApi.delete(id);
    set(s => ({ agentTemplates: s.agentTemplates.filter(t => t.id !== id) }));
  },

  async saveAgentAsTemplate(agentId, data) {
    const tpl = await agentTemplatesApi.saveAgentAs(agentId, data);
    set(s => ({ agentTemplates: [tpl, ...s.agentTemplates] }));
    return tpl;
  },

  // Instruction files
  async loadInstructionFiles() {
    const files = await instructionsApi.list(true);
    set({ instructionFiles: files });
    return files;
  },

  async createInstructionFile(name, content) {
    const file = await instructionsApi.create({ name, content });
    set(s => ({ instructionFiles: [...s.instructionFiles, file] }));
    return file;
  },

  async updateInstructionFile(filename, content) {
    await instructionsApi.update(filename, content);
    set(s => ({
      instructionFiles: s.instructionFiles.map(f =>
        f.name + '.md' === filename ? { ...f, _content: content } : f
      ),
    }));
  },

  async archiveInstructionFile(filename) {
    await instructionsApi.archive(filename);
    set(s => ({
      instructionFiles: s.instructionFiles.map(f =>
        f.name + '.md' === filename ? { ...f, archived: true, path: `instructions/archived/${filename}` } : f
      ),
    }));
  },

  async unarchiveInstructionFile(filename) {
    await instructionsApi.unarchive(filename);
    set(s => ({
      instructionFiles: s.instructionFiles.map(f =>
        f.name + '.md' === filename ? { ...f, archived: false, path: `instructions/${filename}` } : f
      ),
    }));
  },

  async deleteInstructionFile(filename) {
    await instructionsApi.delete(filename);
    set(s => ({
      instructionFiles: s.instructionFiles.filter(f => f.name + '.md' !== filename),
    }));
  },

  // UI state
  setSelectedTask: (task) => set({ selectedTask: task }),
  setShowNewTask: (v) => set({ showNewTask: v }),
  setShowNewAgent: (v) => set({ showNewAgent: v }),
  setShowTemplates: (v) => set({ showTemplates: v }),
  setEditingAgent: (agent) => set({ editingAgent: agent }),
  setCurrentPage: (page) => set({ currentPage: page }),

  setTheme(theme) {
    localStorage.setItem('theme', theme);
    document.documentElement.classList.toggle('light', theme === 'light');
    set({ theme });
  },
}));
