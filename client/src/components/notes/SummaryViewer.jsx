import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import {
  Sparkles,
  Copy,
  Check,
  RefreshCw,
  Trash2,
  HelpCircle,
  Layers,
  FileText,
  Calendar,
  Loader2,
  AlertCircle,
  Award,
  Flame,
  Compass,
} from 'lucide-react';
import ExamQuestionBank from '../questions/ExamQuestionBank';
import TopicDeepExplorer from './TopicDeepExplorer';

const SummaryViewer = ({ note, onNoteUpdated, onNoteDeleted }) => {
  const [copied, setCopied] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [generatingQuestions, setGeneratingQuestions] = useState(false);
  const [analyzingTopics, setAnalyzingTopics] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState(
    note?.topicModules?.length > 0 || note?.sourceType === 'topic' ? 'topics' : 'summary'
  );
  const navigate = useNavigate();

  React.useEffect(() => {
    if (note?.topicModules?.length > 0 || note?.sourceType === 'topic') {
      setActiveTab('topics');
    } else {
      setActiveTab('summary');
    }
  }, [note?._id]);

  if (!note) {
    return (
      <div className="glass-panel bg-white/70 dark:bg-slate-900/70 rounded-2xl p-12 text-center border border-slate-200 dark:border-slate-800 flex flex-col items-center justify-center min-h-[420px]">
        <div className="w-16 h-16 rounded-2xl bg-brand-50 dark:bg-brand-950/40 text-brand-500 flex items-center justify-center mb-4">
          <FileText className="w-8 h-8 opacity-75" />
        </div>
        <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200">
          No Note Selected
        </h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 max-w-sm">
          Select a note from the library or upload a new PDF / text document on the left to view its AI summary and study tools.
        </p>
      </div>
    );
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(note.summary || note.rawContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (err) {
      console.error('Failed to copy text:', err);
    }
  };

  const handleRegenerate = async () => {
    setRegenerating(true);
    setError('');
    try {
      const res = await api.post(`/notes/${note._id}/summarize`);
      if (onNoteUpdated) {
        onNoteUpdated({ ...note, summary: res.data.summary });
      }
    } catch (err) {
      const msg =
        err.response?.data?.message || err.message || 'Failed to regenerate summary';
      setError(msg);
    } finally {
      setRegenerating(false);
    }
  };

  const handleGenerateQuestions = async () => {
    setGeneratingQuestions(true);
    setError('');
    try {
      const res = await api.post('/questions/generate', { noteId: note._id });
      if (onNoteUpdated && res.data?.questionBank) {
        onNoteUpdated({ ...note, examQuestions: res.data.questionBank });
      }
      setActiveTab('questions');
    } catch (err) {
      const msg =
        err.response?.data?.message || err.message || 'Failed to generate AI-predicted exam questions';
      setError(msg);
    } finally {
      setGeneratingQuestions(false);
    }
  };

  const handleAnalyzeTopics = async () => {
    setAnalyzingTopics(true);
    setError('');
    try {
      const res = await api.post(`/notes/${note._id}/analyze-topics`);
      if (onNoteUpdated && res.data?.note) {
        onNoteUpdated(res.data.note);
      }
      setActiveTab('topics');
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Failed to analyze topics with Gemini';
      setError(msg);
    } finally {
      setAnalyzingTopics(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(`Are you sure you want to delete "${note.title}"?`)) return;
    setDeleting(true);
    try {
      await api.delete(`/notes/${note._id}`);
      if (onNoteDeleted) {
        onNoteDeleted(note._id);
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to delete note');
      setDeleting(false);
    }
  };

  return (
    <div className="glass-panel bg-white/80 dark:bg-slate-900/80 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col">
      {/* Top Header */}
      <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-brand-50 dark:bg-brand-950/60 text-brand-600 dark:text-brand-400 border border-brand-200 dark:border-brand-800">
              {note.sourceType.toUpperCase()} NOTE
            </span>
            <span className="text-xs text-slate-400 flex items-center space-x-1">
              <Calendar className="w-3 h-3" />
              <span>{new Date(note.createdAt).toLocaleDateString()}</span>
            </span>
          </div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white mt-1.5 tracking-tight">
            {note.title}
          </h2>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center space-x-2">
          <button
            onClick={handleCopy}
            className="p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-medium transition-colors flex items-center space-x-1 border border-slate-200 dark:border-slate-700"
            title="Copy summary to clipboard"
          >
            {copied ? (
              <>
                <Check className="w-4 h-4 text-emerald-500" />
                <span className="text-emerald-600 dark:text-emerald-400">Copied</span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" />
                <span className="hidden sm:inline">Copy</span>
              </>
            )}
          </button>

          <button
            onClick={handleRegenerate}
            disabled={regenerating}
            className="p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-medium transition-colors flex items-center space-x-1 border border-slate-200 dark:border-slate-700 disabled:opacity-50"
            title="Regenerate AI summary"
          >
            <RefreshCw className={`w-4 h-4 ${regenerating ? 'animate-spin text-brand-500' : ''}`} />
            <span className="hidden sm:inline">Regenerate</span>
          </button>

          <button
            onClick={handleDelete}
            disabled={deleting}
            className="p-2 rounded-xl text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-xs font-medium transition-colors border border-rose-200 dark:border-rose-900/60 disabled:opacity-50"
            title="Delete this note"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Quick Launch Study Modes */}
      <div className="bg-slate-50/80 dark:bg-slate-800/40 px-5 py-3 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center space-x-3 overflow-x-auto">
          <button
            onClick={() => setActiveTab('topics')}
            className={`font-semibold pb-0.5 border-b-2 transition-all flex items-center space-x-1.5 flex-shrink-0 ${
              activeTab === 'topics'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Compass className="w-3.5 h-3.5 text-blue-500" />
            <span>Gemini Topics & Notes</span>
            {note.topicModules?.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 font-bold">
                {note.topicModules.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('summary')}
            className={`font-semibold pb-0.5 border-b-2 transition-all flex items-center space-x-1 flex-shrink-0 ${
              activeTab === 'summary'
                ? 'border-brand-600 text-brand-600 dark:text-brand-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>AI Summary</span>
          </button>

          <button
            onClick={() => setActiveTab('questions')}
            className={`font-semibold pb-0.5 border-b-2 transition-all flex items-center space-x-1 flex-shrink-0 ${
              activeTab === 'questions'
                ? 'border-brand-600 text-brand-600 dark:text-brand-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Award className="w-3.5 h-3.5 text-amber-500" />
            <span>Exam Questions (2, 8, 16M)</span>
            {note.examQuestions && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 font-bold">
                ✓
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('raw')}
            className={`font-semibold pb-0.5 border-b-2 transition-all flex items-center space-x-1 flex-shrink-0 ${
              activeTab === 'raw'
                ? 'border-brand-600 text-brand-600 dark:text-brand-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Original Notes</span>
          </button>
        </div>

        <div className="flex items-center space-x-2">
          {(!note.topicModules || note.topicModules.length === 0) && (
            <button
              onClick={handleAnalyzeTopics}
              disabled={analyzingTopics}
              className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium flex items-center space-x-1.5 shadow-sm transition-transform active:scale-95 disabled:opacity-50"
            >
              {analyzingTopics ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Compass className="w-3.5 h-3.5 text-blue-200" />
              )}
              <span>{analyzingTopics ? 'Analyzing...' : 'Analyze Topics'}</span>
            </button>
          )}

          <button
            onClick={() => {
              if (note.examQuestions) {
                setActiveTab('questions');
              } else {
                handleGenerateQuestions();
              }
            }}
            disabled={generatingQuestions}
            className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-medium flex items-center space-x-1.5 shadow-sm transition-transform active:scale-95 disabled:opacity-50"
          >
            {generatingQuestions ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Flame className="w-3.5 h-3.5 text-amber-300" />
            )}
            <span>
              {generatingQuestions
                ? 'Analyzing...'
                : note.examQuestions
                ? 'View Exam Qs'
                : 'Likely Qs Bank'}
            </span>
          </button>

          <button
            onClick={() => navigate(`/quiz?noteId=${note._id}`)}
            className="px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-medium flex items-center space-x-1.5 shadow-sm transition-transform active:scale-95"
          >
            <HelpCircle className="w-3.5 h-3.5" />
            <span>10 MCQs Quiz</span>
          </button>

          <button
            onClick={() => navigate(`/flashcards?noteId=${note._id}`)}
            className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-medium flex items-center space-x-1.5 shadow-sm transition-transform active:scale-95"
          >
            <Layers className="w-3.5 h-3.5" />
            <span>15 Flashcards</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="mx-6 mt-4 p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 flex items-start space-x-2.5 text-rose-700 dark:text-rose-400 text-xs">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {!note.summary && !regenerating && (
        <div className="mx-6 mt-4 p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 flex items-center justify-between gap-3 text-amber-800 dark:text-amber-300 text-xs">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>AI summary generation was not completed for this note.</span>
          </div>
          <button
            type="button"
            id="banner-retry-summary-btn"
            onClick={handleRegenerate}
            disabled={regenerating}
            className="px-3 py-1 bg-brand-600 hover:bg-brand-700 text-white rounded-lg font-semibold text-xs flex items-center space-x-1.5 transition-colors disabled:opacity-50"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Retry Summary</span>
          </button>
        </div>
      )}

      {note.rawContent?.length > 100000 && (
        <div className="mx-6 mt-4 p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 flex items-start space-x-2.5 text-amber-700 dark:text-amber-400 text-xs">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>Note text exceeds 100,000 characters. Only the first 100,000 characters were used for Gemini AI summary and analysis.</span>
        </div>
      )}

      {/* Main Content Area */}
      <div className="p-6 overflow-y-auto max-h-[750px] leading-relaxed">
        {regenerating ? (
          <div className="py-16 text-center flex flex-col items-center">
            <Loader2 className="w-8 h-8 text-brand-600 animate-spin mb-3" />
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
              Regenerating summary with Gemini...
            </p>
          </div>
        ) : activeTab === 'topics' ? (
          analyzingTopics ? (
            <div className="py-16 text-center flex flex-col items-center">
              <Loader2 className="w-10 h-10 text-blue-600 animate-spin mb-4" />
              <p className="text-base font-bold text-slate-900 dark:text-white">
                Gemini is Deeply Analyzing Subject Syllabus & Important Topics...
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 max-w-md">
                Breaking down core modules (e.g. Operators, Control Statements, Inheritance, Polymorphism for Java) with lecture notes, 2-mark definitions, and 8-mark analytical answers.
              </p>
            </div>
          ) : note.topicModules && note.topicModules.length > 0 ? (
            <TopicDeepExplorer
              topic={note.title.replace(/ - Comprehensive Study Guide.*$/, '')}
              overview={note.examQuestions?.analysisSummary || note.summary}
              modules={note.topicModules}
              sixteenMarks={note.examQuestions?.sixteenMarks || []}
              noteId={note._id}
            />
          ) : (
            <div className="py-12 px-4 text-center flex flex-col items-center justify-center border-2 border-dashed border-blue-200 dark:border-blue-900/60 rounded-2xl bg-blue-50/30 dark:bg-blue-950/20">
              <div className="w-14 h-14 rounded-2xl bg-blue-100 dark:bg-blue-950/80 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-3 shadow-inner">
                <Compass className="w-7 h-7" />
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Break Down Subject into Core Important Topics (Gemini AI)
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-1.5 max-w-md">
                Let Gemini identify and analyze the critical exam topics for this subject (e.g. Operators, Control Statements, Inheritance, Polymorphism), complete with structured notes and questions.
              </p>
              <button
                type="button"
                onClick={handleAnalyzeTopics}
                disabled={analyzingTopics}
                className="mt-5 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-md shadow-blue-500/20 flex items-center space-x-2 transition-all hover:scale-[1.02] active:scale-[0.98]"
              >
                <Sparkles className="w-4 h-4 text-amber-300" />
                <span>Analyze Important Topics with Gemini</span>
              </button>
            </div>
          )
        ) : activeTab === 'questions' ? (
          generatingQuestions ? (
            <div className="py-16 text-center flex flex-col items-center">
              <Loader2 className="w-10 h-10 text-indigo-600 animate-spin mb-4" />
              <p className="text-base font-bold text-slate-900 dark:text-white">
                Generating AI-Predicted Likely Exam Questions with Gemini AI...
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 max-w-md">
                Formulating Part A (2 Marks definitions), Part B (8 Marks analytical answers), and Part C (16 Marks essay questions) with model marking schemes.
              </p>
            </div>
          ) : note.examQuestions ? (
            <ExamQuestionBank
              questionBank={note.examQuestions}
              topic={note.title}
              noteId={note._id}
              onRegenerate={handleGenerateQuestions}
              isRegenerating={generatingQuestions}
            />
          ) : (
            <div className="py-12 px-4 text-center flex flex-col items-center justify-center border-2 border-dashed border-indigo-200 dark:border-indigo-900/60 rounded-2xl bg-indigo-50/30 dark:bg-indigo-950/20">
              <div className="w-14 h-14 rounded-2xl bg-indigo-100 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mb-3 shadow-inner">
                <Award className="w-7 h-7" />
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                AI-Predicted Exam Question Bank Not Yet Generated
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-1.5 max-w-md">
                Generate AI-predicted semester exam questions categorized by 2 Marks, 8 Marks, and 16 Marks, complete with full model evaluation answers and syllabus weightage.
              </p>
              <button
                type="button"
                onClick={handleGenerateQuestions}
                disabled={generatingQuestions}
                className="mt-5 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs shadow-md shadow-indigo-500/20 flex items-center space-x-2 transition-all hover:scale-[1.02] active:scale-[0.98]"
              >
                <Sparkles className="w-4 h-4 text-amber-300" />
                <span>Generate Likely Exam Question Bank</span>
              </button>
            </div>
          )
        ) : activeTab === 'summary' ? (
          !note.summary ? (
            <div className="py-12 px-6 text-center flex flex-col items-center justify-center border-2 border-dashed border-amber-300 dark:border-amber-700/60 rounded-2xl bg-amber-50/50 dark:bg-amber-950/20">
              <div className="w-14 h-14 rounded-2xl bg-amber-100 dark:bg-amber-900/60 text-amber-600 dark:text-amber-400 flex items-center justify-center mb-3 shadow-inner">
                <Sparkles className="w-7 h-7" />
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Summary Not Yet Available
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-2 max-w-md">
                The note was saved, but the AI summary generation failed or was skipped. Click below to retry summarizing.
              </p>
              <button
                type="button"
                id="retry-summary-btn"
                onClick={handleRegenerate}
                disabled={regenerating}
                className="mt-5 px-5 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-semibold text-xs shadow-md shadow-brand-500/20 flex items-center space-x-2 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${regenerating ? 'animate-spin' : ''}`} />
                <span>{regenerating ? 'Generating Summary...' : 'Retry Summary'}</span>
              </button>
            </div>
          ) : (
            <div className="prose dark:prose-invert max-w-none text-sm text-slate-800 dark:text-slate-200">
              <ReactMarkdown
                components={{
                  h3: ({ node, ...props }) => (
                    <h3
                      className="text-base font-bold text-slate-900 dark:text-white mt-6 mb-3 border-b border-slate-100 dark:border-slate-800 pb-1.5 flex items-center space-x-2"
                      {...props}
                    />
                  ),
                  ul: ({ node, ...props }) => (
                    <ul className="space-y-2 my-3 list-disc list-inside text-slate-700 dark:text-slate-300" {...props} />
                  ),
                  li: ({ node, ...props }) => (
                    <li className="leading-relaxed marker:text-brand-500" {...props} />
                  ),
                  strong: ({ node, ...props }) => (
                    <strong className="font-semibold text-brand-700 dark:text-brand-300" {...props} />
                  ),
                }}
              >
                {note.summary}
              </ReactMarkdown>
            </div>
          )
        ) : (
          <pre className="text-xs font-mono text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed bg-slate-50 dark:bg-slate-800/40 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
            {note.rawContent}
          </pre>
        )}
      </div>
    </div>
  );
};

export default SummaryViewer;
