import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../services/api';
import QuizCard from '../components/quiz/QuizCard';
import QuizResults from '../components/quiz/QuizResults';
import {
  HelpCircle,
  Sparkles,
  BookOpen,
  Loader2,
  AlertCircle,
  History,
  CheckCircle2,
  Flame,
  Award,
  GraduationCap,
} from 'lucide-react';

const SUGGESTED_QUIZ_TOPICS = [
  'Database Management Systems (DBMS)',
  'Operating Systems',
  'Computer Networks',
  'Data Structures & Algorithms',
  'Machine Learning',
  'Software Engineering',
];

const QuizPage = () => {
  const [searchParams] = useSearchParams();
  const preselectedNoteId = searchParams.get('noteId');
  const queryTopic = searchParams.get('topic');

  const [notes, setNotes] = useState([]);
  const [selectedNoteId, setSelectedNoteId] = useState(preselectedNoteId || '');
  const [customText, setCustomText] = useState('');
  const [topicInput, setTopicInput] = useState(queryTopic || '');
  const [activeInputMode, setActiveInputMode] = useState(
    queryTopic ? 'topic' : preselectedNoteId ? 'note' : 'note'
  );

  // Quiz session state
  const [quizState, setQuizState] = useState('setup'); // 'setup' | 'active' | 'results'
  const [questions, setQuestions] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState([]);
  const [score, setScore] = useState(0);
  const [noteTitle, setNoteTitle] = useState('');
  const [analysisSummary, setAnalysisSummary] = useState('');
  const [importantTopics, setImportantTopics] = useState([]);

  // Loading & error states
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [truncationNotice, setTruncationNotice] = useState('');
  const [history, setHistory] = useState([]);

  useEffect(() => {
    const fetchNotesAndHistory = async () => {
      try {
        const [notesRes, historyRes] = await Promise.all([
          api.get('/notes'),
          api.get('/quiz/history'),
        ]);
        setNotes(notesRes.data.notes || []);
        setHistory(historyRes.data.history || []);

        if (preselectedNoteId) {
          setSelectedNoteId(preselectedNoteId);
          const found = notesRes.data.notes?.find((n) => n._id === preselectedNoteId);
          if (found) setNoteTitle(found.title);
        } else if (queryTopic) {
          setTopicInput(queryTopic);
          setNoteTitle(queryTopic);
          setActiveInputMode('topic');
        } else if (notesRes.data.notes?.length > 0) {
          setSelectedNoteId(notesRes.data.notes[0]._id);
          setNoteTitle(notesRes.data.notes[0].title);
        }
      } catch (err) {
        console.error('Failed to initialize quiz page:', err);
      }
    };

    fetchNotesAndHistory();
  }, [preselectedNoteId, queryTopic]);

  const handleStartQuiz = async () => {
    setError('');
    setLoading(true);

    try {
      let payload = {};
      if (activeInputMode === 'note') {
        if (!selectedNoteId) {
          setError('Please select a note from the dropdown.');
          setLoading(false);
          return;
        }
        payload = { noteId: selectedNoteId };
      } else if (activeInputMode === 'topic') {
        if (!topicInput.trim() || topicInput.trim().length < 2) {
          setError('Please enter a valid subject or topic name (e.g. "DBMS").');
          setLoading(false);
          return;
        }
        payload = { topic: topicInput.trim() };
      } else {
        if (!customText.trim() || customText.trim().length < 25) {
          setError('Please provide at least 25 characters of study notes to quiz on.');
          setLoading(false);
          return;
        }
        payload = { content: customText.trim(), noteTitle: 'Custom Study Session' };
      }

      const res = await api.post('/quiz/generate', payload);
      setQuestions(res.data.questions);
      setNoteTitle(res.data.noteTitle);
      setAnalysisSummary(res.data.analysisSummary || '');
      setImportantTopics(res.data.importantTopics || []);
      setTruncationNotice(res.data.truncationNotice || '');
      setCurrentIndex(0);
      setUserAnswers([]);
      setScore(0);
      setQuizState('active');
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to generate quiz.');
    } finally {
      setLoading(false);
    }
  };

  const handleAnswerSelected = (answerData) => {
    setUserAnswers((prev) => [...prev, answerData]);
    if (answerData.isCorrect) {
      setScore((prev) => prev + 1);
    }
  };

  const handleNextQuestion = async () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex((prev) => prev + 1);
    } else {
      // Finished all 10 questions -> save result
      const finalScore = userAnswers.filter((a) => a.isCorrect).length;
      try {
        await api.post('/quiz/save-result', {
          noteId: selectedNoteId || null,
          noteTitle,
          score: finalScore,
          totalQuestions: questions.length,
          questions: userAnswers,
        });

        // Refresh history in background
        api.get('/quiz/history').then((res) => setHistory(res.data.history));
      } catch (saveErr) {
        console.warn('Failed to save quiz result:', saveErr);
      }
      setQuizState('results');
    }
  };

  const handleRetake = () => {
    setCurrentIndex(0);
    setUserAnswers([]);
    setScore(0);
    setQuizState('active');
  };

  const handleNewQuiz = () => {
    setQuizState('setup');
    setQuestions([]);
    setUserAnswers([]);
    setScore(0);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center space-x-3">
          <HelpCircle className="w-8 h-8 text-purple-600 dark:text-purple-400" />
          <span>AI Quiz Arena</span>
        </h1>
        <p className="text-slate-600 dark:text-slate-400 mt-2 text-sm sm:text-base">
          Challenge your understanding with 10 AI-generated multiple choice questions with instant scoring.
        </p>
        {/* Visible Disclaimer */}
        <div className="mt-3 inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 text-amber-800 dark:text-amber-300 text-xs">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>
            <strong>Disclaimer:</strong> Quiz questions are AI-generated based on syllabus topics to assist with self-assessment and practice.
          </span>
        </div>
      </div>

      {quizState === 'setup' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Main Setup Card (7 cols) */}
          <div className="lg:col-span-7 glass-panel bg-white/80 dark:bg-slate-900/80 rounded-3xl p-6 sm:p-8 border border-slate-200 dark:border-slate-800 shadow-xl">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center space-x-2 mb-6">
              <Sparkles className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              <span>Configure Your 10-Question Quiz</span>
            </h2>

            {error && (
              <div className="mb-6 p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 flex items-start space-x-3 text-rose-700 dark:text-rose-400 text-xs">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {/* Input Selection Tabs */}
            <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-xs font-semibold mb-6 overflow-x-auto">
              <button
                type="button"
                onClick={() => setActiveInputMode('note')}
                className={`flex-1 py-2 px-3 rounded-lg transition-all flex items-center justify-center space-x-1.5 flex-shrink-0 ${
                  activeInputMode === 'note'
                    ? 'bg-white dark:bg-slate-900 text-purple-600 dark:text-purple-400 shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <BookOpen className="w-4 h-4" />
                <span>From Saved Notes</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveInputMode('topic')}
                className={`flex-1 py-2 px-3 rounded-lg transition-all flex items-center justify-center space-x-1.5 flex-shrink-0 ${
                  activeInputMode === 'topic'
                    ? 'bg-white dark:bg-slate-900 text-purple-600 dark:text-purple-400 shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <GraduationCap className="w-4 h-4" />
                <span>Type Topic</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveInputMode('custom')}
                className={`flex-1 py-2 px-3 rounded-lg transition-all flex items-center justify-center space-x-1.5 flex-shrink-0 ${
                  activeInputMode === 'custom'
                    ? 'bg-white dark:bg-slate-900 text-purple-600 dark:text-purple-400 shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Sparkles className="w-4 h-4" />
                <span>Paste Notes</span>
              </button>
            </div>

            {activeInputMode === 'note' ? (
              <div className="space-y-4 mb-6">
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  Select Note Material
                </label>
                {notes.length === 0 ? (
                  <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-xl text-xs text-slate-500">
                    No notes found. Upload a note in the Notes section or switch to "Type Topic" above.
                  </div>
                ) : (
                  <select
                    value={selectedNoteId}
                    onChange={(e) => {
                      setSelectedNoteId(e.target.value);
                      const f = notes.find((n) => n._id === e.target.value);
                      if (f) setNoteTitle(f.title);
                    }}
                    className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white text-xs font-medium focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    {notes.map((n) => (
                      <option key={n._id} value={n._id}>
                        {n.title} ({new Date(n.createdAt).toLocaleDateString()})
                      </option>
                    ))}
                  </select>
                )}
              </div>
            ) : activeInputMode === 'topic' ? (
              <div className="space-y-4 mb-6">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                    Subject or Syllabus Topic Name
                  </label>
                  <input
                    type="text"
                    value={topicInput}
                    onChange={(e) => setTopicInput(e.target.value)}
                    placeholder="e.g. Database Management Systems (DBMS), Operating Systems..."
                    className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500 text-xs font-medium"
                  />
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                    Questions are AI-generated based on core syllabus concepts and key curriculum topics.
                  </p>
                </div>

                {/* Quick Topic Chips */}
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-1.5">
                    Popular Subjects (Click to Select):
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {SUGGESTED_QUIZ_TOPICS.map((top) => (
                      <button
                        key={top}
                        type="button"
                        onClick={() => setTopicInput(top)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all ${
                          topicInput === top
                            ? 'bg-purple-600 text-white shadow-sm'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-purple-50 dark:hover:bg-purple-950/40 hover:text-purple-600'
                        }`}
                      >
                        {top}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4 mb-6">
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  Study Content / Concepts to Quiz
                </label>
                <textarea
                  rows={6}
                  value={customText}
                  onChange={(e) => setCustomText(e.target.value)}
                  placeholder="Paste lecture content, textbook chapter, or key bullet points to generate questions from..."
                  className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500 text-xs resize-y"
                />
              </div>
            )}

            <button
              type="button"
              disabled={
                loading ||
                (activeInputMode === 'note' && !selectedNoteId) ||
                (activeInputMode === 'topic' && !topicInput.trim()) ||
                (activeInputMode === 'custom' && !customText.trim())
              }
              onClick={handleStartQuiz}
              className="w-full py-3.5 px-6 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-semibold text-sm shadow-lg shadow-purple-500/25 flex items-center justify-center space-x-2 transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>
                    {activeInputMode === 'topic'
                      ? `Generating quiz for "${topicInput}" with Gemini...`
                      : 'Analyzing & Generating 10 MCQs with Gemini...'}
                  </span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>
                    {activeInputMode === 'topic'
                      ? 'Generate Topic Quiz'
                      : 'Generate & Start 10-Question Quiz'}
                  </span>
                </>
              )}
            </button>
          </div>

          {/* Past Quiz History Sidebar (5 cols) */}
          <div className="lg:col-span-5 glass-panel bg-white/80 dark:bg-slate-900/80 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center space-x-2 mb-4">
              <History className="w-4 h-4 text-purple-500" />
              <span>Past Quiz Scores ({history.length})</span>
            </h3>

            {history.length === 0 ? (
              <p className="text-xs text-slate-500 py-6 text-center">
                No quizzes completed yet. Generate your first quiz!
              </p>
            ) : (
              <div className="space-y-3 max-h-[380px] overflow-y-auto pr-1">
                {history.map((item) => (
                  <div
                    key={item._id}
                    className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 flex items-center justify-between"
                  >
                    <div>
                      <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate max-w-[200px]">
                        {item.noteTitle}
                      </p>
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        {new Date(item.createdAt).toLocaleDateString()} • {item.score} / {item.totalQuestions} Correct
                      </p>
                    </div>
                    <span
                      className={`px-2.5 py-1 rounded-xl text-xs font-bold ${
                        item.percentage >= 80
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                          : item.percentage >= 60
                          ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                          : 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300'
                      }`}
                    >
                      {item.percentage}%
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {quizState === 'active' && questions.length > 0 && (
        <div className="space-y-4">
          {/* AI Quiz Question Arena Header Banner */}
          <div className="max-w-3xl mx-auto p-4 rounded-2xl bg-gradient-to-r from-purple-900/80 via-indigo-900/80 to-slate-900/90 text-white border border-purple-500/20 shadow-md flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center space-x-2.5">
              <div className="w-8 h-8 rounded-lg bg-amber-400/20 text-amber-300 flex items-center justify-center">
                <Flame className="w-4 h-4" />
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-300 block">
                  AI Quiz Question Arena
                </span>
                <span className="text-xs font-semibold text-white">
                  {noteTitle || 'Study Session'}
                </span>
              </div>
            </div>

            <span className="px-2.5 py-1 rounded-full text-[10px] font-semibold bg-white/10 text-slate-200 border border-white/10">
              10 MCQs with Model Explanations
            </span>
          </div>

          {analysisSummary && (
            <div className="max-w-3xl mx-auto p-3.5 rounded-xl bg-purple-50/70 dark:bg-purple-950/30 border border-purple-200/70 dark:border-purple-900/50 text-xs text-purple-900 dark:text-purple-200 leading-relaxed">
              <span className="font-bold mr-1">Topic Summary:</span>
              {analysisSummary}
            </div>
          )}

          {truncationNotice && (
            <div className="max-w-3xl mx-auto p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 flex items-start space-x-2.5 text-amber-700 dark:text-amber-400 text-xs">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{truncationNotice}</span>
            </div>
          )}

          <QuizCard
            questionData={questions[currentIndex]}
            currentIndex={currentIndex}
            totalQuestions={questions.length}
            onAnswerSelected={handleAnswerSelected}
            onNextQuestion={handleNextQuestion}
            isLastQuestion={currentIndex === questions.length - 1}
          />
        </div>
      )}

      {quizState === 'results' && (
        <QuizResults
          score={score}
          totalQuestions={questions.length}
          questionsWithAnswers={userAnswers}
          noteTitle={noteTitle}
          noteId={selectedNoteId}
          analysisSummary={analysisSummary}
          importantTopics={importantTopics}
          onRetake={handleRetake}
          onNewQuiz={handleNewQuiz}
        />
      )}
    </div>
  );
};

export default QuizPage;
