import { useEffect, useState, useRef } from 'react';
import { DndContext, DragOverlay, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, horizontalListSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import { RefreshCw, ChevronDown, ChevronRight, Archive, RotateCcw, Trash2, Plus, X, GripVertical } from 'lucide-react';
import { useStore } from './store';
import Sidebar from './components/Sidebar';
import Column, { taskZoneId } from './components/Column';
import TaskCard from './components/TaskCard';
import TaskDetail from './components/TaskDetail';
import NewTaskModal from './components/NewTaskModal';
import NewAgentModal from './components/NewAgentModal';
import EditAgentModal from './components/EditAgentModal';
import TemplatesModal from './components/TemplatesModal';
import SettingsPage from './components/SettingsPage';

const PRESET_COLORS = ['#6366f1','#3b82f6','#8b5cf6','#f59e0b','#10b981','#ef4444','#ec4899','#14b8a6','#f97316','#64748b'];

export default function App() {
  const { columns, tasks, loading, load, moveTask, selectedTask, showNewTask, showNewAgent, showTemplates, editingAgent, unarchiveColumn, deleteColumn, createColumn, updateColumn, reorderColumnsLocally, currentPage, theme } = useStore();
  const [dragging, setDragging] = useState(null);
  const [showArchivedCols, setShowArchivedCols] = useState(false);
  const [addingColumn, setAddingColumn] = useState(false);
  const [newColName, setNewColName] = useState('');
  const [newColColor, setNewColColor] = useState('#6366f1');
  const [addColError, setAddColError] = useState('');
  const newColInputRef = useRef(null);

  const activeColumns = columns.filter(c => !c.archived_at);
  const archivedColumns = columns.filter(c => !!c.archived_at);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  useEffect(() => { load(); }, []);

  // Apply persisted theme on mount
  useEffect(() => {
    document.documentElement.classList.toggle('light', theme === 'light');
  }, [theme]);

  // Poll for updates every 5s (agents may update tasks)
  useEffect(() => {
    const interval = setInterval(() => load(), 5000);
    return () => clearInterval(interval);
  }, []);

  function handleDragStart({ active }) {
    const col = activeColumns.find(c => c.id === active.id);
    if (col) {
      setDragging({ type: 'column', col });
    } else {
      setDragging({ type: 'task', task: tasks.find(t => t.id === active.id) || null });
    }
  }

  function openAddColumn() {
    setNewColName('');
    setNewColColor('#6366f1');
    setAddColError('');
    setAddingColumn(true);
    setTimeout(() => newColInputRef.current?.focus(), 50);
  }

  function cancelAddColumn() {
    setAddingColumn(false);
    setAddColError('');
  }

  async function submitAddColumn(e) {
    e?.preventDefault();
    const name = newColName.trim();
    if (!name) { setAddColError('Name is required'); return; }
    try {
      await createColumn({ name, color: newColColor });
      setAddingColumn(false);
      setNewColName('');
      setAddColError('');
    } catch (err) {
      setAddColError(err.response?.data?.error || 'Failed to create column');
    }
  }

  async function handleDragEnd({ active, over }) {
    setDragging(null);
    if (!over || active.id === over.id) return;

    // Column reorder
    const isDraggingColumn = activeColumns.some(c => c.id === active.id);
    if (isDraggingColumn) {
      // over.id may be a column id, a zone:colId, or a task id inside a column
      let overColId = over.id;
      if (over.id.startsWith('zone:')) {
        overColId = over.id.slice(5);
      } else if (!activeColumns.some(c => c.id === over.id)) {
        // it's a task id — resolve to its column
        overColId = tasks.find(t => t.id === over.id)?.column_id ?? over.id;
      }

      const oldIndex = activeColumns.findIndex(c => c.id === active.id);
      const newIndex = activeColumns.findIndex(c => c.id === overColId);
      if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return;

      const reordered = arrayMove(activeColumns, oldIndex, newIndex);
      reorderColumnsLocally(reordered.map(c => c.id));

      await Promise.all(
        reordered.map((col, idx) =>
          col.position !== idx ? updateColumn(col.id, { position: idx }).catch(() => {}) : null
        ).filter(Boolean)
      );
      return;
    }

    // Task move — over.id may be a zone:colId, a column id, or another task id
    let targetColumnId;
    if (over.id.startsWith('zone:')) {
      targetColumnId = over.id.slice(5);
    } else {
      targetColumnId = columns.find(c => c.id === over.id)?.id
        || tasks.find(t => t.id === over.id)?.column_id;
    }

    if (targetColumnId) {
      const task = tasks.find(t => t.id === active.id);
      if (task?.column_id !== targetColumnId) {
        await moveTask(active.id, targetColumnId);
      }
    }
  }

  if (currentPage === 'settings') {
    return <SettingsPage />;
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
                <SortableContext items={activeColumns.map(c => c.id)} strategy={horizontalListSortingStrategy}>
                  {activeColumns.map(col => (
                    <Column
                      key={col.id}
                      column={col}
                      tasks={tasks.filter(t => t.column_id === col.id)}
                    />
                  ))}
                </SortableContext>
                {/* Add Column — outside SortableContext so it's never a drag target */}
                {addingColumn ? (
                  <div className="flex flex-col w-72 shrink-0">
                    <form onSubmit={submitAddColumn} className="bg-surface-2 border border-border rounded-xl p-3 flex flex-col gap-2.5">
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-[10px] font-medium text-gray-500 uppercase tracking-wide">New Column</span>
                        <button type="button" onClick={cancelAddColumn} className="text-gray-600 hover:text-gray-400 p-0.5">
                          <X size={11} />
                        </button>
                      </div>
                      <input
                        ref={newColInputRef}
                        value={newColName}
                        onChange={e => { setNewColName(e.target.value); setAddColError(''); }}
                        onKeyDown={e => e.key === 'Escape' && cancelAddColumn()}
                        placeholder="Column name"
                        className="w-full bg-surface-3 border border-border rounded-lg px-2.5 py-1.5 text-sm text-gray-200 placeholder-gray-600 outline-none focus:border-accent/50 transition-colors"
                      />
                      <div className="flex flex-wrap gap-1.5">
                        {PRESET_COLORS.map(c => (
                          <button
                            key={c}
                            type="button"
                            onClick={() => setNewColColor(c)}
                            className={`w-5 h-5 rounded-full transition-all ${newColColor === c ? 'ring-2 ring-offset-1 ring-offset-surface-2 ring-white/60 scale-110' : 'opacity-60 hover:opacity-100'}`}
                            style={{ background: c }}
                          />
                        ))}
                      </div>
                      {addColError && (
                        <p className="text-[10px] text-red-400">{addColError}</p>
                      )}
                      <button
                        type="submit"
                        className="w-full py-1.5 text-xs font-medium text-white bg-accent hover:bg-accent/80 rounded-lg transition-colors"
                      >
                        Add Column
                      </button>
                    </form>
                  </div>
                ) : (
                  <div className="flex flex-col w-16 shrink-0 justify-start pt-0">
                    <button
                      onClick={openAddColumn}
                      className="flex flex-col items-center justify-center gap-1.5 h-16 w-16 rounded-xl border border-dashed border-border text-gray-700 hover:text-gray-400 hover:border-gray-500 transition-colors"
                      title="Add column"
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                )}
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
            {dragging?.type === 'task' && dragging.task && <TaskCard task={dragging.task} />}
            {dragging?.type === 'column' && (
              <div className="flex items-center gap-2 px-3 py-2 bg-surface-2 border border-border rounded-xl shadow-2xl opacity-90 w-72">
                <GripVertical size={13} className="text-gray-500" />
                <div className="w-2 h-2 rounded-full shrink-0" style={{ background: dragging.col.color }} />
                <span className="text-sm font-semibold text-gray-200">{dragging.col.name}</span>
                <span className="text-xs font-mono text-gray-600 bg-surface-3 px-1.5 py-0.5 rounded-md ml-auto">
                  {tasks.filter(t => t.column_id === dragging.col.id).length}
                </span>
              </div>
            )}
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
