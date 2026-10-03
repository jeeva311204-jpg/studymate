import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import api from '../services/api';
import ExamQuestionBank from '../components/questions/ExamQuestionBank';
import {
  Award,
  Sparkles,
  Search,
  BookOpen,
  HelpCircle,
  Layers,
  Loader2,
  AlertCircle,
  Flame,
  GraduationCap,
  FileText,
  ArrowRight,
} from 'lucide-react';

const SUGGESTED_TOPICS = [
  'Java Programming Language',
  'Database Management Systems (DBMS)',
  'Operating Systems',
  'Computer Networks',
  'Data Structures & Algorithms',
  'Python Programming',
  'Machine Learning',
  'Software Engineering',
  'Compiler Design',
  'Cloud Computing',
];

const QuestionsPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryNoteId = searchParams.get('noteId');
  const queryTopic = searchParams.get('topic');

  const [mode, setMode] = useState('topic'); // 'topic' | 'note'
  const [topicInput, setTopicInput] = useState(queryTopic || '');
  const [notes, setNotes] = useState([]);
  const [selectedNoteId, setSelectedNoteId] = useState(queryNoteId || '');
  const [questionBank, setQuestionBank] = useState(null);
  const [activeTopicName, setActiveTopicName] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingNotes, setLoadingNotes] = useState(false);
  const [error, setError] = useState('');

  // Fetch student's notes for selection
  useEffect(() => {
    const fetchNotes = async () => {
      setLoadingNotes(true);
      try {
        const res = await api.get('/notes');
        setNotes(res.data.notes || []);
      } catch (err) {
        console.error('Failed to load notes for question selector:', err);
      } finally {
        setLoadingNotes(false);
      }
    };
    fetchNotes();
  }, []);

  // Handle URL query params
  useEffect(() => {
    if (queryNoteId) {
      setMode('note');
      setSelectedNoteId(queryNoteId);
      loadQuestionsForNote(queryNoteId);
    } else if (queryTopic) {
      setMode('topic');
      setTopicInput(queryTopic);
      generateForTopic(queryTopic);
    }
  }, [queryNoteId, queryTopic]);

  const loadQuestionsForNote = async (noteId) => {
    setLoading(true);
    setError('');
    try {
      // First check if note already has questions
      const res = await api.get(`/questions/note/${noteId}`);
      if (res.data?.questionBank) {
        setQuestionBank(res.data.questionBank);
        setActiveTopicName(res.data.noteTitle || 'Selected Note');
      } else {
        // Generate on demand
        const genRes = await api.post('/questions/generate', { noteId });
        setQuestionBank(genRes.data.questionBank);
        setActiveTopicName(genRes.data.noteTitle || 'Selected Note');
      }
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Failed to load exam questions for note.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const generateForTopic = async (topicToUse) => {
    const cleanTopic = (topicToUse || topicInput).trim();
    if (!cleanTopic || cleanTopic.length < 2) {
      setError('Please enter a valid subject or topic name (e.g. "DBMS").');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const res = await api.post('/questions/generate', { topic: cleanTopic });
      setQuestionBank(res.data.questionBank);
      setActiveTopicName(cleanTopic);
    } catch (err) {
      const msg =
        err.response?.data?.message || err.message || 'Failed to generate AI-predicted exam questions.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleTopicSubmit = (e) => {
    e.preventDefault();
    generateForTopic();
  };

  const handleNoteSelect = (noteId) => {
    setSelectedNoteId(noteId);
    if (noteId) {
      loadQuestionsForNote(noteId);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 animate-fadeIn">
      {/* Hero Header */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-indigo-700 via-purple-700 to-brand-700 p-8 sm:p-10 text-white shadow-xl shadow-indigo-500/20">
        <div className="relative z-10 max-w-3xl space-y-3">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-white/20 backdrop-blur-md text-xs font-semibold uppercase tracking-wider">
            <Flame className="w-3.5 h-3.5 text-amber-300" />
            <span>AI-Predicted Likely Exam Questions Engine</span>
          </div>

          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
            Semester Exam Question Bank
          </h1>

          <p className="text-slate-100/90 text-sm sm:text-base leading-relaxed">
            Generate AI-predicted likely semester exam questions structured into <strong>Part A (2 Marks)</strong>, <strong>Part B (8 Marks)</strong>, and <strong>Part C (16 Marks)</strong> with full academic model answers and syllabus relevance.
          </p>

          {/* Visible Disclaimer Banner */}
          <div className="flex items-start space-x-2.5 p-3.5 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 text-xs text-amber-200">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-amber-300" />
            <p>
              <strong>Disclaimer:</strong> All questions, suggested marks, and model answers are AI-predicted based on academic syllabus curriculum patterns for practice and revision, not official university past examination papers.
            </p>
          </div>

          {/* Mode Switcher */}
          <div className="pt-2 flex flex-wrap gap-2">
            <button
              onClick={() => setMode('topic')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center space-x-2 ${
                mode === 'topic'
                  ? 'bg-white text-indigo-700 shadow-md'
                  : 'bg-white/10 hover:bg-white/20 text-white border border-white/20'
              }`}
            >
              <GraduationCap className="w-4 h-4" />
              <span>Type Subject / Topic (e.g. DBMS)</span>
            </button>

            <button
              onClick={() => setMode('note')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center space-x-2 ${
                mode === 'note'
                  ? 'bg-white text-indigo-700 shadow-md'
                  : 'bg-white/10 hover:bg-white/20 text-white border border-white/20'
              }`}
            >
              <BookOpen className="w-4 h-4" />
              <span>Select from Uploaded Notes</span>
            </button>
          </div>
        </div>
      </div>

      {/* Input Section */}
      <div className="glass-panel bg-white/80 dark:bg-slate-900/80 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm">
        {mode === 'topic' ? (
          <form onSubmit={handleTopicSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-2">
                Type Subject or Topic Name:
              </label>
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                  <input
                    type="text"
                    value={topicInput}
                    onChange={(e) => setTopicInput(e.target.value)}
                    placeholder="e.g. Database Management Systems (DBMS), Operating Systems, Computer Networks..."
                    className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-medium transition-all"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading || !topicInput.trim()}
                  className="px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs shadow-md shadow-indigo-500/20 flex items-center justify-center space-x-2 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Generating Exam Questions...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 text-amber-300" />
                      <span>Generate Likely Question Bank</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Quick Topic Chips */}
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-2">
                Popular University Subjects (Click to Analyze):
              </span>
              <div className="flex flex-wrap gap-2">
                {SUGGESTED_TOPICS.map((top) => (
                  <button
                    key={top}
                    type="button"
                    onClick={() => {
                      setTopicInput(top);
                      generateForTopic(top);
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                      topicInput === top
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 hover:text-indigo-600'
                    }`}
                  >
                    {top}
                  </button>
                ))}
              </div>
            </div>
          </form>
        ) : (
          /* Select from uploaded notes */
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-2">
                Select from Your Saved Notes:
              </label>

              {loadingNotes ? (
                <div className="py-6 flex items-center justify-center space-x-2 text-slate-500 text-xs">
                  <Loader2 className="w-4 h-4 animate-spin text-brand-600" />
                  <span>Loading your notes library...</span>
                </div>
              ) : notes.length === 0 ? (
                <div className="p-6 text-center text-slate-500 text-xs border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
                  <p>You haven't uploaded any notes yet.</p>
                  <button
                    onClick={() => navigate('/notes')}
                    className="mt-2 text-brand-600 font-semibold hover:underline"
                  >
                    Upload your first document or paste text
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {notes.map((n) => (
                    <div
                      key={n._id}
                      onClick={() => handleNoteSelect(n._id)}
                      className={`p-4 rounded-xl border cursor-pointer transition-all ${
                        selectedNoteId === n._id
                          ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/30 ring-2 ring-indigo-500/20'
                          : 'border-slate-200 dark:border-slate-800 hover:border-indigo-400 bg-slate-50/50 dark:bg-slate-800/40'
                      }`}
                    >
                      <div className="flex items-center space-x-2.5">
                        <div className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center flex-shrink-0">
                          <FileText className="w-4 h-4" />
                        </div>
                        <div className="truncate">
                          <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                            {n.title}
                          </p>
                          <p className="text-[10px] text-slate-400">
                            {new Date(n.createdAt).toLocaleDateString()} • {n.sourceType.toUpperCase()}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {error && (
          <div className="mt-4 p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 flex items-start space-x-2.5 text-rose-700 dark:text-rose-400 text-xs">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}
      </div>

      {/* Loading State Animation */}
      {loading && (
        <div className="glass-panel bg-white/80 dark:bg-slate-900/80 rounded-3xl p-16 text-center flex flex-col items-center justify-center border border-slate-200 dark:border-slate-800 shadow-sm animate-pulse">
          <div className="w-16 h-16 rounded-2xl bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mb-4">
            <Loader2 className="w-8 h-8 animate-spin" />
          </div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">
            Generating AI-Predicted Likely Exam Questions...
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 max-w-md">
            Gemini AI is examining standard semester curriculum patterns, structuring mark distributions (2, 8, and 16 Marks), and synthesizing comprehensive university-grade model answers.
          </p>
        </div>
      )}

      {/* Render Question Bank */}
      {!loading && questionBank && (
        <div className="space-y-6">
          {/* Quick Cross-Functional Jump Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div
              onClick={() => {
                const url = selectedNoteId
                  ? `/quiz?noteId=${selectedNoteId}`
                  : `/quiz?topic=${encodeURIComponent(activeTopicName)}`;
                navigate(url);
              }}
              className="p-4 rounded-2xl bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-900/60 cursor-pointer hover:border-purple-400 transition-all flex items-center justify-between group"
            >
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-purple-600 text-white flex items-center justify-center shadow-sm">
                  <HelpCircle className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                    Take Quiz on {activeTopicName}
                  </h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Test your memory with 10 instant multiple-choice questions
                  </p>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-purple-600 dark:text-purple-400 group-hover:translate-x-1 transition-transform" />
            </div>

            <div
              onClick={() => {
                const url = selectedNoteId
                  ? `/flashcards?noteId=${selectedNoteId}`
                  : `/flashcards?topic=${encodeURIComponent(activeTopicName)}`;
                navigate(url);
              }}
              className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/60 cursor-pointer hover:border-amber-400 transition-all flex items-center justify-between group"
            >
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-amber-600 text-white flex items-center justify-center shadow-sm">
                  <Layers className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                    Study Flashcards on {activeTopicName}
                  </h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Flip through 15 high-yield revision flashcards
                  </p>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-amber-600 dark:text-amber-400 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>

          <ExamQuestionBank
            questionBank={questionBank}
            topic={activeTopicName}
            noteId={selectedNoteId}
            onRegenerate={() => {
              if (selectedNoteId) {
                loadQuestionsForNote(selectedNoteId);
              } else {
                generateForTopic(activeTopicName);
              }
            }}
            isRegenerating={loading}
          />
        </div>
      )}
    </div>
  );
};

export default QuestionsPage;
