import { useEffect } from 'react';
import { DndContext, DragOverlay, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { Plus, RefreshCw } from 'lucide-react';
import { useStore } from './store';
import Sidebar from './components/Sidebar';
import Column from './components/Column';
import TaskCard from './components/TaskCard';
import TaskDetail from './components/TaskDetail';
import NewTaskModal from './components/NewTaskModal';
import NewAgentModal from './components/NewAgentModal';
import EditAgentModal from './components/EditAgentModal';
import TemplatesModal from './components/TemplatesModal';
import { useState } from 'react';

export default function App() {
  const { columns, tasks, loading, load, moveTask, selectedTask, showNewTask, showNewAgent, showTemplates, editingAgent, setShowNewTask } = useStore();
  const [dragging, setDragging] = useState(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  useEffect(() => { load(); }, []);

  // Poll for updates every 5s (agents may update tasks)
  useEffect(() => {
    const interval = setInterval(() => load(), 5000);
    return () => clearInterval(interval);
  }, []);

  function handleDragStart({ active }) {
    setDragging(tasks.find(t => t.id === active.id) || null);
  }

  async function handleDragEnd({ active, over }) {
    setDragging(null);
    if (!over || active.id === over.id) return;

    const targetColumnId = columns.find(c => c.id === over.id)?.id
      || tasks.find(t => t.id === over.id)?.column_id;

    if (targetColumnId) {
      const task = tasks.find(t => t.id === active.id);
      if (task?.column_id !== targetColumnId) {
        await moveTask(active.id, targetColumnId);
      }
    }
  }

  return (
    <div className="flex h-screen overflow-hidden bg-surface-0 font-sans">
      <Sidebar />

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Topbar */}
        <header className="flex items-center justify-between px-5 py-3 border-b border-border bg-surface-1 shrink-0">
          <div className="flex items-center gap-3">
            <h1 className="text-sm font-semibold text-gray-200">Kanban Board</h1>
            {loading && (
              <RefreshCw size={12} className="text-gray-600 animate-spin" />
            )}
          </div>
          <button onClick={() => setShowNewTask(true)} className="btn-primary text-xs px-3 py-1.5">
            <Plus size={13} />
            New Task
          </button>
        </header>

        {/* Board */}
        <DndContext sensors={sensors} collisionDetection={closestCenter}
          onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <div className="flex-1 overflow-x-auto overflow-y-hidden">
            <div className="flex gap-4 h-full p-5 min-w-max">
              {columns.map(col => (
                <Column
                  key={col.id}
                  column={col}
                  tasks={tasks.filter(t => t.column_id === col.id)}
                />
              ))}
            </div>
          </div>

          <DragOverlay>
            {dragging && <TaskCard task={dragging} />}
          </DragOverlay>
        </DndContext>
      </div>

      {/* Task detail panel */}
      {selectedTask && <TaskDetail />}

      {/* Modals */}
      {showNewTask && <NewTaskModal />}
      {showNewAgent && <NewAgentModal />}
      {editingAgent && <EditAgentModal />}
      {showTemplates && <TemplatesModal />}
    </div>
  );
}
