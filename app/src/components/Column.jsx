import { useState } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Plus, Archive, Trash2, MoreHorizontal, X } from 'lucide-react';
import TaskCard from './TaskCard';
import { useStore } from '../store';

export default function Column({ column, tasks }) {
  const { setShowNewTask, archiveColumn, deleteColumn } = useStore();
  const { setNodeRef, isOver } = useDroppable({ id: column.id });
  const [showMenu, setShowMenu] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [error, setError] = useState('');

  async function handleArchive() {
    if (!confirmArchive) { setConfirmArchive(true); setConfirmDelete(false); return; }
    setShowMenu(false);
    setConfirmArchive(false);
    await archiveColumn(column.id);
  }

  async function handleDelete() {
    if (!confirmDelete) { setConfirmDelete(true); setConfirmArchive(false); return; }
    setShowMenu(false);
    setConfirmDelete(false);
    try {
      await deleteColumn(column.id);
    } catch (err) {
      if (err.response?.data?.has_dependencies) {
        setError(err.response.data.error);
        setConfirmArchive(true);
      } else {
        setError(err.response?.data?.error || 'Failed to delete');
      }
    }
  }

  function closeMenu() {
    setShowMenu(false);
    setConfirmDelete(false);
    setConfirmArchive(false);
    setError('');
  }

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
        <div className="flex items-center gap-0.5">
          {column.id === 'col_backlog' && (
            <button
              onClick={() => setShowNewTask(true)}
              className="p-1 rounded-lg text-gray-600 hover:text-gray-300 hover:bg-surface-3 transition-colors"
            >
              <Plus size={14} />
            </button>
          )}
          <div className="relative">
            <button
              onClick={() => { setShowMenu(v => !v); setConfirmDelete(false); setConfirmArchive(false); setError(''); }}
              className="p-1 rounded-lg text-gray-700 hover:text-gray-400 hover:bg-surface-3 transition-colors"
            >
              <MoreHorizontal size={13} />
            </button>
            {showMenu && (
              <div className="absolute right-0 top-7 z-20 bg-surface-2 border border-border rounded-xl shadow-xl py-1.5 min-w-[160px]">
                <div className="flex items-center justify-between px-3 py-1 mb-1 border-b border-border">
                  <span className="text-[10px] font-medium text-gray-500 uppercase tracking-wide">Column</span>
                  <button onClick={closeMenu} className="text-gray-600 hover:text-gray-400 p-0.5">
                    <X size={10} />
                  </button>
                </div>
                {error && (
                  <p className="mx-2 mb-1 px-2 py-1.5 text-[10px] text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg leading-relaxed">{error}</p>
                )}
                <button
                  onClick={handleArchive}
                  className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs transition-colors ${
                    confirmArchive
                      ? 'text-amber-300 bg-amber-500/10'
                      : 'text-gray-400 hover:text-amber-400 hover:bg-surface-3'
                  }`}
                >
                  <Archive size={11} />
                  {confirmArchive ? 'Confirm archive?' : 'Archive'}
                </button>
                <button
                  onClick={handleDelete}
                  className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs transition-colors ${
                    confirmDelete
                      ? 'text-red-300 bg-red-500/10'
                      : 'text-gray-400 hover:text-red-400 hover:bg-surface-3'
                  }`}
                >
                  <Trash2 size={11} />
                  {confirmDelete ? 'Confirm delete?' : 'Delete'}
                </button>
              </div>
            )}
          </div>
        </div>
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
