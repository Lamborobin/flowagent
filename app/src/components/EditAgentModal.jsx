import { useState } from 'react';
import { X, Save, Trash2, Archive, LayoutTemplate, Check } from 'lucide-react';
import { useStore } from '../store';
import {
  useAgentForm,
  NameField, ModelField, ColorField,
  SystemPromptField, ContextFilesField, TemplatePromptField,
} from './AgentForm';
import { instructionsApi } from '../api';

export default function EditAgentModal() {
  const { editingAgent, updateAgent, deleteAgent, archiveAgent, saveAgentAsTemplate, agentTemplates, setEditingAgent } = useStore();
  const agent = editingAgent;

  const {
    form, set,
    availableFiles,
    newPrompt, setNewPromptField,
    editingTemplatePrompt, startEditingTemplatePrompt, resetTemplatePrompt,
    toggleInstructionFile, resolvePromptFile,
  } = useAgentForm({
    name: agent.name,
    role: agent.role,
    model: agent.model,
    description: agent.description || '',
    prompt_file: agent.prompt_file || '',
    instruction_files: agent.instruction_files || [],
    color: agent.color,
    is_template: agent.is_template || false,
    template_system_prompt: agent.template_system_prompt || '',
    system_prompt_override: agent.system_prompt_override ?? null,
    created_from_template_id: agent.created_from_template_id || null,
  });

  const [saving, setSaving] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [confirmingArchive, setConfirmingArchive] = useState(false);
  const [error, setError] = useState('');
  const [savingAsTemplate, setSavingAsTemplate] = useState(false);
  const [templateName, setTemplateName] = useState(agent.name);
  const [templateSaved, setTemplateSaved] = useState(false);
  const [showSaveAsTemplate, setShowSaveAsTemplate] = useState(false);

  // Check if agent was created from an archived template
  const originTemplate = agent.created_from_template_id
    ? agentTemplates.find(t => t.id === agent.created_from_template_id)
    : null;
  const originArchived = originTemplate?.archived_at;

  function close() { setEditingAgent(null); }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);
    setError('');
    try {
      const promptFilePath = await resolvePromptFile();
      const payload = {
        name: form.name.trim(),
        model: form.model,
        description: form.description,
        prompt_file: promptFilePath,
        instruction_files: form.instruction_files,
        color: form.color,
      };
      // Always send system_prompt_override for template agents so reset (null) is honoured
      if (form.is_template) {
        payload.system_prompt_override = form.system_prompt_override;
      }
      await updateAgent(agent.id, payload);
      close();
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to save agent');
    } finally {
      setSaving(false);
    }
  }

  async function handleArchiveAgent() {
    if (!confirmingArchive) { setConfirmingArchive(true); return; }
    await archiveAgent(agent.id);
    close();
  }

  async function handleDelete() {
    if (!confirming) { setConfirming(true); return; }
    try {
      await deleteAgent(agent.id);
      close();
    } catch (err) {
      setConfirming(false);
      if (err.response?.data?.has_dependencies) {
        setConfirmingArchive(true);
        setError(err.response.data.error);
      } else {
        setError(err.response?.data?.error || err.message || 'Failed to delete');
      }
    }
  }

  async function handleSaveAsTemplate() {
    if (!templateName.trim()) return;
    setSavingAsTemplate(true);
    try {
      // Read current prompt file content if available
      let system_prompt_content = '';
      if (form.prompt_file) {
        try {
          const resp = await instructionsApi.list();
          // We don't have a read endpoint — pass empty, user can edit in template manager
          system_prompt_content = '';
        } catch {}
      }
      await saveAgentAsTemplate(agent.id, { name: templateName.trim(), system_prompt_content });
      setTemplateSaved(true);
      setShowSaveAsTemplate(false);
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to save template');
    } finally {
      setSavingAsTemplate(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in"
         onClick={e => e.target === e.currentTarget && close()}>
      <div className="bg-surface-2 border border-border rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto animate-slide-in">
        <div className="flex items-center justify-between p-5 border-b border-border sticky top-0 bg-surface-2 z-10">
          <div>
            <h2 className="text-base font-semibold text-gray-100">Edit Agent</h2>
            <p className="text-[10px] font-mono text-gray-600 mt-0.5">role: {agent.role}</p>
          </div>
          <button onClick={close} className="btn-ghost p-1.5 rounded-lg">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Archived template warning */}
          {originArchived && (
            <div className="flex items-start gap-2 px-3 py-2.5 bg-amber-500/10 border border-amber-500/20 rounded-xl">
              <LayoutTemplate size={12} className="text-amber-400 shrink-0 mt-0.5" />
              <p className="text-[11px] text-amber-400 leading-relaxed">
                Created from template <span className="font-medium">{originTemplate.name}</span>, which has since been archived.
              </p>
            </div>
          )}

          {/* Name — no role generation in edit mode */}
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">Name *</label>
            <input
              value={form.name}
              onChange={e => set('name', e.target.value)}
              className="w-full bg-surface-3 border border-border rounded-lg px-3 py-2 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:border-accent transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">Description</label>
            <textarea
              value={form.description}
              onChange={e => set('description', e.target.value)}
              placeholder="What does this agent do?"
              rows={2}
              className="w-full bg-surface-3 border border-border rounded-lg px-3 py-2 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:border-accent transition-colors resize-none"
            />
          </div>

          <ModelField value={form.model} onChange={v => set('model', v)} />

          <TemplatePromptField
            form={form}
            editingTemplatePrompt={editingTemplatePrompt}
            onStartEdit={startEditingTemplatePrompt}
            onReset={resetTemplatePrompt}
            onChange={v => set('system_prompt_override', v)}
          />

          <SystemPromptField
            promptFile={form.prompt_file}
            onSelectFile={v => set('prompt_file', v)}
            availableFiles={availableFiles}
            newPrompt={newPrompt}
            setNewPromptField={setNewPromptField}
          />

          <ContextFilesField
            availableFiles={availableFiles}
            selectedFiles={form.instruction_files}
            onToggle={toggleInstructionFile}
            promptFile={form.prompt_file}
          />

          <ColorField value={form.color} onChange={v => set('color', v)} />

          {/* Save as template inline UI */}
          {showSaveAsTemplate ? (
            <div className="bg-surface-3 border border-accent/30 rounded-xl p-3 space-y-2.5">
              <p className="text-xs font-medium text-gray-300 flex items-center gap-1.5">
                <LayoutTemplate size={12} className="text-accent" />
                Save as template
              </p>
              <input
                value={templateName}
                onChange={e => setTemplateName(e.target.value)}
                placeholder="Template name"
                className="w-full bg-surface-1 border border-border rounded-lg px-3 py-2 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:border-accent transition-colors"
              />
              <p className="text-[10px] text-gray-600">Saves this agent's description, model, color, and context files. You can edit the system prompt content in the Templates manager.</p>
              <div className="flex gap-2">
                <button type="button" onClick={() => setShowSaveAsTemplate(false)}
                  className="btn-ghost flex-1 justify-center py-1.5 text-xs">
                  Cancel
                </button>
                <button type="button" onClick={handleSaveAsTemplate}
                  disabled={savingAsTemplate || !templateName.trim()}
                  className="btn-primary flex-1 justify-center py-1.5 text-xs disabled:opacity-40">
                  <Check size={12} />
                  {savingAsTemplate ? 'Saving...' : 'Save Template'}
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => { setShowSaveAsTemplate(true); setTemplateSaved(false); }}
              className={`w-full flex items-center justify-center gap-1.5 py-2 rounded-lg border text-xs transition-colors ${
                templateSaved
                  ? 'border-accent/40 text-accent bg-accent/5'
                  : 'border-dashed border-border text-gray-600 hover:text-accent hover:border-accent/40'
              }`}
            >
              <LayoutTemplate size={12} />
              {templateSaved ? 'Saved as template' : 'Save as template'}
            </button>
          )}

          {error && (
            <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>
          )}

          <div className="flex gap-2 pt-2 flex-wrap">
            <button
              type="button"
              onClick={handleArchiveAgent}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs transition-colors ${
                confirmingArchive
                  ? 'bg-amber-500/20 border border-amber-500/40 text-amber-400'
                  : 'btn-ghost text-gray-600 hover:text-amber-400'
              }`}
            >
              <Archive size={13} />
              {confirmingArchive ? 'Confirm archive?' : 'Archive'}
            </button>
            <button
              type="button"
              onClick={handleDelete}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs transition-colors ${
                confirming
                  ? 'bg-red-500/20 border border-red-500/40 text-red-400'
                  : 'btn-ghost text-gray-600 hover:text-red-400'
              }`}
            >
              <Trash2 size={13} />
              {confirming ? 'Confirm delete?' : 'Delete'}
            </button>
            <button type="button" onClick={close} className="btn-ghost flex-1 justify-center py-2">
              Cancel
            </button>
            <button type="submit" disabled={saving || !form.name.trim()}
              className="btn-primary flex-1 justify-center py-2 disabled:opacity-40">
              <Save size={14} />
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
