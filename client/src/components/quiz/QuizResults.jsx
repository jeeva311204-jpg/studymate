import React, { useEffect, useState } from 'react';
import confetti from 'canvas-confetti';
import {
  Trophy,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Sparkles,
  ChevronDown,
  ChevronUp,
  LayoutDashboard,
  Layers,
  Award,
  Flame,
  BookOpen,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const QuizResults = ({
  score,
  totalQuestions,
  questionsWithAnswers,
  noteTitle,
  noteId,
  analysisSummary,
  importantTopics = [],
  onRetake,
  onNewQuiz,
}) => {
  const navigate = useNavigate();
  const [expandedIndex, setExpandedIndex] = useState(null);
  const [showImportantTopics, setShowImportantTopics] = useState(true);

  const percentage = Math.round((score / totalQuestions) * 100);

  useEffect(() => {
    if (percentage >= 70) {
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
      });
    }
  }, [percentage]);

  const toggleExpand = (idx) => {
    setExpandedIndex(expandedIndex === idx ? null : idx);
  };

  let assessment = {
    title: 'Keep Practicing!',
    subtitle: 'Review your notes and test again to solidify the concepts.',
    color: 'text-amber-500',
    badge: 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300',
  };

  if (percentage >= 90) {
    assessment = {
      title: 'Outstanding Mastery!',
      subtitle: 'You demonstrated an exceptional command of the material.',
      color: 'text-emerald-500',
      badge: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300',
    };
  } else if (percentage >= 70) {
    assessment = {
      title: 'Great Job!',
      subtitle: 'You have a solid grasp of the core concepts.',
      color: 'text-brand-500',
      badge: 'bg-brand-100 text-brand-800 dark:bg-brand-950/60 dark:text-brand-300',
    };
  }

  return (
    <div className="max-w-3xl mx-auto space-y-8 animate-fadeIn">
      {/* Score Summary Card */}
      <div className="glass-panel bg-white/90 dark:bg-slate-900/90 rounded-3xl p-8 border border-slate-200 dark:border-slate-800 shadow-xl text-center relative overflow-hidden">
        <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-4 border border-brand-200 dark:border-brand-800 bg-brand-50 dark:bg-brand-950/50 text-brand-600 dark:text-brand-400">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Quiz Complete</span>
        </div>

        <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight">
          {assessment.title}
        </h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400 max-w-md mx-auto">
          {assessment.subtitle}
        </p>

        {/* Score Circle / Metric */}
        <div className="my-8 flex justify-center items-center">
          <div className="relative w-40 h-40 rounded-full flex flex-col items-center justify-center bg-gradient-to-tr from-brand-600 to-indigo-500 text-white shadow-xl shadow-brand-500/25 p-2">
            <span className="text-4xl sm:text-5xl font-black">{percentage}%</span>
            <span className="text-xs uppercase tracking-wider font-semibold opacity-90 mt-1">
              {score} of {totalQuestions} Correct
            </span>
          </div>
        </div>

        {/* Quick Stats Grid */}
        <div className="grid grid-cols-3 gap-3 max-w-lg mx-auto mb-6">
          <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 rounded-2xl p-3 text-center">
            <p className="text-lg font-bold text-emerald-700 dark:text-emerald-400">{score}</p>
            <p className="text-[11px] font-semibold text-emerald-800 dark:text-emerald-300">Correct</p>
          </div>
          <div className="bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 rounded-2xl p-3 text-center">
            <p className="text-lg font-bold text-rose-700 dark:text-rose-400">{totalQuestions - score}</p>
            <p className="text-[11px] font-semibold text-rose-800 dark:text-rose-300">Incorrect</p>
          </div>
          <div className="bg-brand-50 dark:bg-brand-950/40 border border-brand-200 dark:border-brand-900/60 rounded-2xl p-3 text-center">
            <p className="text-lg font-bold text-brand-700 dark:text-brand-400">{percentage}%</p>
            <p className="text-[11px] font-semibold text-brand-800 dark:text-brand-300">Accuracy</p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap justify-center gap-3 pt-2">
          <button
            type="button"
            onClick={onRetake}
            className="px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-semibold text-xs flex items-center space-x-2 transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Retake Quiz</span>
          </button>
          <button
            type="button"
            onClick={onNewQuiz}
            className="px-5 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-semibold text-xs flex items-center space-x-2 shadow-md shadow-brand-500/25 transition-transform active:scale-95"
          >
            <Sparkles className="w-4 h-4" />
            <span>New Quiz</span>
          </button>
          {noteId && (
            <button
              type="button"
              onClick={() => navigate(`/flashcards?noteId=${noteId}`)}
              className="px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs flex items-center space-x-2 shadow-md transition-colors"
            >
              <Layers className="w-4 h-4" />
              <span>Study 15 Flashcards</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => navigate('/')}
            className="px-5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 font-semibold text-xs flex items-center space-x-2 transition-colors"
          >
            <LayoutDashboard className="w-4 h-4" />
            <span>Dashboard</span>
          </button>
        </div>
      </div>

      {/* Question by Question Review Accordion */}
      <div className="glass-panel bg-white/80 dark:bg-slate-900/80 rounded-3xl p-6 sm:p-8 border border-slate-200 dark:border-slate-800 shadow-sm">
        <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-4">
          Detailed Question Review
        </h2>

        <div className="space-y-3">
          {questionsWithAnswers.map((item, idx) => {
            const isExpanded = expandedIndex === idx;
            return (
              <div
                key={idx}
                className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden bg-slate-50/50 dark:bg-slate-800/30"
              >
                <button
                  type="button"
                  onClick={() => toggleExpand(idx)}
                  className="w-full text-left p-4 flex items-center justify-between hover:bg-slate-100/50 dark:hover:bg-slate-800/60 transition-colors"
                >
                  <div className="flex items-center space-x-3 pr-2">
                    {item.isCorrect ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0" />
                    ) : (
                      <XCircle className="w-5 h-5 text-rose-500 flex-shrink-0" />
                    )}
                    <span className="text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-200">
                      {idx + 1}. {item.question}
                    </span>
                  </div>
                  {isExpanded ? (
                    <ChevronUp className="w-4 h-4 text-slate-400 flex-shrink-0" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0" />
                  )}
                </button>

                {isExpanded && (
                  <div className="p-4 pt-0 border-t border-slate-200/50 dark:border-slate-800/50 text-xs space-y-2 mt-2">
                    <p className="text-slate-600 dark:text-slate-400">
                      <strong className="text-slate-700 dark:text-slate-300">Your Answer:</strong>{' '}
                      <span className={item.isCorrect ? 'text-emerald-600 font-semibold' : 'text-rose-600 font-semibold'}>
                        {item.userAnswer}
                      </span>
                    </p>
                    {!item.isCorrect && (
                      <p className="text-slate-600 dark:text-slate-400">
                        <strong className="text-slate-700 dark:text-slate-300">Correct Answer:</strong>{' '}
                        <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                          {item.correctAnswer}
                        </span>
                      </p>
                    )}
                    <div className="p-3 bg-amber-50/60 dark:bg-amber-950/20 rounded-xl border border-amber-200/50 dark:border-amber-900/40 text-slate-700 dark:text-slate-300">
                      <strong className="text-amber-800 dark:text-amber-300 block mb-0.5">Explanation:</strong>
                      {item.explanation}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Important Topics with AI Question + Model Answer Key */}
      {importantTopics && importantTopics.length > 0 && (
        <div className="glass-panel bg-white/90 dark:bg-slate-900/90 rounded-3xl p-6 sm:p-8 border border-indigo-200 dark:border-indigo-900/60 shadow-md">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2.5">
              <div className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                <Award className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center space-x-2">
                  <span>Key Syllabus Topics (Question + Model Answer Key)</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                    High Yield
                  </span>
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Core syllabus high-weightage topics and standard evaluation model answers
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowImportantTopics(!showImportantTopics)}
              className="text-xs text-indigo-600 dark:text-indigo-400 font-semibold hover:underline"
            >
              {showImportantTopics ? 'Hide Key' : 'Show Key'}
            </button>
          </div>

          {analysisSummary && (
            <div className="p-3.5 mb-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
              <strong className="text-indigo-600 dark:text-indigo-400 block mb-1">AI Syllabus Trend Analysis:</strong>
              {analysisSummary}
            </div>
          )}

          {showImportantTopics && (
            <div className="space-y-3">
              {importantTopics.map((top, tIdx) => (
                <div
                  key={tIdx}
                  className="p-4 rounded-2xl bg-indigo-50/40 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/50 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-indigo-950 dark:text-indigo-200 flex items-center space-x-1.5">
                      <Flame className="w-3.5 h-3.5 text-amber-500" />
                      <span>Module #{tIdx + 1}: {top.topic}</span>
                    </span>
                    {top.weightage && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                        {top.weightage}
                      </span>
                    )}
                  </div>

                  {top.sampleQuestion && (
                    <p className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                      <span className="text-brand-600 dark:text-brand-400 mr-1.5 font-bold">Exam Question:</span>
                      {top.sampleQuestion}
                    </p>
                  )}

                  {top.sampleAnswer && (
                    <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                      <span className="font-bold text-emerald-600 dark:text-emerald-400 mr-1.5">Model Answer:</span>
                      {top.sampleAnswer}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default QuizResults;
