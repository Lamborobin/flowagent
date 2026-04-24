import { useState, useEffect } from 'react';
import { X, Trash2, ArrowRight, Clock, Tag, User, Activity } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useStore } from '../store';
import { tasksApi } from '../api';

const PRIORITY_COLORS = {
  critical: '#ef4444', high: '#f97316', medium: '#3b82f6', low: '#6b7280'
};

export default function TaskDetail() {
  const { selectedTask, setSelectedTask, columns, agents, moveTask, deleteTask, updateTask } = useStore();
  const [task, setTask] = useState(null);
  const [logs, setLogs] = useState([]);

  useEffect(() => {
    if (!selectedTask) return;
    tasksApi.get(selectedTask.id).then(t => { setTask(t); setLogs(t.logs || []); });
  }, [selectedTask?.id]);

  if (!selectedTask) return null;
  if (!task) return (
    <div className="w-96 border-l border-border bg-surface-1 flex items-center justify-center">
      <div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
    </div>
  );

  const assignedAgent = agents.find(a => a.id === task.assigned_agent_id);
  const tags = Array.isArray(task.tags) ? task.tags : [];

  async function handleMove(columnId) {
    await moveTask(task.id, columnId);
    setTask(t => ({ ...t, column_id: columnId }));
  }

  async function handleDelete() {
    if (!confirm('Delete this task?')) return;
    await deleteTask(task.id);
  }

  return (
    <div className="w-96 border-l border-border bg-surface-1 flex flex-col overflow-hidden animate-slide-in">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border shrink-0">
        <span className="text-xs font-mono text-gray-600">{task.id}</span>
        <div className="flex items-center gap-1">
          <button onClick={() => handleDelete()} className="btn-ghost p-1.5 rounded-lg text-red-400 hover:text-red-300 hover:bg-red-500/10">
            <Trash2 size={14} />
          </button>
          <button onClick={() => setSelectedTask(null)} className="btn-ghost p-1.5 rounded-lg">
            <X size={14} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="p-4 space-y-4">
          {/* Title */}
          <h2 className="text-base font-semibold text-gray-100 leading-snug">{task.title}</h2>

          {/* Human action notice */}
          {task.requires_human_action === 1 && (
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3">
              <p className="text-xs font-medium text-amber-400 mb-1">⚠ Human Action Required</p>
              <p className="text-xs text-amber-300/70">{task.human_action_reason}</p>
            </div>
          )}

          {/* Description */}
          {task.description && (
            <p className="text-sm text-gray-400 leading-relaxed">{task.description}</p>
          )}

          {/* Progress */}
          <div>
            <div className="flex justify-between mb-1.5">
              <span className="text-xs text-gray-500">Progress</span>
              <span className="text-xs font-mono text-gray-400">{task.progress}%</span>
            </div>
            <div className="h-1.5 bg-surface-4 rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${task.progress}%`,
                  background: task.progress === 100 ? 'linear-gradient(90deg,#10b981,#34d399)' : 'linear-gradient(90deg,#7c6af7,#a78bfa)'
                }} />
            </div>
          </div>

          {/* Meta */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-surface-2 rounded-lg p-2.5">
              <p className="text-xs text-gray-600 mb-1">Priority</p>
              <span className="text-xs font-medium" style={{ color: PRIORITY_COLORS[task.priority] }}>
                {task.priority}
              </span>
            </div>
            <div className="bg-surface-2 rounded-lg p-2.5">
              <p className="text-xs text-gray-600 mb-1">Complexity</p>
              <span className="text-xs font-medium text-gray-300">{task.complexity}</span>
            </div>
          </div>

          {/* Assigned agent */}
          <div className="bg-surface-2 rounded-lg p-2.5">
            <p className="text-xs text-gray-600 mb-1.5">Assigned Agent</p>
            {assignedAgent ? (
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[10px] font-bold"
                  style={{ background: assignedAgent.color }}>
                  {assignedAgent.name[0]}
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-200">{assignedAgent.name}</p>
                  <p className="text-xs text-gray-600">{assignedAgent.role}</p>
                </div>
              </div>
            ) : (
              <span className="text-xs text-gray-600">Unassigned</span>
            )}
          </div>

          {/* Tags */}
          {tags.length > 0 && (
            <div>
              <p className="text-xs text-gray-600 mb-2 flex items-center gap-1"><Tag size={10} />Tags</p>
              <div className="flex flex-wrap gap-1.5">
                {tags.map(tag => (
                  <span key={tag} className="tag bg-surface-3 text-gray-400">{tag}</span>
                ))}
              </div>
            </div>
          )}

          {/* Move to column */}
          <div>
            <p className="text-xs text-gray-600 mb-2 flex items-center gap-1"><ArrowRight size={10} />Move to</p>
            <div className="flex flex-wrap gap-1.5">
              {columns.filter(c => c.id !== task.column_id).map(col => (
                <button key={col.id} onClick={() => handleMove(col.id)}
                  className="tag bg-surface-3 text-gray-400 hover:text-white hover:bg-surface-4 cursor-pointer transition-colors"
                  style={{ borderLeft: `2px solid ${col.color}` }}>
                  {col.name}
                </button>
              ))}
            </div>
          </div>

          {/* Timestamps */}
          <div className="text-xs text-gray-700 flex items-center gap-1">
            <Clock size={10} />
            Created {formatDistanceToNow(new Date(task.created_at), { addSuffix: true })}
          </div>
        </div>

        {/* Activity log */}
        {logs.length > 0 && (
          <div className="border-t border-border p-4">
            <p className="text-xs text-gray-600 mb-3 flex items-center gap-1"><Activity size={10} />Activity</p>
            <div className="space-y-2.5">
              {logs.map(log => (
                <div key={log.id} className="flex gap-2.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-surface-4 mt-1.5 shrink-0" />
                  <div>
                    <p className="text-xs text-gray-400">{log.message}</p>
                    <p className="text-[10px] text-gray-700 mt-0.5">
                      {log.agent_name || 'System'} · {formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
