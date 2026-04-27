import { useEffect, useState } from 'react';
import { DndContext, DragOverlay, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { RefreshCw, ChevronDown, ChevronRight, Archive, RotateCcw, Trash2 } from 'lucide-react';
import { useStore } from './store';
import Sidebar from './components/Sidebar';
import Column from './components/Column';
import TaskCard from './components/TaskCard';
import TaskDetail from './components/TaskDetail';
import NewTaskModal from './components/NewTaskModal';
import NewAgentModal from './components/NewAgentModal';
import EditAgentModal from './components/EditAgentModal';
import TemplatesModal from './components/TemplatesModal';

export default function App() {
  const { columns, tasks, loading, load, moveTask, selectedTask, showNewTask, showNewAgent, showTemplates, editingAgent, unarchiveColumn, deleteColumn } = useStore();
  const [dragging, setDragging] = useState(null);
  const [showArchivedCols, setShowArchivedCols] = useState(false);

  const activeColumns = columns.filter(c => !c.archived_at);
  const archivedColumns = columns.filter(c => !!c.archived_at);

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
      <div className="flex-1 flex flex-col overflow-hidden relative">
        {loading && (
          <div className="absolute top-3 right-4 z-10">
            <RefreshCw size={11} className="text-gray-600 animate-spin" />
          </div>
        )}
        {/* Board */}
        <DndContext sensors={sensors} collisionDetection={closestCenter}
          onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <div className="flex-1 overflow-x-auto overflow-y-hidden">
            <div className="flex flex-col h-full">
              <div className="flex gap-4 flex-1 overflow-y-hidden p-5 min-w-max">
                {activeColumns.map(col => (
                  <Column
                    key={col.id}
                    column={col}
                    tasks={tasks.filter(t => t.column_id === col.id)}
                  />
                ))}
              </div>
              {/* Archived columns strip */}
              {archivedColumns.length > 0 && (
                <div className="shrink-0 border-t border-border bg-surface-1/50 px-5 py-2">
                  <button
                    onClick={() => setShowArchivedCols(v => !v)}
                    className="flex items-center gap-2 text-xs text-gray-600 hover:text-gray-400 transition-colors"
                  >
                    {showArchivedCols ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
                    <Archive size={11} />
                    Archived columns ({archivedColumns.length})
                  </button>
                  {showArchivedCols && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {archivedColumns.map(col => (
                        <div key={col.id} className="flex items-center gap-2 px-3 py-1.5 bg-surface-2 border border-border rounded-lg opacity-60 hover:opacity-100 transition-opacity">
                          <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: col.color }} />
                          <span className="text-xs text-gray-400">{col.name}</span>
                          <span className="text-[10px] font-mono text-gray-600">{tasks.filter(t => t.column_id === col.id).length} tasks</span>
                          <button onClick={() => unarchiveColumn(col.id)} title="Restore column"
                            className="p-0.5 text-gray-600 hover:text-accent transition-colors">
                            <RotateCcw size={11} />
                          </button>
                          <button onClick={() => deleteColumn(col.id)} title="Delete column permanently"
                            className="p-0.5 text-gray-600 hover:text-red-400 transition-colors">
                            <Trash2 size={11} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
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
