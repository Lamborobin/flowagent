import { useState, useEffect } from 'react';
import { X, Trash2, ArrowRight, Clock, Tag, Activity, Lock, Unlock, Archive, Plus, CheckCircle2, Circle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useStore } from '../store';
import { tasksApi } from '../api';

const PRIORITY_COLORS = {
  critical: '#ef4444', high: '#f97316', medium: '#3b82f6', low: '#6b7280'
};

export default function TaskDetail() {
  const { selectedTask, setSelectedTask, setShowNewTask, columns, agents, moveTask, deleteTask, updateTask, archiveTask, bypassPm } = useStore();
  const [task, setTask] = useState(null);
  const [logs, setLogs] = useState([]);
  const [approvingHuman, setApprovingHuman] = useState(false);
  const [approvalComment, setApprovalComment] = useState('');
  const [answerText, setAnswerText] = useState('');
  const [agentThinking, setAgentThinking] = useState(false);
  const [confirmBypass, setConfirmBypass] = useState(false);
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!selectedTask) return;
    setAgentThinking(false);
    setConfirmBypass(false);
    setConfirmArchive(false);
    setConfirmDelete(false);
    setAnswerText('');
    tasksApi.get(selectedTask.id).then(t => { setTask(t); setLogs(t.logs || []); });
  }, [selectedTask?.id]);

  // Poll while agent is thinking
  useEffect(() => {
    if (!agentThinking || !selectedTask) return;
    let cancelled = false;
    const prevQuestion = task?.pm_pending_question;
    const prevStatus = task?.pm_approval_status;

    const poll = async () => {
      if (cancelled) return;
      try {
        const fresh = await tasksApi.get(selectedTask.id);
        if (cancelled) return;
        if (fresh.pm_pending_question !== prevQuestion || fresh.pm_approval_status !== prevStatus) {
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
  }, [agentThinking]);

  if (!selectedTask) return null;
  if (!task) return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center">
      <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
    </div>
  );

  const tags = Array.isArray(task.tags) ? task.tags : [];
  const isLocked = task.is_locked;
  const checklist = Array.isArray(task.pm_checklist) ? task.pm_checklist : [];
  const conversationLogs = logs.filter(l => ['pm_question', 'human_answer', 'pm_reviewed'].includes(l.action));
  const exchangeCount = logs.filter(l => ['pm_question', 'human_answer'].includes(l.action)).length;

  const isPmPlanning = task.column_id === 'col_backlog' && task.assigned_agent_id === 'agent_pm';
  const hasPendingQuestion = !!task.pm_pending_question;
  const pmDone = task.pm_approval_status === 'approved';
  const fullyReady = pmDone && task.human_approval_status === 'approved';
  const showBypass = isPmPlanning && !fullyReady && exchangeCount >= 10;

  const resolvedCount = checklist.filter(i => i.resolved).length;
  const checklistProgress = checklist.length > 0 ? (resolvedCount / checklist.length) * 100 : 0;

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

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in"
      onClick={e => e.target === e.currentTarget && setSelectedTask(null)}
    >
      <div className="bg-surface-1 border border-border rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col animate-slide-in overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <div className="flex items-center gap-2">
            {isLocked && <Lock size={13} className="text-amber-400" />}
            <span className="text-sm font-semibold text-gray-200">{task.title}</span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={handleArchive}
              title={confirmArchive ? 'Click again to confirm' : 'Archive task'}
              className={`p-1.5 rounded-lg transition-colors ${
                confirmArchive ? 'bg-amber-500/20 text-amber-300' : 'btn-ghost text-gray-600 hover:text-amber-400'
              }`}
            >
              <Archive size={13} />
            </button>
            <button
              onClick={handleDelete}
              title={confirmDelete ? 'Click again to confirm delete' : 'Delete task'}
              className={`p-1.5 rounded-lg transition-colors ${
                confirmDelete ? 'bg-red-500/20 text-red-300' : 'btn-ghost text-red-400 hover:text-red-300 hover:bg-red-500/10'
              }`}
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
                  <p className="text-xs font-medium text-amber-300">Locked · Planning phase</p>
                  <p className="text-[10px] text-amber-500/70 mt-0.5">Movement and edits locked until PM + human approve</p>
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

            {/* PM Planning Session */}
            {isPmPlanning && (
              <div className="rounded-xl border border-surface-3 overflow-hidden">

                {/* Session header */}
                <div className="flex items-center justify-between px-4 py-2.5 bg-surface-2 border-b border-surface-3">
                  <div className="flex items-center gap-2">
                    <div className={`w-1.5 h-1.5 rounded-full ${
                      fullyReady ? 'bg-green-400' :
                      pmDone ? 'bg-green-400 animate-pulse' :
                      hasPendingQuestion ? 'bg-yellow-400 animate-pulse' :
                      'bg-blue-400 animate-pulse'
                    }`} />
                    <span className="text-xs font-medium text-gray-300">PM Planning</span>
                  </div>
                  <span className="text-[10px] text-gray-500">
                    {fullyReady ? '✓ Ready to move' :
                     pmDone ? 'Awaiting your sign-off' :
                     agentThinking ? 'Agent thinking…' :
                     hasPendingQuestion ? 'Awaiting your reply' :
                     'PM reviewing…'}
                  </span>
                </div>

                {/* Checklist panel */}
                {checklist.length > 0 && (
                  <div className="px-4 py-3 border-b border-surface-3 bg-surface-2/40">
                    <div className="flex items-center justify-between mb-2.5">
                      <p className="text-[10px] text-gray-600 font-medium uppercase tracking-wide">Planning Checklist</p>
                      <span className="text-[10px] text-gray-600">{resolvedCount}/{checklist.length} resolved</span>
                    </div>
                    <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 mb-2.5">
                      {checklist.map((item, i) => (
                        <div key={i} className="flex items-start gap-1.5">
                          {item.resolved
                            ? <CheckCircle2 size={12} className="text-green-400 shrink-0 mt-0.5" />
                            : <Circle size={12} className="text-gray-600 shrink-0 mt-0.5" />
                          }
                          <span className={`text-xs leading-tight ${
                            item.resolved ? 'text-gray-600 line-through' : 'text-gray-400'
                          }`}>
                            {item.item}
                          </span>
                        </div>
                      ))}
                    </div>
                    <div className="h-1 bg-surface-4 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{
                          width: `${checklistProgress}%`,
                          background: checklistProgress === 100
                            ? 'linear-gradient(90deg,#10b981,#34d399)'
                            : 'linear-gradient(90deg,#7c6af7,#a78bfa)'
                        }}
                      />
                    </div>
                  </div>
                )}

                {/* Conversation thread */}
                {conversationLogs.length === 0 && !hasPendingQuestion && !agentThinking && (
                  <div className="px-4 py-6 text-center">
                    <p className="text-xs text-gray-600">PM is analysing the task description…</p>
                  </div>
                )}

                {(conversationLogs.length > 0 || agentThinking) && (
                  <div className="px-4 py-3 space-y-2.5 max-h-52 overflow-y-auto">
                    {conversationLogs.map(log => {
                      const isPM = log.action === 'pm_question';
                      const isDone = log.action === 'pm_reviewed';
                      return (
                        <div key={log.id} className={`flex gap-2 ${isPM || isDone ? '' : 'flex-row-reverse'}`}>
                          <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0 mt-0.5 ${
                            isPM || isDone ? 'bg-purple-600 text-white' : 'bg-blue-600 text-white'
                          }`}>
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
                    <div className="flex gap-2">
                      <div className="w-5 h-5 rounded-full bg-purple-600 flex items-center justify-center text-[9px] font-bold text-white shrink-0 mt-0.5">PM</div>
                      <p className="flex-1 text-xs text-purple-200 bg-purple-500/10 border border-purple-500/20 rounded-lg px-3 py-2 leading-relaxed">
                        {task.pm_pending_question}
                      </p>
                    </div>
                    <div className="flex gap-2 pl-7">
                      <textarea
                        value={answerText}
                        onChange={e => setAnswerText(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAnswer(); } }}
                        placeholder="Reply to PM… (Enter to send, Shift+Enter for new line)"
                        className="flex-1 text-xs p-2.5 bg-surface-3 border border-surface-4 rounded-lg text-gray-300 placeholder-gray-600 resize-none focus:outline-none focus:border-accent transition-colors"
                        rows="2"
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
                    <p className="text-xs text-green-400 font-medium">PM satisfied — your sign-off needed</p>
                    {task.pm_review_comment && (
                      <p className="text-xs text-gray-500 italic leading-relaxed">"{task.pm_review_comment}"</p>
                    )}
                    {!approvingHuman ? (
                      <button
                        onClick={() => setApprovingHuman(true)}
                        className="w-full py-2 text-xs font-medium bg-green-600/20 text-green-300 rounded-lg hover:bg-green-600/30 transition-colors"
                      >
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
                          <button onClick={handleApprove}
                            className="flex-1 py-2 text-xs font-medium bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors">
                            Approve
                          </button>
                          <button onClick={() => { setApprovingHuman(false); setApprovalComment(''); }}
                            className="px-3 py-2 text-xs text-gray-500 hover:text-gray-300 transition-colors">
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Fully ready */}
                {fullyReady && (
                  <div className="border-t border-green-500/20 bg-green-500/5 px-4 py-3 text-center">
                    <p className="text-xs text-green-400 font-medium">✓ Planning complete — drag to In Progress</p>
                  </div>
                )}

                {/* Bypass — only shown after 10+ exchanges */}
                {showBypass && (
                  <div className="border-t border-surface-3 px-4 py-3 space-y-2">
                    <p className="text-[10px] text-gray-600 font-medium uppercase tracking-wide">Stuck? Last resort</p>
                    <div className="flex gap-2">
                      <button
                        onClick={handleBypass}
                        className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs rounded-lg transition-colors ${
                          confirmBypass
                            ? 'bg-orange-500/25 text-orange-300 border border-orange-500/30'
                            : 'bg-surface-3 text-gray-500 hover:text-orange-300 hover:bg-orange-500/10'
                        }`}
                      >
                        <Unlock size={11} />
                        {confirmBypass ? 'Confirm bypass?' : 'Bypass PM checks'}
                      </button>
                      <button
                        onClick={() => { setShowNewTask(true); setSelectedTask(null); }}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs rounded-lg bg-surface-3 text-gray-500 hover:text-accent hover:bg-accent/10 transition-colors"
                      >
                        <Plus size={11} />
                        New task instead
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Description */}
            {task.description && (
              <div>
                <p className="text-xs text-gray-600 mb-1.5 font-medium">Description</p>
                <p className="text-sm text-gray-400 leading-relaxed">{task.description}</p>
              </div>
            )}

            {/* Acceptance criteria */}
            {task.acceptance_criteria && (
              <div className="bg-surface-2 rounded-lg p-3">
                <p className="text-xs font-medium text-gray-500 mb-1.5">Acceptance Criteria</p>
                <p className="text-xs text-gray-400 leading-relaxed whitespace-pre-wrap">{task.acceptance_criteria}</p>
              </div>
            )}

            {/* Meta row */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-surface-2 rounded-lg p-2.5">
                <p className="text-xs text-gray-600 mb-1">Priority</p>
                <span className="text-xs font-medium" style={{ color: PRIORITY_COLORS[task.priority] }}>{task.priority}</span>
              </div>
              <div className="bg-surface-2 rounded-lg p-2.5">
                <p className="text-xs text-gray-600 mb-1">Complexity</p>
                <span className="text-xs font-medium text-gray-300">{task.complexity}</span>
              </div>
            </div>

            {/* Assigned agent (editable) */}
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
