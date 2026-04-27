import { create } from 'zustand';
import { tasksApi, columnsApi, agentsApi, secretsApi, agentTemplatesApi } from '../api';

export const useStore = create((set, get) => ({
  columns: [],
  tasks: [],
  agents: [],
  secrets: [],
  agentTemplates: [],
  loading: false,
  selectedTask: null,
  showNewTask: false,
  showNewAgent: false,
  showTemplates: false,
  editingAgent: null,

  // Load everything
  async load() {
    set({ loading: true });
    try {
      const [columns, tasks, agents, agentTemplates] = await Promise.all([
        columnsApi.list(),
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

  async deleteAgent(id) {
    await agentsApi.delete(id);
    set(s => ({ agents: s.agents.map(a => a.id === id ? { ...a, active: 0 } : a) }));
  },

  // Columns
  async createColumn(data) {
    const col = await columnsApi.create(data);
    set(s => ({ columns: [...s.columns, col] }));
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

  async saveAgentAsTemplate(agentId, data) {
    const tpl = await agentTemplatesApi.saveAgentAs(agentId, data);
    set(s => ({ agentTemplates: [tpl, ...s.agentTemplates] }));
    return tpl;
  },

  // UI state
  setSelectedTask: (task) => set({ selectedTask: task }),
  setShowNewTask: (v) => set({ showNewTask: v }),
  setShowNewAgent: (v) => set({ showNewAgent: v }),
  setShowTemplates: (v) => set({ showTemplates: v }),
  setEditingAgent: (agent) => set({ editingAgent: agent }),
}));
