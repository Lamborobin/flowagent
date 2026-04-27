import { useState, useEffect } from 'react';
import { FileText, Plus, RotateCcw, Lock, Unlock } from 'lucide-react';
import { instructionsApi } from '../api';

export const MODELS = [
  { value: 'claude-opus-4-5',          label: 'Opus 4.5 — most capable' },
  { value: 'claude-sonnet-4-5',        label: 'Sonnet 4.5 — balanced' },
  { value: 'claude-haiku-4-5-20251001',label: 'Haiku 4.5 — fastest' },
];

export const COLORS = [
  '#6366f1','#3b82f6','#8b5cf6','#ec4899',
  '#10b981','#f59e0b','#ef4444','#06b6d4',
];

export function displayName(filePath) {
  return filePath.replace(/^instructions\//, '').replace(/\.md$/, '');
}

export function slugify(str) {
  return str.trim().toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

export function sanitizeFileName(str) {
  return str.trim().toLowerCase()
    .replace(/\.md$/i, '')
    .replace(/[^a-z0-9_-]+/g, '_')
    .replace(/_{2,}/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 100);
}

export function useAgentForm(initial = {}) {
  const [form, setForm] = useState({
    name: '',
    model: 'claude-sonnet-4-5',
    description: '',
    prompt_file: '',
    instruction_files: [],
    color: '#6366f1',
    is_template: false,
    template_system_prompt: '',
    system_prompt_override: null,
    created_from_template_id: null,
    ...initial,
  });
  const [generatedRole, setGeneratedRole] = useState(initial.role || '');
  const [availableFiles, setAvailableFiles] = useState([]);
  const [newPrompt, setNewPrompt] = useState({ active: false, name: '', content: '' });
  // Whether the user is currently editing the template prompt
  const [editingTemplatePrompt, setEditingTemplatePrompt] = useState(
    initial.system_prompt_override != null
  );

  useEffect(() => {
    instructionsApi.list().then(setAvailableFiles).catch(() => {});
  }, []);

  function handleNameChange(name) {
    setForm(f => ({ ...f, name }));
    if (!initial.role) setGeneratedRole(slugify(name));
  }

  function set(k, v) { setForm(f => ({ ...f, [k]: v })); }

  function toggleInstructionFile(filePath) {
    setForm(f => ({
      ...f,
      instruction_files: f.instruction_files.includes(filePath)
        ? f.instruction_files.filter(p => p !== filePath)
        : [...f.instruction_files, filePath],
    }));
  }

  function setNewPromptField(k, v) {
    setNewPrompt(p => ({ ...p, [k]: v }));
  }

  function startEditingTemplatePrompt() {
    // Copy template default into override so user edits from a real starting point
    if (form.system_prompt_override == null) {
      set('system_prompt_override', form.template_system_prompt);
    }
    setEditingTemplatePrompt(true);
  }

  function resetTemplatePrompt() {
    set('system_prompt_override', null);
    setEditingTemplatePrompt(false);
  }

  async function resolvePromptFile() {
    if (newPrompt.active && newPrompt.name.trim()) {
      const safeName = sanitizeFileName(newPrompt.name);
      if (!safeName) throw new Error('Invalid system prompt file name');
      const result = await instructionsApi.create({ name: safeName, content: newPrompt.content });
      instructionsApi.list().then(setAvailableFiles).catch(() => {});
      return result.path;
    }
    return form.prompt_file || undefined;
  }

  return {
    form, set, generatedRole,
    availableFiles,
    newPrompt, setNewPromptField,
    editingTemplatePrompt, startEditingTemplatePrompt, resetTemplatePrompt,
    handleNameChange, toggleInstructionFile, resolvePromptFile,
  };
}

// ── Reusable field components ─────────────────────────────────────────────────

export function NameField({ value, onChange, generatedRole, roleConflict }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-400 mb-1.5">Name *</label>
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder="QA Engineer"
        className="w-full bg-surface-3 border border-border rounded-lg px-3 py-2 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:border-accent transition-colors"
      />
      {generatedRole && (
        <p className={`mt-1 text-[10px] font-mono ${roleConflict ? 'text-red-400' : 'text-gray-600'}`}>
          role: {generatedRole}{roleConflict ? ' — already taken' : ''}
        </p>
      )}
    </div>
  );
}

export function ModelField({ value, onChange }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-400 mb-1.5">Model</label>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full bg-surface-3 border border-border rounded-lg px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-accent"
      >
        {MODELS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
      </select>
    </div>
  );
}

export function ColorField({ value, onChange }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-400 mb-2">Color</label>
      <div className="flex gap-2">
        {COLORS.map(c => (
          <button key={c} type="button" onClick={() => onChange(c)}
            className="w-6 h-6 rounded-full transition-transform hover:scale-110"
            style={{ background: c, outline: value === c ? '2px solid white' : 'none', outlineOffset: '2px' }}
          />
        ))}
      </div>
    </div>
  );
}

