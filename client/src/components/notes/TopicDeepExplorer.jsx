import React, { useState, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import { useNavigate } from 'react-router-dom';
import {
  Sparkles,
  BookOpen,
  Award,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Copy,
  Check,
  HelpCircle,
  Layers,
  Flame,
  Tag,
  Search,
  Code,
  FileText,
  Compass,
  ArrowRight,
  Bookmark,
  CheckCircle2,
} from 'lucide-react';

const TopicDeepExplorer = ({
  topic = 'Subject Analysis',
  overview = '',
  modules = [],
  sixteenMarks = [],
  noteId = null,
  onNavigateQuiz,
  onNavigateFlashcards,
}) => {
  const navigate = useNavigate();

  // Active module index or special tab ('16m' | 'full')
  const [selectedModuleId, setSelectedModuleId] = useState(modules[0]?.id || 'module-1');
  const [subTab, setSubTab] = useState('notes'); // 'notes' | '2m' | '8m'
  const [searchModuleQuery, setSearchModuleQuery] = useState('');
  const [copiedNote, setCopiedNote] = useState(false);
  const [copiedQuestionId, setCopiedQuestionId] = useState(null);
  const [expandedQuestions, setExpandedQuestions] = useState({});

  // Filter modules based on search
  const filteredModules = useMemo(() => {
    if (!searchModuleQuery.trim()) return modules;
    const q = searchModuleQuery.toLowerCase();
    return modules.filter(
      (m) =>
        m.title?.toLowerCase().includes(q) ||
        m.keyConcepts?.some((c) => c.toLowerCase().includes(q)) ||
        m.notes?.toLowerCase().includes(q)
    );
  }, [modules, searchModuleQuery]);

  // Active module object
  const activeModule = useMemo(() => {
    return modules.find((m) => m.id === selectedModuleId) || modules[0] || null;
  }, [modules, selectedModuleId]);

  const toggleQuestionExpand = (id) => {
    setExpandedQuestions((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleCopy = async (text, id = null) => {
    try {
      await navigator.clipboard.writeText(text);
      if (id) {
        setCopiedQuestionId(id);
        setTimeout(() => setCopiedQuestionId(null), 2000);
      } else {
        setCopiedNote(true);
        setTimeout(() => setCopiedNote(false), 2000);
      }
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
    }
  };

  const handleStartQuiz = (topicContext) => {
    if (onNavigateQuiz) {
      onNavigateQuiz(topicContext);
    } else {
      const target = topicContext || topic;
      navigate(noteId ? `/quiz?noteId=${noteId}` : `/quiz?topic=${encodeURIComponent(target)}`);
    }
  };

  const handleStartFlashcards = (topicContext) => {
    if (onNavigateFlashcards) {
      onNavigateFlashcards(topicContext);
    } else {
      const target = topicContext || topic;
      navigate(noteId ? `/flashcards?noteId=${noteId}` : `/flashcards?topic=${encodeURIComponent(target)}`);
    }
  };

  if (!modules || modules.length === 0) {
    return (
      <div className="p-8 text-center bg-slate-50 dark:bg-slate-900/40 rounded-2xl border border-slate-200 dark:border-slate-800">
        <Sparkles className="w-8 h-8 text-brand-500 mx-auto mb-3" />
        <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
          No subtopic breakdown available for this topic yet.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Gemini Header & Overview Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 p-6 text-white border border-blue-500/30 shadow-lg">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-blue-500/20 border border-blue-400/30 text-blue-200 text-xs font-semibold uppercase tracking-wider mb-2 backdrop-blur-md">
              <Sparkles className="w-3.5 h-3.5 text-blue-300 animate-pulse" />
              <span>Gemini Deep Topic Analysis</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white flex items-center gap-2">
              <span>{topic}</span>
            </h2>
            <p className="text-xs text-blue-200/80 mt-1">
              Structured into <span className="font-bold text-white">{modules.length} Important Topics</span> aligned with standard engineering syllabus weightage.
            </p>
          </div>

          <div className="flex items-center space-x-2.5">
            <button
              onClick={() => handleStartQuiz(topic)}
              className="px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-semibold text-xs shadow-md shadow-purple-900/30 flex items-center space-x-1.5 transition-transform active:scale-95"
            >
              <HelpCircle className="w-3.5 h-3.5" />
              <span>Topic Quiz</span>
            </button>
            <button
              onClick={() => handleStartFlashcards(topic)}
              className="px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs shadow-md shadow-amber-900/30 flex items-center space-x-1.5 transition-transform active:scale-95"
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Flashcards</span>
            </button>
          </div>
        </div>

        {overview && (
          <div className="mt-4 pt-4 border-t border-white/10 text-xs text-slate-200/90 leading-relaxed bg-black/20 p-3.5 rounded-xl border border-white/5">
            <p>{overview}</p>
          </div>
        )}
      </div>

      {/* Main Grid: Left Subtopic Sidebar / Tabs & Right Content Area */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Side: Important Subtopics List */}
        <div className="lg:col-span-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center space-x-1.5">
              <Compass className="w-3.5 h-3.5 text-brand-500" />
              <span>Important Topics ({modules.length})</span>
            </h3>
            <span className="text-[11px] text-slate-400">Click to study</span>
          </div>

          {/* Quick Filter */}
          <div className="relative">
            <input
              type="text"
              value={searchModuleQuery}
              onChange={(e) => setSearchModuleQuery(e.target.value)}
              placeholder="Filter topics (e.g. operators, inheritance)..."
              className="w-full pl-8 pr-3 py-1.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 transition-all"
            />
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
          </div>

          {/* Topic Module Buttons */}
          <div className="space-y-2 max-h-[560px] overflow-y-auto pr-1">
            {filteredModules.map((mod, index) => {
              const isSelected = selectedModuleId === mod.id;
              return (
                <button
                  key={mod.id || index}
                  onClick={() => {
                    setSelectedModuleId(mod.id);
                  }}
                  className={`w-full text-left p-3.5 rounded-xl transition-all border flex flex-col justify-between group ${
                    isSelected
                      ? 'bg-blue-50/90 dark:bg-blue-950/40 border-blue-300 dark:border-blue-700/80 shadow-sm ring-1 ring-blue-500/20'
                      : 'bg-white/80 dark:bg-slate-900/80 hover:bg-slate-50 dark:hover:bg-slate-800/60 border-slate-200 dark:border-slate-800'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span
                      className={`text-xs font-bold transition-colors line-clamp-2 ${
                        isSelected
                          ? 'text-blue-700 dark:text-blue-300'
                          : 'text-slate-800 dark:text-slate-200 group-hover:text-brand-600 dark:group-hover:text-brand-400'
                      }`}
                    >
                      {index + 1}. {mod.title}
                    </span>
                    <ChevronRight
                      className={`w-4 h-4 flex-shrink-0 transition-transform ${
                        isSelected
                          ? 'text-blue-600 dark:text-blue-400 translate-x-0.5'
                          : 'text-slate-400 opacity-60'
                      }`}
                    />
                  </div>

                  <div className="mt-2 flex items-center justify-between text-[10px]">
                    <span className="text-amber-600 dark:text-amber-400 font-semibold flex items-center space-x-1">
                      <Flame className="w-3 h-3 flex-shrink-0" />
                      <span className="truncate max-w-[140px]">{mod.importance || 'High Weightage'}</span>
                    </span>
                    <span className="text-slate-400 dark:text-slate-500">
                      {mod.twoMarks?.length || 0} (2M) • {mod.eightMarks?.length || 0} (8M)
                    </span>
                  </div>
                </button>
              );
            })}

            {/* Special Section: 16-Mark University Essay Blueprint */}
            {sixteenMarks && sixteenMarks.length > 0 && (
              <button
                onClick={() => setSelectedModuleId('16m')}
                className={`w-full text-left p-3.5 rounded-xl transition-all border flex items-center justify-between group ${
                  selectedModuleId === '16m'
                    ? 'bg-amber-50/90 dark:bg-amber-950/40 border-amber-300 dark:border-amber-700 shadow-sm ring-1 ring-amber-500/20'
                    : 'bg-white/80 dark:bg-slate-900/80 hover:bg-slate-50 dark:hover:bg-slate-800/60 border-slate-200 dark:border-slate-800'
                }`}
              >
                <div className="flex items-center space-x-2.5">
                  <div className="w-7 h-7 rounded-lg bg-amber-100 dark:bg-amber-950/80 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold text-xs">
                    16M
                  </div>
                  <div>
                    <p
                      className={`text-xs font-bold ${
                        selectedModuleId === '16m'
                          ? 'text-amber-800 dark:text-amber-300'
                          : 'text-slate-800 dark:text-slate-200'
                      }`}
                    >
                      16-Mark Essay Blueprints
                    </p>
                    <p className="text-[10px] text-slate-400">
                      {sixteenMarks.length} Comprehensive Essay Questions
                    </p>
                  </div>
                </div>
                <Award className="w-4 h-4 text-amber-500" />
              </button>
            )}

            {/* Special Section: Full Master Syllabus View */}
            <button
              onClick={() => setSelectedModuleId('full')}
              className={`w-full text-left p-3 rounded-xl transition-all border flex items-center justify-between group ${
                selectedModuleId === 'full'
                  ? 'bg-indigo-50/90 dark:bg-indigo-950/40 border-indigo-300 dark:border-indigo-700 shadow-sm ring-1 ring-indigo-500/20'
                  : 'bg-white/80 dark:bg-slate-900/80 hover:bg-slate-50 dark:hover:bg-slate-800/60 border-slate-200 dark:border-slate-800'
              }`}
            >
              <div className="flex items-center space-x-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
                <FileText className="w-4 h-4 text-indigo-500" />
                <span>View Full Master Syllabus</span>
              </div>
              <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
            </button>
          </div>
        </div>

        {/* Right Side: Active Subtopic Workspace */}
        <div className="lg:col-span-8">
          {selectedModuleId === '16m' ? (
            /* 16-Mark Essay Blueprint Workspace */
            <div className="glass-panel bg-white/90 dark:bg-slate-900/90 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-6">
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-950/80 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold text-sm">
                    16M
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                      16-Mark University Essay Questions (Part C)
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Highest weightage comprehensive questions with architectural blueprints and model answers.
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-5">
                {sixteenMarks.map((item, idx) => {
                  const qId = `16m-${idx}`;
                  const isExpanded = expandedQuestions[qId] !== false; // default open
                  return (
                    <div
                      key={idx}
                      className="border border-amber-200/80 dark:border-amber-900/50 rounded-2xl bg-amber-50/20 dark:bg-amber-950/10 p-5 space-y-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300">
                            {item.frequency || 'Compulsory University Question'}
                          </span>
                          <h4 className="text-sm font-bold text-slate-900 dark:text-white leading-snug">
                            Q{idx + 1}. {item.question}
                          </h4>
                        </div>

                        <div className="flex items-center space-x-1 flex-shrink-0">
                          <button
                            onClick={() => handleCopy(item.answer, qId)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-white dark:hover:bg-slate-800 text-xs transition-colors"
                            title="Copy model answer"
                          >
                            {copiedQuestionId === qId ? (
                              <Check className="w-4 h-4 text-emerald-500" />
                            ) : (
                              <Copy className="w-4 h-4" />
                            )}
                          </button>
                          <button
                            onClick={() => toggleQuestionExpand(qId)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-white dark:hover:bg-slate-800 transition-colors"
                          >
                            {isExpanded ? (
                              <ChevronUp className="w-4 h-4" />
                            ) : (
                              <ChevronDown className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="pt-3 border-t border-amber-200/60 dark:border-amber-900/40 text-xs sm:text-sm text-slate-800 dark:text-slate-200 prose dark:prose-invert max-w-none leading-relaxed">
                          <ReactMarkdown>{item.answer}</ReactMarkdown>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : selectedModuleId === 'full' ? (
            /* Full Master Syllabus View */
            <div className="glass-panel bg-white/90 dark:bg-slate-900/90 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-6">
              <div className="border-b border-slate-200 dark:border-slate-800 pb-4">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  {topic}: Complete Syllabus Master Notes
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Sequential lecture guide incorporating all {modules.length} core modules.
                </p>
              </div>

              <div className="space-y-8 divide-y divide-slate-100 dark:divide-slate-800">
                {modules.map((m, idx) => (
                  <div key={m.id || idx} className={idx > 0 ? 'pt-6' : ''}>
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-bold text-brand-600 dark:text-brand-400 uppercase tracking-wider">
                        Module {idx + 1}
                      </span>
                      <span className="text-[11px] text-amber-600 dark:text-amber-400 font-semibold">
                        {m.importance}
                      </span>
                    </div>
                    <h4 className="text-base font-bold text-slate-900 dark:text-white mb-2">
                      {m.title}
                    </h4>
                    <div className="prose dark:prose-invert max-w-none text-xs sm:text-sm leading-relaxed text-slate-800 dark:text-slate-200">
                      <ReactMarkdown>{m.notes}</ReactMarkdown>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : activeModule ? (
            /* Active Module Notes & Questions */
            <div className="glass-panel bg-white/90 dark:bg-slate-900/90 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-5">
              {/* Module Header */}
              <div className="border-b border-slate-200 dark:border-slate-800 pb-4">
                <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
                  <div className="flex items-center space-x-2">
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                      Important Module
                    </span>
                    <span className="text-xs text-amber-600 dark:text-amber-400 font-semibold flex items-center space-x-1">
                      <Flame className="w-3.5 h-3.5" />
                      <span>{activeModule.importance}</span>
                    </span>
                  </div>

                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => handleCopy(activeModule.notes)}
                      className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-medium flex items-center space-x-1.5 transition-colors"
                      title="Copy lecture notes"
                    >
                      {copiedNote ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-500" />
                          <span className="text-emerald-600 dark:text-emerald-400">Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Copy Notes</span>
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => handleStartQuiz(`${topic} - ${activeModule.title}`)}
                      className="px-2.5 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-medium text-xs flex items-center space-x-1 shadow-sm transition-transform active:scale-95"
                    >
                      <HelpCircle className="w-3.5 h-3.5" />
                      <span>Quiz</span>
                    </button>
                  </div>
                </div>

                <h3 className="text-xl font-extrabold text-slate-900 dark:text-white">
                  {activeModule.title}
                </h3>

                {/* Key Concepts Pills */}
                {activeModule.keyConcepts && activeModule.keyConcepts.length > 0 && (
                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    {activeModule.keyConcepts.map((concept, cIdx) => (
                      <span
                        key={cIdx}
                        className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700/60"
                      >
                        #{concept}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Sub-tabs: Notes vs 2M vs 8M */}
              <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-xs font-semibold overflow-x-auto">
                <button
                  type="button"
                  onClick={() => setSubTab('notes')}
                  className={`px-4 py-2 rounded-lg transition-all flex items-center space-x-1.5 flex-shrink-0 ${
                    subTab === 'notes'
                      ? 'bg-white dark:bg-slate-900 text-brand-600 dark:text-brand-400 shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <BookOpen className="w-3.5 h-3.5" />
                  <span>Study Lecture Notes</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSubTab('2m')}
                  className={`px-4 py-2 rounded-lg transition-all flex items-center space-x-1.5 flex-shrink-0 ${
                    subTab === '2m'
                      ? 'bg-white dark:bg-slate-900 text-sky-600 dark:text-sky-400 shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <Award className="w-3.5 h-3.5 text-sky-500" />
                  <span>2 Marks Questions ({activeModule.twoMarks?.length || 0})</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSubTab('8m')}
                  className={`px-4 py-2 rounded-lg transition-all flex items-center space-x-1.5 flex-shrink-0 ${
                    subTab === '8m'
                      ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <Award className="w-3.5 h-3.5 text-indigo-500" />
                  <span>8 Marks Questions ({activeModule.eightMarks?.length || 0})</span>
                </button>
              </div>

              {/* Subtab Content */}
              <div className="pt-2">
                {subTab === 'notes' ? (
                  /* Markdown Lecture Notes */
                  <div className="prose dark:prose-invert max-w-none text-xs sm:text-sm text-slate-800 dark:text-slate-200 leading-relaxed overflow-x-auto">
                    <ReactMarkdown
                      components={{
                        h3: ({ node, ...props }) => (
                          <h3
                            className="text-base font-bold text-slate-900 dark:text-white mt-5 mb-2.5 border-b border-slate-100 dark:border-slate-800 pb-1 flex items-center space-x-2"
                            {...props}
                          />
                        ),
                        h4: ({ node, ...props }) => (
                          <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-100 mt-4 mb-1.5" {...props} />
                        ),
                        code: ({ node, inline, ...props }) =>
                          inline ? (
                            <code
                              className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 font-mono text-xs text-brand-600 dark:text-brand-400"
                              {...props}
                            />
                          ) : (
                            <pre className="p-3.5 rounded-xl bg-slate-900 text-slate-100 font-mono text-xs overflow-x-auto border border-slate-800 my-3">
                              <code {...props} />
                            </pre>
                          ),
                      }}
                    >
                      {activeModule.notes}
                    </ReactMarkdown>
                  </div>
                ) : subTab === '2m' ? (
                  /* 2-Mark Questions */
                  <div className="space-y-4">
                    {(!activeModule.twoMarks || activeModule.twoMarks.length === 0) ? (
                      <p className="text-xs text-slate-500 dark:text-slate-400 italic">
                        No 2-mark questions generated for this module.
                      </p>
                    ) : (
                      activeModule.twoMarks.map((q, idx) => {
                        const qId = `${activeModule.id}-2m-${idx}`;
                        const isExpanded = expandedQuestions[qId] !== false; // default expanded
                        return (
                          <div
                            key={idx}
                            className="p-4 rounded-xl border border-sky-100 dark:border-sky-900/40 bg-sky-50/20 dark:bg-sky-950/10 space-y-2.5"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="space-y-1">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-sky-700 dark:text-sky-300 bg-sky-100 dark:bg-sky-900/60 px-2 py-0.5 rounded">
                                  2 Marks • {q.frequency || 'Frequently Asked'}
                                </span>
                                <p className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                                  Q{idx + 1}. {q.question}
                                </p>
                              </div>

                              <button
                                onClick={() => handleCopy(q.answer, qId)}
                                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                                title="Copy model answer"
                              >
                                {copiedQuestionId === qId ? (
                                  <Check className="w-3.5 h-3.5 text-emerald-500" />
                                ) : (
                                  <Copy className="w-3.5 h-3.5" />
                                )}
                              </button>
                            </div>

                            <div className="p-3 bg-white dark:bg-slate-900/90 rounded-lg border border-slate-100 dark:border-slate-800 text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                              <span className="font-bold text-sky-700 dark:text-sky-400 block mb-1">
                                Model Answer:
                              </span>
                              <ReactMarkdown>{q.answer}</ReactMarkdown>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                ) : (
                  /* 8-Mark Questions */
                  <div className="space-y-4">
                    {(!activeModule.eightMarks || activeModule.eightMarks.length === 0) ? (
                      <p className="text-xs text-slate-500 dark:text-slate-400 italic">
                        No 8-mark questions generated for this module.
                      </p>
                    ) : (
                      activeModule.eightMarks.map((q, idx) => {
                        const qId = `${activeModule.id}-8m-${idx}`;
                        const isExpanded = expandedQuestions[qId] !== false; // default expanded
                        return (
                          <div
                            key={idx}
                            className="p-4 rounded-xl border border-indigo-100 dark:border-indigo-900/40 bg-indigo-50/20 dark:bg-indigo-950/10 space-y-2.5"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="space-y-1">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-300 bg-indigo-100 dark:bg-indigo-900/60 px-2 py-0.5 rounded">
                                  8 Marks • {q.frequency || 'Core syllabus topic'}
                                </span>
                                <p className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                                  Q{idx + 1}. {q.question}
                                </p>
                              </div>

                              <button
                                onClick={() => handleCopy(q.answer, qId)}
                                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                                title="Copy model answer"
                              >
                                {copiedQuestionId === qId ? (
                                  <Check className="w-3.5 h-3.5 text-emerald-500" />
                                ) : (
                                  <Copy className="w-3.5 h-3.5" />
                                )}
                              </button>
                            </div>

                            <div className="p-3 bg-white dark:bg-slate-900/90 rounded-lg border border-slate-100 dark:border-slate-800 text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-relaxed prose dark:prose-invert max-w-none">
                              <span className="font-bold text-indigo-700 dark:text-indigo-400 block mb-1">
                                Structured Model Answer:
                              </span>
                              <ReactMarkdown>{q.answer}</ReactMarkdown>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default TopicDeepExplorer;
