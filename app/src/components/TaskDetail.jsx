import { useState, useEffect, useRef } from 'react';
import { X, Trash2, ArrowRight, Clock, Tag, Activity, Lock, Unlock, Archive, Plus, CheckCircle2, Circle, Pencil, Check } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useStore } from '../store';
import { tasksApi } from '../api';

const PRIORITY_COLORS = {
  critical: '#ef4444', high: '#f97316', medium: '#3b82f6', low: '#6b7280'
};
const PRIORITIES = ['low', 'medium', 'high', 'critical'];
const COMPLEXITIES = ['low', 'medium', 'high'];

export default function TaskDetail() {
  const { selectedTask, setSelectedTask, setShowNewTask, columns, agents, moveTask, deleteTask, updateTask, archiveTask, bypassPm } = useStore();
  const [task, setTask] = useState(null);
  const [logs, setLogs] = useState([]);

  // Editing state
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');
  const [editingDescription, setEditingDescription] = useState(false);
  const [descriptionDraft, setDescriptionDraft] = useState('');
  const [editingCriteria, setEditingCriteria] = useState(false);
  const [criteriaDraft, setCriteriaDraft] = useState('');

  // Planning history accordion (collapsed by default after approval)
  const [showPlanningHistory, setShowPlanningHistory] = useState(false);

  // Interaction state
  const [approvingHuman, setApprovingHuman] = useState(false);
  const [approvalComment, setApprovalComment] = useState('');
  const [answerText, setAnswerText] = useState('');
  const [agentThinking, setAgentThinking] = useState(false);
  const [confirmBypass, setConfirmBypass] = useState(false);
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const titleRef = useRef(null);
  const descRef = useRef(null);

  useEffect(() => {
    if (!selectedTask) return;
    setAgentThinking(false);
    setConfirmBypass(false);
    setConfirmArchive(false);
    setConfirmDelete(false);
    setAnswerText('');
    setEditingTitle(false);
    setEditingDescription(false);
    setEditingCriteria(false);
    tasksApi.get(selectedTask.id).then(t => {
      setTask(t);
      setLogs(t.logs || []);
      setTitleDraft(t.title || '');
      setDescriptionDraft(t.description || '');
      setCriteriaDraft(t.acceptance_criteria || '');

      // Auto-start polling if PM is already running when the panel opens:
      // 'pending' = PM triggered but hasn't responded yet
      // 'questioning' with no pending question = human answered, PM is re-evaluating
      const pmIsProcessing =
        (t.pm_approval_status === 'pending' && !t.pm_pending_question) ||
        (t.pm_approval_status === 'questioning' && !t.pm_pending_question);
      if (pmIsProcessing) setAgentThinking(true);
    });
  }, [selectedTask?.id]);

  // Focus input when editing starts
  useEffect(() => { if (editingTitle && titleRef.current) titleRef.current.focus(); }, [editingTitle]);
  useEffect(() => { if (editingDescription && descRef.current) descRef.current.focus(); }, [editingDescription]);

  // Poll while agent is thinking — stop when PM posts a question or approves
  useEffect(() => {
    if (!agentThinking || !selectedTask) return;
    let cancelled = false;

    const poll = async () => {
      if (cancelled) return;
      try {
        const fresh = await tasksApi.get(selectedTask.id);
        if (cancelled) return;
        // PM is done processing when it has asked a question or approved the task
        const pmFinished = !!fresh.pm_pending_question || fresh.pm_approval_status === 'approved';
        if (pmFinished) {
          setTask(fresh);
          setLogs(fresh.logs || []);
          setAgentThinking(false);
        } else {
          setTimeout(poll, 2000);
        }
      } catch {
        if (!cancelled) setTimeout(poll, 3000);
      }
    };
    setTimeout(poll, 2000);
    return () => { cancelled = true; };
  }, [agentThinking, selectedTask?.id]);

  if (!selectedTask) return null;
  if (!task) return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center">
      <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
    </div>
  );

  const tags = Array.isArray(task.tags) ? task.tags : [];
  const isLocked = task.is_locked;
  const checklist = Array.isArray(task.pm_checklist) ? task.pm_checklist : [];
  const isPmPlanning = task.column_id === 'col_backlog' && task.assigned_agent_id === 'agent_pm';
  const hasPendingQuestion = !!task.pm_pending_question;

  // Build conversation thread — exclude the latest pm_question when it's pending
  // (it's already shown as the active prompt in the answer input section below)
  const rawConversationLogs = logs.filter(l => ['pm_question', 'human_answer', 'pm_reviewed'].includes(l.action));
  const conversationLogs = hasPendingQuestion
    ? rawConversationLogs.slice(0, -1)
    : rawConversationLogs;
  const pmDone = task.pm_approval_status === 'approved';
  const fullyReady = pmDone && task.human_approval_status === 'approved';

  const resolvedCount = checklist.filter(i => i.resolved).length;
  const allItemsChecked = checklist.length > 0 && resolvedCount === checklist.length;
  const checklistProgress = checklist.length > 0 ? (resolvedCount / checklist.length) * 100 : 0;

  // Bypass: show when all items are checked but PM is still not satisfied
  const showBypass = isPmPlanning && !fullyReady && allItemsChecked && !pmDone;

  // ── Field save handlers ──────────────────────────────────────────────────

  async function saveTitle() {
    const v = titleDraft.trim();
    if (!v || v === task.title) { setEditingTitle(false); return; }
    const updated = await tasksApi.update(task.id, { title: v });
    setTask(t => ({ ...t, title: updated.title }));
    setEditingTitle(false);
  }

  async function saveDescription() {
    const v = descriptionDraft.trim();
    if (v === (task.description || '')) { setEditingDescription(false); return; }
    await tasksApi.update(task.id, { description: v || null });
    setTask(t => ({ ...t, description: v || null }));
    setEditingDescription(false);
  }

  async function saveCriteria() {
    const v = criteriaDraft.trim();
    if (v === (task.acceptance_criteria || '')) { setEditingCriteria(false); return; }
    await tasksApi.update(task.id, { acceptance_criteria: v || null });
    setTask(t => ({ ...t, acceptance_criteria: v || null }));
    setEditingCriteria(false);
  }

  async function handlePriorityChange(value) {
    await tasksApi.update(task.id, { priority: value });
    setTask(t => ({ ...t, priority: value }));
  }

  async function handleComplexityChange(value) {
    await tasksApi.update(task.id, { complexity: value });
    setTask(t => ({ ...t, complexity: value }));
  }

  async function handleChecklistToggle(index) {
    // Optimistic update
    const nextChecklist = checklist.map((item, i) =>
      i === index ? { ...item, resolved: !item.resolved } : item
    );
    setTask(t => ({ ...t, pm_checklist: nextChecklist }));

    const updated = await tasksApi.toggleChecklistItem(task.id, index);
    setTask(t => ({ ...t, pm_checklist: updated.pm_checklist || nextChecklist }));

    // PM will re-evaluate — start polling
    if (task.pm_approval_status && task.pm_approval_status !== 'approved' && !hasPendingQuestion) {
      setAgentThinking(true);
    }
  }

  // ── Other handlers ───────────────────────────────────────────────────────

  async function handleMove(columnId) {
    try {
      await moveTask(task.id, columnId);
      setTask(t => ({ ...t, column_id: columnId, is_locked: false }));
    } catch (err) {
      alert(err.response?.data?.error || 'Cannot move task');
    }
  }

  async function handleDelete() {
    if (!confirmDelete) { setConfirmDelete(true); return; }
    try {
      await deleteTask(task.id);
    } catch (err) {
      setConfirmDelete(false);
      if (err.response?.data?.has_dependencies) {
        setConfirmArchive(true);
        alert(err.response.data.error);
      }
    }
  }

  async function handleArchive() {
    if (!confirmArchive) { setConfirmArchive(true); return; }
    await archiveTask(task.id);
    setSelectedTask(null);
  }

  async function handleBypass() {
    if (!confirmBypass) { setConfirmBypass(true); return; }
    const updated = await bypassPm(task.id);
    setTask(updated);
    setConfirmBypass(false);
  }

  async function handleAnswer() {
    if (!answerText.trim()) return;
    const text = answerText.trim();
    setAnswerText('');
    await tasksApi.answer(task.id, { answer: text });
    const tempLog = {
      id: `temp-${Date.now()}`, action: 'human_answer', message: text,
      created_at: new Date().toISOString().replace('T', ' ').replace('Z', ''), agent_name: 'You'
    };
    setLogs(prev => [...prev, tempLog]);
    setTask(t => ({ ...t, pm_pending_question: null, pm_approval_status: 'questioning' }));
    setAgentThinking(true);
  }

  async function handleApprove() {
    const updated = await tasksApi.approve(task.id, { comment: approvalComment || null });
    setTask({ ...updated, is_locked: false });
    setApprovalComment('');
    setApprovingHuman(false);
  }

  async function handleReject() {
    if (!approvalComment.trim()) { alert('Please provide a reason for rejection'); return; }
    const updated = await tasksApi.reject(task.id, { comment: approvalComment });
    setTask(updated);
    setApprovalComment('');
    setApprovingHuman(false);
  }

  async function handleAgentChange(agentId) {
    await updateTask(task.id, { assigned_agent_id: agentId || null });
    setTask(t => ({ ...t, assigned_agent_id: agentId || null }));
  }

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in"
      onClick={e => e.target === e.currentTarget && setSelectedTask(null)}
    >
      <div className="bg-surface-1 border border-border rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col animate-slide-in overflow-hidden">

        {/* Header — editable title */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0 gap-3">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {isLocked && <Lock size={13} className="text-amber-400 shrink-0" />}
            {editingTitle ? (
              <input
                ref={titleRef}
                value={titleDraft}
                onChange={e => setTitleDraft(e.target.value)}
                onBlur={saveTitle}
                onKeyDown={e => { if (e.key === 'Enter') saveTitle(); if (e.key === 'Escape') setEditingTitle(false); }}
                className="flex-1 text-sm font-semibold bg-surface-3 border border-accent rounded px-2 py-0.5 text-gray-200 focus:outline-none"
              />
            ) : (
              <button
                onClick={() => { setTitleDraft(task.title || ''); setEditingTitle(true); }}
                className="text-sm font-semibold text-gray-200 text-left truncate hover:text-white group flex items-center gap-1.5 min-w-0"
                title="Click to edit title"
              >
                <span className="truncate">{task.title}</span>
                <Pencil size={11} className="shrink-0 opacity-0 group-hover:opacity-40 transition-opacity" />
              </button>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={handleArchive}
              title={confirmArchive ? 'Click again to confirm' : 'Archive task'}
              className={`p-1.5 rounded-lg transition-colors ${confirmArchive ? 'bg-amber-500/20 text-amber-300' : 'btn-ghost text-gray-600 hover:text-amber-400'}`}
            >
              <Archive size={13} />
            </button>
            <button
              onClick={handleDelete}
              title={confirmDelete ? 'Click again to confirm delete' : 'Delete task'}
              className={`p-1.5 rounded-lg transition-colors ${confirmDelete ? 'bg-red-500/20 text-red-300' : 'btn-ghost text-red-400 hover:text-red-300 hover:bg-red-500/10'}`}
            >
              <Trash2 size={13} />
            </button>
            <button onClick={() => setSelectedTask(null)} className="btn-ghost p-1.5 rounded-lg ml-1">
              <X size={14} />
            </button>
          </div>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-5 space-y-5">

            {/* Lock banner */}
            {isLocked && (
              <div className="flex items-center gap-2 px-3 py-2 bg-amber-500/10 border border-amber-500/25 rounded-xl">
                <Lock size={12} className="text-amber-400 shrink-0" />
                <div>
                  <p className="text-xs font-medium text-amber-300">Planning in progress</p>
                  <p className="text-[10px] text-amber-500/70 mt-0.5">You can still edit fields and check items — dragging is locked until both PM and you approve</p>
                </div>
              </div>
            )}

            {/* Human action notice */}
            {task.requires_human_action === 1 && (
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3">
                <p className="text-xs font-medium text-amber-400 mb-1">Human Action Required</p>
                <p className="text-xs text-amber-300/70">{task.human_action_reason}</p>
              </div>
            )}

            {/* ── Requirements (shown after both approvals) ─────────────────── */}
            {fullyReady && task.pm_review_comment && (
              <div className="rounded-xl border border-green-500/20 bg-green-500/5 overflow-hidden">
                <div className="flex items-center justify-between px-4 py-2.5 border-b border-green-500/15">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={13} className="text-green-400" />
                    <span className="text-xs font-medium text-green-300">Requirements</span>
                  </div>
                  <button
                    onClick={() => setShowPlanningHistory(v => !v)}
                    className="text-[10px] text-gray-600 hover:text-gray-400 transition-colors"
                  >
                    {showPlanningHistory ? 'Hide planning history' : 'Show planning history'}
                  </button>
                </div>
                <div className="px-4 py-3">
                  <p className="text-xs text-gray-300 leading-relaxed whitespace-pre-wrap">{task.pm_review_comment}</p>
                </div>
                {/* Planning history accordion */}
                {showPlanningHistory && (
                  <div className="border-t border-green-500/15">
                    {/* Checklist summary */}
                    {checklist.length > 0 && (
                      <div className="px-4 py-3 border-b border-surface-3">
                        <p className="text-[10px] text-gray-600 font-medium uppercase tracking-wide mb-2">Planning Checklist</p>
                        <div className="space-y-1">
                          {checklist.map((item, i) => (
                            <div key={i} className="flex items-start gap-2">
                              <CheckCircle2 size={11} className="text-green-400/60 shrink-0 mt-0.5" />
                              <span className="text-xs text-gray-600 line-through leading-tight">{item.item}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {/* Conversation history */}
                    {rawConversationLogs.length > 0 && (
                      <div className="px-4 py-3 space-y-2">
                        <p className="text-[10px] text-gray-600 font-medium uppercase tracking-wide mb-2">Planning conversation</p>
                        {rawConversationLogs.map(log => {
                          const isPM = log.action === 'pm_question';
                          const isDone = log.action === 'pm_reviewed';
                          return (
                            <div key={log.id} className={`flex gap-2 ${isPM || isDone ? '' : 'flex-row-reverse'}`}>
                              <div className={`w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold shrink-0 mt-0.5 ${isPM || isDone ? 'bg-purple-600/60 text-white' : 'bg-blue-600/60 text-white'}`}>
                                {isPM || isDone ? 'PM' : 'Me'}
                              </div>
                              <div className={`flex-1 rounded-lg px-2 py-1.5 text-xs leading-relaxed opacity-70 ${
                                isPM ? 'bg-purple-500/8 text-purple-300' :
                                isDone ? 'bg-green-500/8 text-green-400' :
                                'bg-surface-3 text-gray-400'
                              }`}>
                                {log.message}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* ── PM Planning Session (active — not yet fully approved) ──────── */}
            {isPmPlanning && !fullyReady && (
              <div className="rounded-xl border border-surface-3 overflow-hidden">

                {/* Session header */}
                <div className="flex items-center justify-between px-4 py-2.5 bg-surface-2 border-b border-surface-3">
                  <div className="flex items-center gap-2">
                    <div className={`w-1.5 h-1.5 rounded-full ${
                      pmDone ? 'bg-green-400 animate-pulse' :
                      hasPendingQuestion ? 'bg-yellow-400 animate-pulse' :
                      'bg-blue-400 animate-pulse'
                    }`} />
                    <span className="text-xs font-medium text-gray-300">PM Planning</span>
                  </div>
                  <span className="text-[10px] text-gray-500">
                    {pmDone ? 'Awaiting your sign-off' :
                     agentThinking ? 'Agent thinking…' :
                     hasPendingQuestion ? 'Awaiting your reply' :
                     'PM reviewing…'}
                  </span>
                </div>

                {/* Checklist — interactive */}
                {checklist.length > 0 && (
                  <div className="px-4 py-3 border-b border-surface-3 bg-surface-2/40">
                    <div className="flex items-center justify-between mb-2.5">
                      <p className="text-[10px] text-gray-600 font-medium uppercase tracking-wide">Planning Checklist</p>
                      <span className="text-[10px] text-gray-600">{resolvedCount}/{checklist.length} resolved</span>
                    </div>
                    <div className="space-y-1.5 mb-2.5">
                      {checklist.map((item, i) => (
                        <button
                          key={i}
                          onClick={() => !pmDone && handleChecklistToggle(i)}
                          disabled={pmDone}
                          className={`w-full flex items-start gap-2 text-left rounded-lg px-2 py-1.5 transition-colors group ${
                            pmDone ? 'cursor-default' :
                            item.resolved ? 'hover:bg-green-500/5 cursor-pointer' : 'hover:bg-surface-3 cursor-pointer'
                          }`}
                          title={pmDone ? '' : item.resolved ? 'Click to uncheck' : 'Click to mark resolved'}
                        >
                          {item.resolved ? (
                            <CheckCircle2 size={13} className={`shrink-0 mt-0.5 ${item.manuallyResolved ? 'text-blue-400' : 'text-green-400'}`} />
                          ) : (
                            <Circle size={13} className="text-gray-600 shrink-0 mt-0.5 group-hover:text-gray-400 transition-colors" />
                          )}
                          <span className={`text-xs leading-tight ${item.resolved ? 'text-gray-500 line-through' : 'text-gray-300'}`}>
                            {item.item}
                            {item.manuallyResolved && (
                              <span className="ml-1.5 text-[10px] text-blue-400/60">(you)</span>
                            )}
                          </span>
                        </button>
                      ))}
                    </div>
                    <div className="h-1 bg-surface-4 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-700" style={{
                        width: `${checklistProgress}%`,
                        background: checklistProgress === 100
                          ? 'linear-gradient(90deg,#10b981,#34d399)'
                          : 'linear-gradient(90deg,#7c6af7,#a78bfa)'
                      }} />
                    </div>
                    {!pmDone && (
                      <p className="text-[10px] text-gray-700 mt-2">
                        Click any item to check / uncheck it — PM re-evaluates after each toggle.
                        {allItemsChecked && ' All checked — PM doing final review…'}
                      </p>
                    )}
                  </div>
                )}

                {/* Conversation thread */}
                {conversationLogs.length === 0 && !hasPendingQuestion && !agentThinking && (
                  <div className="px-4 py-6 text-center">
                    <p className="text-xs text-gray-600">PM is analysing the task…</p>
                  </div>
                )}
                {(conversationLogs.length > 0 || agentThinking) && (
                  <div className="px-4 py-3 space-y-2.5 max-h-52 overflow-y-auto">
                    {conversationLogs.map(log => {
                      const isPM = log.action === 'pm_question';
                      const isDone = log.action === 'pm_reviewed';
                      return (
                        <div key={log.id} className={`flex gap-2 ${isPM || isDone ? '' : 'flex-row-reverse'}`}>
                          <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0 mt-0.5 ${isPM || isDone ? 'bg-purple-600 text-white' : 'bg-blue-600 text-white'}`}>
                            {isPM || isDone ? 'PM' : 'Me'}
                          </div>
                          <div className={`flex-1 rounded-lg px-2.5 py-2 text-xs leading-relaxed ${
                            isPM ? 'bg-purple-500/10 text-purple-200 border border-purple-500/20' :
                            isDone ? 'bg-green-500/10 text-green-300 border border-green-500/20' :
                            'bg-surface-3 text-gray-300'
                          }`}>
                            {log.message}
                          </div>
                        </div>
                      );
                    })}
                    {agentThinking && (
                      <div className="flex gap-2">
                        <div className="w-5 h-5 rounded-full bg-purple-600 flex items-center justify-center text-[9px] font-bold text-white shrink-0 mt-0.5">PM</div>
                        <div className="flex items-center gap-1.5 bg-purple-500/10 border border-purple-500/20 rounded-lg px-3 py-2.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                          <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                          <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Answer input */}
                {hasPendingQuestion && !agentThinking && (
                  <div className="border-t border-surface-3 p-4 space-y-2.5">
                    {/* Current PM question — shown here since it's sliced from the thread above */}
                    <div className="flex gap-2">
                      <div className="w-5 h-5 rounded-full bg-purple-600 flex items-center justify-center text-[9px] font-bold text-white shrink-0 mt-0.5">PM</div>
                      <p className="flex-1 text-xs text-purple-200 bg-purple-500/10 border border-purple-500/20 rounded-lg px-3 py-2 leading-relaxed whitespace-pre-wrap">
                        {task.pm_pending_question}
                      </p>
                    </div>
                    <div className="flex gap-2 pl-7">
                      <textarea
                        value={answerText}
                        onChange={e => setAnswerText(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAnswer(); } }}
                        placeholder="Reply… (Enter to send, Shift+Enter for new line)"
                        className="flex-1 text-xs p-2.5 bg-surface-3 border border-surface-4 rounded-lg text-gray-300 placeholder-gray-600 resize-none focus:outline-none focus:border-accent transition-colors"
                        rows="3"
                      />
                      <button
                        onClick={handleAnswer}
                        disabled={!answerText.trim()}
                        className="self-end px-3 py-2 text-xs font-medium bg-accent text-white rounded-lg hover:bg-accent/80 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                      >
                        Send
                      </button>
                    </div>
                  </div>
                )}

                {/* PM satisfied — human sign-off */}
                {pmDone && task.human_approval_status !== 'approved' && (
                  <div className="border-t border-surface-3 p-4 space-y-2.5">
                    <p className="text-xs text-green-400 font-medium">PM satisfied — review the requirements and approve</p>
                    {task.pm_review_comment && (
                      <div className="bg-surface-2 rounded-lg p-3">
                        <p className="text-[10px] text-gray-600 font-medium uppercase tracking-wide mb-1.5">Requirements</p>
                        <p className="text-xs text-gray-300 leading-relaxed whitespace-pre-wrap">{task.pm_review_comment}</p>
                      </div>
                    )}
                    {!approvingHuman ? (
                      <button onClick={() => setApprovingHuman(true)} className="w-full py-2 text-xs font-medium bg-green-600/20 text-green-300 rounded-lg hover:bg-green-600/30 transition-colors">
                        Approve &amp; unlock In Progress
                      </button>
                    ) : (
                      <div className="space-y-2">
                        <textarea
                          value={approvalComment}
                          onChange={e => setApprovalComment(e.target.value)}
                          placeholder="Optional comment…"
                          className="w-full text-xs p-2.5 bg-surface-3 border border-surface-4 rounded-lg text-gray-300 placeholder-gray-600 resize-none focus:outline-none focus:border-accent"
                          rows="2"
                        />
                        <div className="flex gap-2">
                          <button onClick={handleApprove} className="flex-1 py-2 text-xs font-medium bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors">Approve</button>
                          <button onClick={() => { setApprovingHuman(false); setApprovalComment(''); }} className="px-3 py-2 text-xs text-gray-500 hover:text-gray-300 transition-colors">Cancel</button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Bypass — all items checked but PM hasn't approved */}
                {showBypass && (
                  <div className="border-t border-surface-3 px-4 py-3 space-y-2">
                    <p className="text-[10px] text-gray-500">All items are checked but PM hasn't approved. You can bypass if you're satisfied.</p>
                    <div className="flex gap-2">
                      <button onClick={handleBypass} className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs rounded-lg transition-colors ${confirmBypass ? 'bg-orange-500/25 text-orange-300 border border-orange-500/30' : 'bg-surface-3 text-gray-500 hover:text-orange-300 hover:bg-orange-500/10'}`}>
                        <Unlock size={11} />
                        {confirmBypass ? 'Confirm bypass?' : 'Bypass PM checks'}
                      </button>
                      <button onClick={() => { setShowNewTask(true); setSelectedTask(null); }} className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs rounded-lg bg-surface-3 text-gray-500 hover:text-accent hover:bg-accent/10 transition-colors">
                        <Plus size={11} />
                        New task instead
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Description — editable */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-xs text-gray-600 font-medium">Description</p>
                {!editingDescription && (
                  <button
                    onClick={() => { setDescriptionDraft(task.description || ''); setEditingDescription(true); }}
                    className="text-[10px] text-gray-700 hover:text-gray-400 flex items-center gap-1 transition-colors"
                  >
                    <Pencil size={10} /> Edit
                  </button>
                )}
              </div>
              {editingDescription ? (
                <div className="space-y-1.5">
                  <textarea
                    ref={descRef}
                    value={descriptionDraft}
                    onChange={e => setDescriptionDraft(e.target.value)}
                    className="w-full text-sm p-2.5 bg-surface-2 border border-accent/60 rounded-lg text-gray-300 placeholder-gray-600 resize-none focus:outline-none focus:border-accent transition-colors"
                    rows="4"
                    placeholder="Describe what needs to be done…"
                  />
                  <div className="flex gap-2">
                    <button onClick={saveDescription} className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-accent text-white rounded-lg hover:bg-accent/80 transition-colors">
                      <Check size={11} /> Save
                    </button>
                    <button onClick={() => setEditingDescription(false)} className="px-3 py-1.5 text-xs text-gray-500 hover:text-gray-300 transition-colors">
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <p
                  onClick={() => { setDescriptionDraft(task.description || ''); setEditingDescription(true); }}
                  className="text-sm text-gray-400 leading-relaxed cursor-text hover:text-gray-300 transition-colors"
                >
                  {task.description || <span className="text-gray-700 italic">No description — click to add</span>}
                </p>
              )}
            </div>

            {/* Acceptance criteria — editable */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-xs text-gray-600 font-medium">Acceptance Criteria</p>
                {!editingCriteria && (
                  <button
                    onClick={() => { setCriteriaDraft(task.acceptance_criteria || ''); setEditingCriteria(true); }}
                    className="text-[10px] text-gray-700 hover:text-gray-400 flex items-center gap-1 transition-colors"
                  >
                    <Pencil size={10} /> Edit
                  </button>
                )}
              </div>
              {editingCriteria ? (
                <div className="space-y-1.5">
                  <textarea
                    value={criteriaDraft}
                    onChange={e => setCriteriaDraft(e.target.value)}
                    onFocus={e => e.target.focus()}
                    className="w-full text-xs p-2.5 bg-surface-2 border border-accent/60 rounded-lg text-gray-300 placeholder-gray-600 resize-none focus:outline-none focus:border-accent transition-colors"
                    rows="3"
                    placeholder="Define what done looks like…"
                  />
                  <div className="flex gap-2">
                    <button onClick={saveCriteria} className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-accent text-white rounded-lg hover:bg-accent/80 transition-colors">
                      <Check size={11} /> Save
                    </button>
                    <button onClick={() => setEditingCriteria(false)} className="px-3 py-1.5 text-xs text-gray-500 hover:text-gray-300 transition-colors">
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div
                  onClick={() => { setCriteriaDraft(task.acceptance_criteria || ''); setEditingCriteria(true); }}
                  className="bg-surface-2 rounded-lg p-3 cursor-text hover:bg-surface-3/50 transition-colors"
                >
                  {task.acceptance_criteria
                    ? <p className="text-xs text-gray-400 leading-relaxed whitespace-pre-wrap">{task.acceptance_criteria}</p>
                    : <p className="text-xs text-gray-700 italic">None — click to add</p>
                  }
                </div>
              )}
            </div>

            {/* Priority & Complexity — always editable dropdowns */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-surface-2 rounded-lg p-2.5">
                <p className="text-xs text-gray-600 mb-1.5">Priority</p>
                <select
                  value={task.priority}
                  onChange={e => handlePriorityChange(e.target.value)}
                  className="w-full bg-transparent text-xs font-medium focus:outline-none cursor-pointer"
                  style={{ color: PRIORITY_COLORS[task.priority] }}
                >
                  {PRIORITIES.map(p => (
                    <option key={p} value={p} style={{ color: PRIORITY_COLORS[p], background: '#1a1a2e' }}>{p}</option>
                  ))}
                </select>
              </div>
              <div className="bg-surface-2 rounded-lg p-2.5">
                <p className="text-xs text-gray-600 mb-1.5">Complexity</p>
                <select
                  value={task.complexity}
                  onChange={e => handleComplexityChange(e.target.value)}
                  className="w-full bg-transparent text-xs font-medium text-gray-300 focus:outline-none cursor-pointer"
                >
                  {COMPLEXITIES.map(c => (
                    <option key={c} value={c} style={{ background: '#1a1a2e' }}>{c}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Assigned agent */}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Assigned Agent</label>
              <select
                value={task.assigned_agent_id || ''}
                onChange={e => handleAgentChange(e.target.value)}
                disabled={isLocked}
                className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-accent disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <option value="">Unassigned</option>
                {agents.filter(a => a.active).map(a => (
                  <option key={a.id} value={a.id}>{a.name} ({a.role})</option>
                ))}
              </select>
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

            {/* Move to — hidden when locked */}
            {!isLocked && (
              <div>
                <p className="text-xs text-gray-600 mb-2 flex items-center gap-1"><ArrowRight size={10} />Move to</p>
                <div className="flex flex-wrap gap-1.5">
                  {columns.filter(c => c.id !== task.column_id && !c.archived_at).map(col => (
                    <button key={col.id} onClick={() => handleMove(col.id)}
                      className="tag bg-surface-3 text-gray-400 hover:text-white hover:bg-surface-4 cursor-pointer transition-colors"
                      style={{ borderLeft: `2px solid ${col.color}` }}>
                      {col.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Timestamp */}
            <div className="text-xs text-gray-700 flex items-center gap-1">
              <Clock size={10} />
              Created {formatDistanceToNow(new Date(task.created_at.replace(' ', 'T') + 'Z'), { addSuffix: true })}
            </div>
          </div>

          {/* Activity log */}
          {logs.length > 0 && (
            <div className="border-t border-border p-5">
              <p className="text-xs text-gray-600 mb-3 flex items-center gap-1"><Activity size={10} />Activity</p>
              <div className="space-y-2.5">
                {logs.map(log => (
                  <div key={log.id} className="flex gap-2.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-surface-4 mt-1.5 shrink-0" />
                    <div>
                      <p className="text-xs text-gray-400">{log.message}</p>
                      <p className="text-[10px] text-gray-700 mt-0.5">
                        {log.agent_name || 'System'} · {formatDistanceToNow(new Date(log.created_at.replace(' ', 'T') + 'Z'), { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
