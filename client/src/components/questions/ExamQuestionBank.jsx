import React, { useState, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import { useNavigate } from 'react-router-dom';
import {
  Award,
  BookOpen,
  ChevronDown,
  ChevronUp,
  Copy,
  Check,
  Search,
  Sparkles,
  HelpCircle,
  Layers,
  Flame,
  FileCheck,
  Tag,
  Eye,
  EyeOff,
  AlertCircle,
} from 'lucide-react';

const ExamQuestionBank = ({
  questionBank,
  topic,
  noteId,
  onRegenerate,
  isRegenerating = false,
}) => {
  const navigate = useNavigate();
  const [activeFilter, setActiveFilter] = useState('all'); // 'all' | '2' | '8' | '16'
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedIds, setExpandedIds] = useState({});
  const [copiedId, setCopiedId] = useState(null);

  const {
    analysisSummary = '',
    importantTopics = [],
    twoMarks = [],
    eightMarks = [],
    sixteenMarks = [],
  } = questionBank || {};

  // Combine questions with distinct identifiers
  const allQuestions = useMemo(() => {
    const list = [];
    twoMarks.forEach((q, idx) => list.push({ ...q, id: `2m-${idx}`, part: 'Part A', marks: 2 }));
    eightMarks.forEach((q, idx) => list.push({ ...q, id: `8m-${idx}`, part: 'Part B', marks: 8 }));
    sixteenMarks.forEach((q, idx) => list.push({ ...q, id: `16m-${idx}`, part: 'Part C', marks: 16 }));
    return list;
  }, [twoMarks, eightMarks, sixteenMarks]);

  // Filtered list based on marks tab and search query
  const filteredQuestions = useMemo(() => {
    return allQuestions.filter((q) => {
      const matchesFilter =
        activeFilter === 'all' || q.marks.toString() === activeFilter;
      const matchesSearch =
        !searchQuery.trim() ||
        q.question?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        q.answer?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (q.keyTopics && q.keyTopics.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase())));
      return matchesFilter && matchesSearch;
    });
  }, [allQuestions, activeFilter, searchQuery]);

  const toggleExpand = (id) => {
    setExpandedIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleExpandAll = () => {
    const next = {};
    filteredQuestions.forEach((q) => {
      next[q.id] = true;
    });
    setExpandedIds(next);
  };

  const handleCollapseAll = () => {
    setExpandedIds({});
  };

  const handleCopyAnswer = async (id, text) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error('Failed to copy answer:', err);
    }
  };

  const getMarksBadge = (marks) => {
    switch (marks) {
      case 2:
        return {
          label: '2 Marks • Part A',
          bg: 'bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 border-sky-200 dark:border-sky-800',
        };
      case 8:
        return {
          label: '8 Marks • Part B',
          bg: 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800',
        };
      case 16:
        return {
          label: '16 Marks • Part C (Essay/Comprehensive)',
          bg: 'bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800',
        };
      default:
        return {
          label: `${marks} Marks`,
          bg: 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200',
        };
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* AI-Predicted Likely Exam Questions Card */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-900 via-slate-900 to-purple-950 p-6 text-white border border-indigo-500/20 shadow-xl">
        <div className="relative z-10 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center space-x-2.5">
              <div className="w-10 h-10 rounded-xl bg-amber-400/20 border border-amber-400/30 flex items-center justify-center text-amber-300">
                <Award className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-300 flex items-center space-x-1">
                  <Flame className="w-3 h-3" />
                  <span>AI-Predicted Likely Exam Questions</span>
                </span>
                <h3 className="text-lg font-bold tracking-tight text-white">
                  {topic || 'Exam Question Bank'}
                </h3>
              </div>
            </div>

            <div className="flex items-center space-x-2 text-xs">
              <span className="px-3 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/10 text-slate-200">
                {allQuestions.length} Curated Questions
              </span>
              {onRegenerate && (
                <button
                  onClick={onRegenerate}
                  disabled={isRegenerating}
                  className="px-3 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-medium transition-all disabled:opacity-50 flex items-center space-x-1.5"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>{isRegenerating ? 'Analyzing...' : 'Deepen Analysis'}</span>
                </button>
              )}
            </div>
          </div>

          {/* Visible Disclaimer Banner */}
          <div className="flex items-start space-x-2.5 p-3 rounded-xl bg-amber-500/15 border border-amber-400/30 text-amber-100 text-xs">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-amber-300" />
            <p>
              <strong>Disclaimer:</strong> Questions and model answers are AI-predicted based on academic syllabus curriculum patterns and are intended for study practice, not official university past examination papers.
            </p>
          </div>

          {analysisSummary && (
            <p className="text-xs sm:text-sm text-slate-200/90 leading-relaxed font-normal bg-black/20 p-4 rounded-xl border border-white/10">
              {analysisSummary}
            </p>
          )}

          {/* Important Recurring Topics Pills */}
          {importantTopics && importantTopics.length > 0 && (
            <div className="pt-1">
              <div className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider mb-2 flex items-center space-x-1.5">
                <Tag className="w-3 h-3 text-amber-400" />
                <span>Frequently Evaluated Themes (High Weightage)</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {importantTopics.map((item, idx) => {
                  const topicTitle = typeof item === 'string' ? item : item?.topic || 'Core Module';
                  const topicProb = typeof item === 'object' ? item?.probability : null;
                  return (
                    <span
                      key={idx}
                      className="px-2.5 py-1 rounded-lg text-xs bg-white/10 hover:bg-white/15 border border-white/10 text-amber-200 font-medium transition-colors flex items-center space-x-1"
                    >
                      <span>★ {topicTitle}</span>
                      {topicProb && (
                        <span className="text-[10px] opacity-80 font-normal">({topicProb})</span>
                      )}
                    </span>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Quick Launch Practice Bar */}
      <div className="glass-panel bg-white/80 dark:bg-slate-900/80 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 shadow-sm">
        <div className="flex items-center space-x-2 text-xs text-slate-600 dark:text-slate-300 font-medium">
          <BookOpen className="w-4 h-4 text-brand-500" />
          <span>Need practice on this topic? Test your recall directly:</span>
        </div>

        <div className="flex items-center space-x-2.5">
          <button
            onClick={() => {
              const url = noteId
                ? `/quiz?noteId=${noteId}`
                : `/quiz?topic=${encodeURIComponent(topic || '')}`;
              navigate(url);
            }}
            className="px-3.5 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-semibold text-xs shadow-sm flex items-center space-x-1.5 transition-transform active:scale-95"
          >
            <HelpCircle className="w-3.5 h-3.5" />
            <span>Take 10 MCQs Quiz</span>
          </button>

          <button
            onClick={() => {
              const url = noteId
                ? `/flashcards?noteId=${noteId}`
                : `/flashcards?topic=${encodeURIComponent(topic || '')}`;
              navigate(url);
            }}
            className="px-3.5 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs shadow-sm flex items-center space-x-1.5 transition-transform active:scale-95"
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Practice 15 Flashcards</span>
          </button>
        </div>
      </div>

      {/* Search and Filter Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        {/* Mark Filter Tabs */}
        <div className="flex bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl text-xs font-semibold overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveFilter('all')}
            className={`px-3 py-1.5 rounded-lg transition-all flex items-center space-x-1.5 flex-shrink-0 ${
              activeFilter === 'all'
                ? 'bg-white dark:bg-slate-900 text-brand-600 dark:text-brand-400 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <span>All Questions</span>
            <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-slate-200 dark:bg-slate-700">
              {allQuestions.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveFilter('2')}
            className={`px-3 py-1.5 rounded-lg transition-all flex items-center space-x-1.5 flex-shrink-0 ${
              activeFilter === '2'
                ? 'bg-white dark:bg-slate-900 text-sky-600 dark:text-sky-400 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <span>Part A (2 Marks)</span>
            <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-slate-200 dark:bg-slate-700">
              {twoMarks.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveFilter('8')}
            className={`px-3 py-1.5 rounded-lg transition-all flex items-center space-x-1.5 flex-shrink-0 ${
              activeFilter === '8'
                ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <span>Part B (8 Marks)</span>
            <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-slate-200 dark:bg-slate-700">
              {eightMarks.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveFilter('16')}
            className={`px-3 py-1.5 rounded-lg transition-all flex items-center space-x-1.5 flex-shrink-0 ${
              activeFilter === '16'
                ? 'bg-white dark:bg-slate-900 text-amber-600 dark:text-amber-400 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <span>Part C (16 Marks)</span>
            <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-slate-200 dark:bg-slate-700">
              {sixteenMarks.length}
            </span>
          </button>
        </div>

        {/* Search & Expand All */}
        <div className="flex items-center space-x-2">
          <div className="relative flex-1 sm:w-60">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search question, keyword..."
              className="w-full pl-8 pr-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>

          <button
            type="button"
            onClick={handleExpandAll}
            className="p-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs flex items-center space-x-1"
            title="Expand all model answers"
          >
            <Eye className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Expand All</span>
          </button>

          <button
            type="button"
            onClick={handleCollapseAll}
            className="p-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs flex items-center space-x-1"
            title="Collapse all model answers"
          >
            <EyeOff className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Collapse</span>
          </button>
        </div>
      </div>

      {/* Questions List */}
      {filteredQuestions.length === 0 ? (
        <div className="p-12 text-center glass-panel bg-white/60 dark:bg-slate-900/60 rounded-2xl border border-slate-200 dark:border-slate-800 text-slate-500 text-xs">
          <p>No questions match your current filter or search criteria.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredQuestions.map((item, idx) => {
            const isExpanded = !!expandedIds[item.id];
            const badge = getMarksBadge(item.marks);
            const isCopied = copiedId === item.id;

            return (
              <div
                key={item.id}
                className="glass-panel bg-white/90 dark:bg-slate-900/90 rounded-2xl border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 shadow-sm transition-all overflow-hidden"
              >
                {/* Header row */}
                <div
                  onClick={() => toggleExpand(item.id)}
                  className="p-4 sm:p-5 cursor-pointer flex items-start justify-between gap-4 select-none"
                >
                  <div className="space-y-2 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`px-2.5 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border ${badge.bg}`}
                      >
                        {badge.label}
                      </span>

                      {item.frequency && (
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-900/60 flex items-center space-x-1">
                          <Flame className="w-3 h-3" />
                          <span>{item.frequency}</span>
                        </span>
                      )}

                      {item.keyTopics &&
                        item.keyTopics.map((kt, kIdx) => (
                          <span
                            key={kIdx}
                            className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                          >
                            {kt}
                          </span>
                        ))}
                    </div>

                    <h4 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white leading-snug">
                      <span className="text-brand-600 dark:text-brand-400 mr-1.5">
                        Q{idx + 1}.
                      </span>
                      {item.question}
                    </h4>
                  </div>

                  <div className="flex items-center space-x-2 flex-shrink-0 pt-1">
                    <button
                      type="button"
                      className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                    >
                      {isExpanded ? (
                        <ChevronUp className="w-5 h-5" />
                      ) : (
                        <ChevronDown className="w-5 h-5" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Model Answer Drawer */}
                {isExpanded && (
                  <div className="border-t border-slate-100 dark:border-slate-800/80 bg-slate-50/70 dark:bg-slate-950/40 p-4 sm:p-5 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center space-x-1.5">
                        <FileCheck className="w-3.5 h-3.5 text-emerald-500" />
                        <span>University Model Answer & Evaluation Key:</span>
                      </span>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCopyAnswer(item.id, item.answer);
                        }}
                        className="px-2.5 py-1 rounded-lg text-xs font-semibold border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center space-x-1 transition-colors"
                      >
                        {isCopied ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-500" />
                            <span className="text-emerald-600 dark:text-emerald-400">Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            <span>Copy Answer</span>
                          </>
                        )}
                      </button>
                    </div>

                    <div className="prose dark:prose-invert max-w-none text-xs sm:text-sm text-slate-800 dark:text-slate-200 leading-relaxed bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-sm">
                      <ReactMarkdown
                        components={{
                          strong: ({ node, ...props }) => (
                            <strong
                              className="font-bold text-slate-900 dark:text-white"
                              {...props}
                            />
                          ),
                          ul: ({ node, ...props }) => (
                            <ul
                              className="list-disc list-inside space-y-1.5 my-2"
                              {...props}
                            />
                          ),
                          ol: ({ node, ...props }) => (
                            <ol
                              className="list-decimal list-inside space-y-1.5 my-2"
                              {...props}
                            />
                          ),
                          code: ({ node, inline, ...props }) =>
                            inline ? (
                              <code
                                className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 font-mono text-[11px] text-brand-600 dark:text-brand-400"
                                {...props}
                              />
                            ) : (
                              <pre className="p-3 rounded-lg bg-slate-950 text-slate-100 overflow-x-auto my-2 text-xs font-mono">
                                <code {...props} />
                              </pre>
                            ),
                        }}
                      >
                        {item.answer}
                      </ReactMarkdown>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ExamQuestionBank;
