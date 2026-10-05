import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import api from '../services/api';
import {
  Sparkles,
  Send,
  HelpCircle,
  Copy,
  Check,
  Bookmark,
  FileText,
  Lightbulb,
  Zap,
  GraduationCap,
  CheckCircle2,
  AlertCircle,
  Loader2,
  BookOpen,
  History,
  RotateCcw,
  Info,
} from 'lucide-react';

const MODES = [
  {
    id: 'auto',
    name: 'Auto (Smart)',
    description: 'AI detects the best format for your question',
    icon: Sparkles,
    badgeColor: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
  },
  {
    id: 'doubt',
    name: 'Doubt Solver',
    description: 'Clear explanation + simple real example',
    icon: HelpCircle,
    badgeColor: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  },
  {
    id: 'mark2',
    name: '2 Marks (Short)',
    description: '2 to 3 concise exam sentences',
    icon: Zap,
    badgeColor: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  },
  {
    id: 'mark8',
    name: '8 Marks (Medium)',
    description: '250-350 words with headings & key points',
    icon: FileText,
    badgeColor: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  },
  {
    id: 'mark16',
    name: '16 Marks (Essay)',
    description: '500-700 words: Intro, Points, Diagram, Conclusion',
    icon: GraduationCap,
    badgeColor: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300',
  },
  {
    id: 'short_notes',
    name: 'Short Notes',
    description: 'Bulleted key points for fast revision',
    icon: CheckCircle2,
    badgeColor: 'bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300',
  },
  {
    id: 'simple',
    name: 'Simple (Beginner)',
    description: 'Beginner-friendly explanation with analogy',
    icon: Lightbulb,
    badgeColor: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
  },
];

const AskPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [question, setQuestion] = useState('');
  const [selectedMode, setSelectedMode] = useState('auto');
  const [selectedNoteId, setSelectedNoteId] = useState('');
  const [userNotes, setUserNotes] = useState([]);
  const [loadingNotes, setLoadingNotes] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [qaHistory, setQaHistory] = useState([]);
  const [copiedId, setCopiedId] = useState(null);
  const [savingNoteId, setSavingNoteId] = useState(null);
  const [savedNoteMap, setSavedNoteMap] = useState({});

  const inputRef = useRef(null);

  // Fetch user notes for reference selector
  useEffect(() => {
    const fetchNotes = async () => {
      setLoadingNotes(true);
      try {
        const res = await api.get('/notes');
        setUserNotes(res.data.notes || []);
      } catch (err) {
        console.error('Failed to load user notes:', err);
      } finally {
        setLoadingNotes(false);
      }
    };
    fetchNotes();
  }, []);

  // Handle URL query param `?q=` or `?question=` from dashboard
  useEffect(() => {
    const q = searchParams.get('q') || searchParams.get('question');
    if (q && q.trim()) {
      setQuestion(q.trim());
      inputRef.current?.focus();
    }
    const noteIdParam = searchParams.get('noteId');
    if (noteIdParam) {
      setSelectedNoteId(noteIdParam);
    }
  }, [searchParams]);

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();

    const trimmed = question.trim();
    if (!trimmed) {
      setError('Please enter a question to ask.');
      return;
    }
    if (trimmed.length < 3) {
      setError('Question must be at least 3 characters long.');
      return;
    }
    if (trimmed.length > 2000) {
      setError('Question exceeds the 2,000 character limit.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const payload = {
        question: trimmed,
        mode: selectedMode,
      };
      if (selectedNoteId) {
        payload.noteId = selectedNoteId;
      }

      const res = await api.post('/ask', payload);
      const { answer, mode, truncated } = res.data;

      const newQA = {
        id: Date.now().toString(),
        question: trimmed,
        answer,
        mode: mode || selectedMode,
        truncated: Boolean(truncated),
        noteId: selectedNoteId || null,
        noteTitle: userNotes.find((n) => n._id === selectedNoteId)?.title || null,
        createdAt: new Date(),
      };

      // Keep last 10 Q&A pairs in state (newest first)
      setQaHistory((prev) => [newQA, ...prev].slice(0, 10));
      setQuestion('');
    } catch (err) {
      console.error('Ask AI error:', err);
      const msg =
        err.response?.data?.message ||
        err.message ||
        'Failed to get answer from AI. Please try again.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async (id, text) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error('Failed to copy text:', err);
    }
  };

  const handleSaveAsNote = async (qa) => {
    setSavingNoteId(qa.id);
    try {
      const title = `AI Answer: ${qa.question.slice(0, 60)}${qa.question.length > 60 ? '...' : ''}`;
      const content = `## Question\n${qa.question}\n\n## AI Explanation (${qa.mode.toUpperCase()})\n${qa.answer}\n\n---\n*Saved from StudyMate Ask AI on ${new Date().toLocaleDateString()}*`;

      await api.post('/notes/paste', {
        title,
        content,
      });

      setSavedNoteMap((prev) => ({ ...prev, [qa.id]: true }));
    } catch (err) {
      console.error('Save note error:', err);
      const msg =
        err.response?.data?.message ||
        'Failed to save answer as note. If you reached the 50-note limit, please delete some notes.';
      setError(msg);
    } finally {
      setSavingNoteId(null);
    }
  };

  const currentModeObj = MODES.find((m) => m.id === selectedMode) || MODES[0];

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 animate-fadeIn">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-brand-600 via-indigo-600 to-violet-600 p-6 sm:p-8 text-white shadow-xl shadow-brand-500/20">
        <div className="relative z-10 max-w-3xl">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-white/20 backdrop-blur-md text-xs font-semibold uppercase tracking-wider mb-3">
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            <span>StudyMate AI Assistant</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            Ask AI — Academic Q&A & Concept Clarification
          </h1>
          <p className="mt-2 text-slate-100/90 text-xs sm:text-sm leading-relaxed">
            Get instant textbook-grade explanations, 2-mark definitions, 8-mark structured points, or 16-mark comprehensive essay breakdowns grounded in your study notes.
          </p>
        </div>
      </div>

      {/* Main Query Box Card */}
      <div className="glass-panel bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 border border-slate-200 dark:border-slate-800 shadow-lg space-y-6">
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Question Textarea */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300">
              <label htmlFor="ai-question-input" className="flex items-center space-x-1.5">
                <HelpCircle className="w-4 h-4 text-brand-600 dark:text-brand-400" />
                <span>Your Academic Question or Concept:</span>
              </label>
              <span className={`text-[11px] ${question.length > 2000 ? 'text-red-500 font-bold' : 'text-slate-400'}`}>
                {question.length} / 2000
              </span>
            </div>

            <div className="relative">
              <textarea
                id="ai-question-input"
                ref={inputRef}
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                onKeyDown={(e) => {
                  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                    e.preventDefault();
                    if (!loading && question.trim()) handleSubmit();
                  }
                }}
                rows={4}
                placeholder="Type your question here (e.g., 'Explain process synchronization and semaphores with a real example' or 'What is ACID in DBMS?'). Press Ctrl+Enter to ask..."
                className="w-full p-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/70 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent text-sm sm:text-base leading-relaxed resize-y transition-all"
                disabled={loading}
              />
            </div>
          </div>

          {/* Controls: Mode Selector & Reference Note */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
            {/* Mode Selector */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center space-x-1">
                <Sparkles className="w-3.5 h-3.5 text-brand-500" />
                <span>Response Mode:</span>
              </label>
              <div className="relative">
                <select
                  value={selectedMode}
                  onChange={(e) => setSelectedMode(e.target.value)}
                  disabled={loading}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-brand-500 transition-all cursor-pointer"
                >
                  {MODES.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} — {m.description}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Optional "Use my note" Dropdown */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center space-x-1">
                <BookOpen className="w-3.5 h-3.5 text-indigo-500" />
                <span>Use My Note as Context (Optional):</span>
              </label>
              <select
                value={selectedNoteId}
                onChange={(e) => setSelectedNoteId(e.target.value)}
                disabled={loading || loadingNotes}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-brand-500 transition-all cursor-pointer"
              >
                <option value="">None (Ask from syllabus directly)</option>
                {userNotes.map((n) => (
                  <option key={n._id} value={n._id}>
                    {n.title}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Quick Mode Chips */}
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500 mr-1">
              Modes:
            </span>
            {MODES.map((m) => {
              const Icon = m.icon;
              const isSelected = selectedMode === m.id;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setSelectedMode(m.id)}
                  disabled={loading}
                  className={`inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                    isSelected
                      ? 'bg-brand-600 text-white shadow-sm scale-105'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  <Icon className="w-3 h-3" />
                  <span>{m.name.split(' ')[0]}</span>
                </button>
              );
            })}
          </div>

          {/* Error Banner */}
          {error && (
            <div className="p-4 rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 text-red-700 dark:text-red-300 flex items-start space-x-3 text-xs sm:text-sm animate-shake">
              <AlertCircle className="w-5 h-5 flex-shrink-0 text-red-500 mt-0.5" />
              <div className="flex-1">
                <p className="font-semibold">{error}</p>
              </div>
            </div>
          )}

          {/* Action Row */}
          <div className="flex items-center justify-between pt-2">
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              <span className="font-medium text-slate-700 dark:text-slate-300">Tip:</span> Press{' '}
              <kbd className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono text-[10px]">
                Ctrl + Enter
              </kbd>{' '}
              to ask instantly.
            </p>

            <button
              type="submit"
              disabled={loading || !question.trim()}
              className="px-6 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-semibold text-xs sm:text-sm shadow-md shadow-brand-500/25 flex items-center space-x-2 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Consulting StudyMate AI...</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>Ask AI</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Loading State Spinner */}
      {loading && (
        <div className="glass-panel bg-white/70 dark:bg-slate-900/70 rounded-3xl p-8 border border-slate-200 dark:border-slate-800 shadow-lg text-center flex flex-col items-center justify-center space-y-3">
          <div className="relative">
            <div className="w-12 h-12 rounded-2xl bg-brand-50 dark:bg-brand-950/60 text-brand-600 flex items-center justify-center">
              <Sparkles className="w-6 h-6 animate-pulse" />
            </div>
            <Loader2 className="w-12 h-12 text-brand-600 animate-spin absolute inset-0" />
          </div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white">
            Formulating Academic Answer in {currentModeObj.name} Mode...
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md">
            Analyzing academic syllabus, adhering to textbook standards, and verifying key concepts.
          </p>
        </div>
      )}

      {/* Q&A Stream & History (Last 10 Pairs) */}
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center space-x-2">
            <History className="w-5 h-5 text-brand-600 dark:text-brand-400" />
            <span>Recent Q&A History ({qaHistory.length}/10)</span>
          </h2>
          {qaHistory.length > 0 && (
            <button
              onClick={() => setQaHistory([])}
              className="text-xs font-semibold text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 flex items-center space-x-1"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Clear History</span>
            </button>
          )}
        </div>

        {qaHistory.length === 0 && !loading && (
          <div className="glass-panel bg-white/50 dark:bg-slate-900/50 rounded-3xl p-12 text-center border border-dashed border-slate-200 dark:border-slate-800 flex flex-col items-center justify-center">
            <div className="w-14 h-14 rounded-2xl bg-brand-50 dark:bg-brand-950/40 text-brand-500 flex items-center justify-center mb-3">
              <HelpCircle className="w-7 h-7 opacity-70" />
            </div>
            <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">
              No questions asked yet
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm">
              Type any question above, choose your preferred exam mode (2 marks, 8 marks, 16 marks, doubt, short notes, or simple), and click Ask AI.
            </p>
          </div>
        )}

        {qaHistory.map((item, index) => {
          const modeDef = MODES.find((m) => m.id === item.mode) || MODES[0];
          const isCopied = copiedId === item.id;
          const isSaved = savedNoteMap[item.id];
          const isSaving = savingNoteId === item.id;

          return (
            <div
              key={item.id}
              className="glass-panel bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 border border-slate-200 dark:border-slate-800 shadow-md space-y-5 transition-all hover:border-slate-300 dark:hover:border-slate-700"
            >
              {/* Question Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-start space-x-3">
                  <div className="w-7 h-7 rounded-xl bg-brand-600 text-white flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">
                    Q
                  </div>
                  <div>
                    <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white leading-snug">
                      {item.question}
                    </h3>
                    <div className="flex flex-wrap items-center gap-2 mt-1 text-[11px] text-slate-500">
                      <span>{new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      {item.noteTitle && (
                        <>
                          <span>•</span>
                          <span className="inline-flex items-center text-indigo-600 dark:text-indigo-400">
                            <BookOpen className="w-3 h-3 mr-1" />
                            {item.noteTitle}
                          </span>
                        </>
                      )}
                      {item.truncated && (
                        <>
                          <span>•</span>
                          <span className="text-amber-500 font-medium">Context truncated to 8k chars</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-2 self-start sm:self-center">
                  <span className={`px-2.5 py-1 rounded-full text-[11px] font-semibold ${modeDef.badgeColor}`}>
                    {modeDef.name}
                  </span>
                </div>
              </div>

              {/* Formatted Markdown Answer */}
              <div className="prose dark:prose-invert max-w-none text-sm text-slate-800 dark:text-slate-200 leading-relaxed overflow-x-auto">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    h1: ({ node, ...props }) => (
                      <h1 className="text-xl font-bold text-slate-900 dark:text-white mt-6 mb-3 border-b border-slate-100 dark:border-slate-800 pb-2" {...props} />
                    ),
                    h2: ({ node, ...props }) => (
                      <h2 className="text-lg font-bold text-slate-900 dark:text-white mt-5 mb-2.5 text-brand-600 dark:text-brand-400" {...props} />
                    ),
                    h3: ({ node, ...props }) => (
                      <h3 className="text-base font-bold text-slate-900 dark:text-white mt-4 mb-2" {...props} />
                    ),
                    ul: ({ node, ...props }) => (
                      <ul className="space-y-1.5 my-3 list-disc list-inside text-slate-700 dark:text-slate-300" {...props} />
                    ),
                    ol: ({ node, ...props }) => (
                      <ol className="space-y-1.5 my-3 list-decimal list-inside text-slate-700 dark:text-slate-300" {...props} />
                    ),
                    li: ({ node, ...props }) => (
                      <li className="leading-relaxed marker:text-brand-500" {...props} />
                    ),
                    strong: ({ node, ...props }) => (
                      <strong className="font-bold text-slate-900 dark:text-white" {...props} />
                    ),
                    code: ({ node, inline, ...props }) =>
                      inline ? (
                        <code className="px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 font-mono text-xs text-brand-600 dark:text-brand-400" {...props} />
                      ) : (
                        <code className="block p-4 rounded-xl bg-slate-900 text-slate-100 font-mono text-xs overflow-x-auto my-3" {...props} />
                      ),
                    table: ({ node, ...props }) => (
                      <div className="overflow-x-auto my-4 rounded-xl border border-slate-200 dark:border-slate-800">
                        <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800 text-xs" {...props} />
                      </div>
                    ),
                    th: ({ node, ...props }) => (
                      <th className="px-3 py-2 bg-slate-50 dark:bg-slate-800/60 font-semibold text-slate-700 dark:text-slate-300 text-left" {...props} />
                    ),
                    td: ({ node, ...props }) => (
                      <td className="px-3 py-2 border-t border-slate-100 dark:border-slate-800" {...props} />
                    ),
                  }}
                >
                  {item.answer}
                </ReactMarkdown>
              </div>

              {/* Action Buttons: Copy & Save as Note */}
              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center space-x-2">
                  {/* Copy Button */}
                  <button
                    onClick={() => handleCopy(item.id, item.answer)}
                    className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-medium text-xs flex items-center space-x-1.5 transition-colors"
                  >
                    {isCopied ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-500" />
                        <span className="text-emerald-600 dark:text-emerald-400 font-semibold">Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 text-slate-500" />
                        <span>Copy Answer</span>
                      </>
                    )}
                  </button>

                  {/* Save as Note Button */}
                  <button
                    onClick={() => handleSaveAsNote(item)}
                    disabled={isSaving || isSaved}
                    className={`px-3 py-1.5 rounded-lg font-medium text-xs flex items-center space-x-1.5 transition-all ${
                      isSaved
                        ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                        : 'bg-brand-50 hover:bg-brand-100 text-brand-700 dark:bg-brand-950/40 dark:text-brand-300 dark:hover:bg-brand-900/60 border border-brand-200 dark:border-brand-800'
                    }`}
                  >
                    {isSaving ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Saving...</span>
                      </>
                    ) : isSaved ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-500" />
                        <span>Saved to Notes Library</span>
                      </>
                    ) : (
                      <>
                        <Bookmark className="w-3.5 h-3.5 text-brand-500" />
                        <span>Save as Note</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Mandatory Disclaimer */}
                <div className="flex items-center space-x-1.5 text-[11px] text-slate-400 dark:text-slate-500 italic">
                  <Info className="w-3 h-3 text-slate-400" />
                  <span>AI-generated. Please verify with your textbooks.</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default AskPage;