export function SystemPromptField({ promptFile, onSelectFile, availableFiles, newPrompt, setNewPromptField }) {
  const showCreate = newPrompt.active;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-xs font-medium text-gray-400">System Prompt File</label>
        <button
          type="button"
          onClick={() => setNewPromptField('active', !showCreate)}
          className={`text-[10px] flex items-center gap-1 transition-colors ${
            showCreate ? 'text-accent' : 'text-gray-600 hover:text-gray-400'
          }`}
        >
          <Plus size={10} />
          {showCreate ? 'Cancel' : 'Create new'}
        </button>
      </div>

      {showCreate ? (
        <div className="space-y-2 bg-surface-3 border border-accent/30 rounded-xl p-3">
          <div>
            <label className="block text-[10px] text-gray-500 mb-1">File name (max 100 chars)</label>
            <div className="flex items-center gap-1.5">
              <input
                value={newPrompt.name}
                onChange={e => setNewPromptField('name', e.target.value)}
                placeholder="my_pm_agent"
                maxLength={100}
                className="flex-1 bg-surface-1 border border-border rounded-lg px-3 py-1.5 text-xs font-mono text-gray-100 placeholder-gray-600 focus:outline-none focus:border-accent transition-colors"
              />
              <span className="text-[10px] text-gray-600 shrink-0">.md</span>
            </div>
            {newPrompt.name && (
              <p className="mt-0.5 text-[10px] font-mono text-gray-600">
                → instructions/{sanitizeFileName(newPrompt.name) || '…'}.md
              </p>
            )}
          </div>
          <div>
            <label className="block text-[10px] text-gray-500 mb-1">Content (Markdown)</label>
            <textarea
              value={newPrompt.content}
              onChange={e => setNewPromptField('content', e.target.value)}
              placeholder={`# My Agent\n\nYou are...`}
              rows={8}
              className="w-full bg-surface-1 border border-border rounded-lg px-3 py-2 text-xs font-mono text-gray-100 placeholder-gray-600 focus:outline-none focus:border-accent transition-colors resize-y"
            />
          </div>
        </div>
      ) : (
        <div>
          <p className="text-[10px] text-gray-600 mb-1.5">Select an existing file from instructions/</p>
          {availableFiles.length > 0 ? (
            <select
              value={promptFile}
              onChange={e => onSelectFile(e.target.value)}
              className="w-full bg-surface-3 border border-border rounded-lg px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-accent"
            >
              <option value="">— none —</option>
              {availableFiles.map(f => (
                <option key={f.path} value={f.path}>{displayName(f.path)}</option>
              ))}
            </select>
          ) : (
            <p className="text-[10px] text-gray-600 italic">No instruction files found. Create one above.</p>
          )}
        </div>
      )}
    </div>
  );
}

export function TemplatePromptField({ form, editingTemplatePrompt, onStartEdit, onReset, onChange }) {
  if (!form.is_template && !form.created_from_template_id) return null;

  const isCustomized = form.system_prompt_override != null;
  const displayValue = isCustomized ? form.system_prompt_override : form.template_system_prompt;

  return (
    <div className="space-y-2">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-gray-400">Template Behaviour Prompt</label>
          <span className="text-[9px] font-medium px-1.5 py-0.5 rounded-full bg-accent/15 text-accent border border-accent/25 uppercase tracking-wide">
            Template
          </span>
        </div>
        {isCustomized ? (
          <button
            type="button"
            onClick={onReset}
            className="text-[10px] flex items-center gap-1 text-amber-400 hover:text-amber-300 transition-colors"
          >
            <RotateCcw size={10} />
            Reset to default
          </button>
        ) : (
          <button
            type="button"
            onClick={onStartEdit}
            className="text-[10px] flex items-center gap-1 text-gray-600 hover:text-gray-400 transition-colors"
          >
            <Unlock size={10} />
            Customize
          </button>
        )}
      </div>

      {/* Description */}
      <p className="text-[10px] text-gray-600">
        {isCustomized
          ? 'You have customized this template prompt. It overrides the default for this agent only.'
          : 'Behavioural framework injected from the template. Combined with the system prompt file when calling the AI.'}
      </p>

      {/* Prompt textarea */}
      <div className={`relative rounded-xl border ${isCustomized ? 'border-amber-500/30' : 'border-border'}`}>
        {!isCustomized && (
          <div className="absolute top-2 right-2 flex items-center gap-1 text-[9px] text-gray-600">
            <Lock size={9} />
            default
          </div>
        )}
        <textarea
          value={displayValue || ''}
          onChange={e => isCustomized && onChange(e.target.value)}
          readOnly={!isCustomized}
          rows={10}
          className={`w-full rounded-xl px-3 py-2.5 text-[11px] font-mono leading-relaxed focus:outline-none transition-colors resize-y ${
            isCustomized
              ? 'bg-surface-3 text-gray-200 focus:border-amber-500/50'
              : 'bg-surface-1 text-gray-500 cursor-default select-none'
          }`}
        />
      </div>
    </div>
  );
}

export function ContextFilesField({ availableFiles, selectedFiles, onToggle, promptFile }) {
  const contextOptions = availableFiles.filter(f => f.path !== promptFile);
  if (contextOptions.length === 0) return null;

  return (
    <div>
      <label className="block text-xs font-medium text-gray-400 mb-1">Context Files</label>
      <p className="text-[10px] text-gray-600 mb-2">
        Loaded as additional context. <span className="font-mono">CLAUDE.md</span> and <span className="font-mono">README.md</span> are always included.
      </p>
      <div className="space-y-1.5 bg-surface-3 border border-border rounded-lg p-3">
        {contextOptions.map(f => (
          <label key={f.path} className="flex items-center gap-2.5 cursor-pointer group">
            <div
              onClick={() => onToggle(f.path)}
              className={`w-4 h-4 rounded border flex items-center justify-center transition-colors shrink-0 ${
                selectedFiles.includes(f.path)
                  ? 'bg-accent border-accent'
                  : 'border-border bg-surface-1 group-hover:border-accent/50'
              }`}
            >
              {selectedFiles.includes(f.path) && (
                <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 12 12">
                  <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              )}
            </div>
            <FileText size={11} className="text-gray-600 shrink-0" />
            <span className="text-xs text-gray-400 group-hover:text-gray-300">{displayName(f.path)}</span>
          </label>
        ))}
      </div>
    </div>
  );
}
