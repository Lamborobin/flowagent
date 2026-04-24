import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Plus } from 'lucide-react';
import TaskCard from './TaskCard';
import { useStore } from '../store';

export default function Column({ column, tasks }) {
  const { setShowNewTask } = useStore();
  const { setNodeRef, isOver } = useDroppable({ id: column.id });

  return (
    <div className="flex flex-col w-72 shrink-0">
      {/* Column header */}
      <div className="flex items-center justify-between px-1 mb-3">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ background: column.color }} />
          <h3 className="text-sm font-semibold text-gray-200">{column.name}</h3>
          <span className="text-xs font-mono text-gray-600 bg-surface-3 px-1.5 py-0.5 rounded-md">
            {tasks.length}
          </span>
        </div>
        {column.id === 'col_backlog' && (
          <button
            onClick={() => setShowNewTask(true)}
            className="p-1 rounded-lg text-gray-600 hover:text-gray-300 hover:bg-surface-3 transition-colors"
          >
            <Plus size={14} />
          </button>
        )}
      </div>

      {/* Drop zone */}
      <div
        ref={setNodeRef}
        className={`flex-1 min-h-24 rounded-xl p-2 transition-colors duration-150 flex flex-col gap-2
          ${isOver ? 'bg-accent/5 border border-accent/20' : 'bg-surface-1/50 border border-transparent'}`}
      >
        <SortableContext items={tasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
          {tasks.map(task => (
            <TaskCard key={task.id} task={task} />
          ))}
        </SortableContext>

        {tasks.length === 0 && (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-xs text-gray-700 font-mono">empty</p>
          </div>
        )}
      </div>
    </div>
  );
}
