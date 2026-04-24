import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { AlertTriangle, Clock, User, ChevronRight } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useStore } from '../store';

const PRIORITY_STYLES = {
  critical: 'bg-red-500/15 text-red-400 border border-red-500/20',
  high:     'bg-orange-500/15 text-orange-400 border border-orange-500/20',
  medium:   'bg-blue-500/15 text-blue-400 border border-blue-500/20',
  low:      'bg-gray-500/15 text-gray-400 border border-gray-500/20',
};

export default function TaskCard({ task }) {
  const { agents, setSelectedTask } = useStore();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  const assignedAgent = agents.find(a => a.id === task.assigned_agent_id);
  const tags = Array.isArray(task.tags) ? task.tags : [];

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={() => setSelectedTask(task)}
      className="group bg-surface-2 border border-border rounded-xl p-3.5 cursor-pointer
                 hover:border-accent/40 hover:bg-surface-3 transition-all duration-150
                 animate-slide-in select-none"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <span className="text-sm font-medium text-gray-100 leading-snug line-clamp-2 flex-1">
          {task.title}
        </span>
        {task.requires_human_action === 1 && (
          <AlertTriangle size={14} className="text-amber-400 shrink-0 mt-0.5" />
        )}
      </div>

      {/* Description */}
      {task.description && (
        <p className="text-xs text-gray-500 line-clamp-2 mb-3 leading-relaxed">
          {task.description}
        </p>
      )}

      {/* Progress */}
      {task.progress > 0 && (
        <div className="mb-3">
          <div className="flex justify-between items-center mb-1">
            <span className="text-xs text-gray-500">Progress</span>
            <span className="text-xs font-mono text-gray-400">{task.progress}%</span>
          </div>
          <div className="h-1 bg-surface-4 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${task.progress}%`,
                background: task.progress === 100
                  ? 'linear-gradient(90deg, #10b981, #34d399)'
                  : 'linear-gradient(90deg, #7c6af7, #a78bfa)'
              }}
            />
          </div>
        </div>
      )}

      {/* Tags */}
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-3">
          {tags.slice(0, 3).map(tag => (
            <span key={tag} className="tag bg-surface-4 text-gray-400">{tag}</span>
          ))}
          {tags.length > 3 && (
            <span className="tag bg-surface-4 text-gray-500">+{tags.length - 3}</span>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className={`tag ${PRIORITY_STYLES[task.priority] || PRIORITY_STYLES.medium}`}>
            {task.priority}
          </span>
        </div>

        <div className="flex items-center gap-2 text-xs text-gray-600">
          {assignedAgent && (
            <span className="flex items-center gap-1">
              <div className="w-4 h-4 rounded-full flex items-center justify-center text-white text-[9px] font-bold"
                   style={{ background: assignedAgent.color }}>
                {assignedAgent.name[0]}
              </div>
            </span>
          )}
          <span className="flex items-center gap-1">
            <Clock size={10} />
            {formatDistanceToNow(new Date(task.created_at), { addSuffix: true })}
          </span>
        </div>
      </div>

      <ChevronRight size={12} className="absolute right-3 bottom-3 text-gray-700 opacity-0 group-hover:opacity-100 transition-opacity" />
    </div>
  );
}
