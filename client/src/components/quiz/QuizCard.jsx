import React, { useState } from 'react';
import { CheckCircle2, XCircle, ArrowRight, HelpCircle, Lightbulb, Flame, Tag } from 'lucide-react';

const optionLetters = ['A', 'B', 'C', 'D'];

const QuizCard = ({
  questionData,
  currentIndex,
  totalQuestions,
  onAnswerSelected,
  onNextQuestion,
  isLastQuestion,
}) => {
  const [selectedOption, setSelectedOption] = useState(null);
  const isAnswered = selectedOption !== null;

  const handleSelect = (option) => {
    if (isAnswered) return;
    setSelectedOption(option);
    const isCorrect = option.trim().toLowerCase() === questionData.correctAnswer.trim().toLowerCase();
    onAnswerSelected({
      question: questionData.question,
      options: questionData.options,
      correctAnswer: questionData.correctAnswer,
      userAnswer: option,
      isCorrect,
      explanation: questionData.explanation,
      importantTopic: questionData.importantTopic,
      examFrequency: questionData.examFrequency,
    });
  };

  const progressPercent = Math.round(((currentIndex + 1) / totalQuestions) * 100);

  return (
    <div className="glass-panel bg-white/90 dark:bg-slate-900/90 rounded-3xl p-6 sm:p-8 border border-slate-200 dark:border-slate-800 shadow-xl max-w-3xl mx-auto">
      {/* Top Header & Progress */}
      <div className="mb-6">
        <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
          <span className="flex items-center space-x-1.5 text-brand-600 dark:text-brand-400">
            <HelpCircle className="w-4 h-4" />
            <span>Question {currentIndex + 1} of {totalQuestions}</span>
          </span>
          <span>{progressPercent}% Complete</span>
        </div>
        <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
          <div
            className="bg-gradient-to-r from-brand-600 to-indigo-500 h-full rounded-full transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Topic Relevance & Core Topic Badges */}
      {(questionData.examFrequency || questionData.importantTopic) && (
        <div className="flex flex-wrap items-center gap-2 mb-3">
          {questionData.examFrequency && (
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-900/60 flex items-center space-x-1">
              <Flame className="w-3 h-3 text-rose-500" />
              <span>{questionData.examFrequency}</span>
            </span>
          )}
          {questionData.importantTopic && (
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 flex items-center space-x-1">
              <Tag className="w-3 h-3 text-indigo-500" />
              <span>Topic: {questionData.importantTopic}</span>
            </span>
          )}
        </div>
      )}

      {/* Question Prompt */}
      <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white leading-snug mb-6">
        {questionData.question}
      </h2>

      {/* 4 Options Grid */}
      <div className="space-y-3 mb-6">
        {questionData.options.map((option, idx) => {
          const letter = optionLetters[idx] || (idx + 1);
          const isThisSelected = selectedOption === option;
          const isThisCorrect =
            option.trim().toLowerCase() === questionData.correctAnswer.trim().toLowerCase();

          let btnStyle = 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/60 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200';
          let letterStyle = 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300';

          if (isAnswered) {
            if (isThisCorrect) {
              btnStyle = 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200 ring-2 ring-emerald-500/30';
              letterStyle = 'bg-emerald-500 text-white';
            } else if (isThisSelected && !isThisCorrect) {
              btnStyle = 'border-rose-500 bg-rose-50 dark:bg-rose-950/40 text-rose-900 dark:text-rose-200 ring-2 ring-rose-500/30';
              letterStyle = 'bg-rose-500 text-white';
            } else {
              btnStyle = 'opacity-60 border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-slate-500';
            }
          }

          return (
            <button
              key={idx}
              type="button"
              disabled={isAnswered}
              onClick={() => handleSelect(option)}
              className={`w-full text-left p-4 rounded-2xl border transition-all flex items-center justify-between group ${btnStyle}`}
            >
              <div className="flex items-center space-x-3.5 pr-2">
                <span
                  className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs flex-shrink-0 transition-colors ${letterStyle}`}
                >
                  {letter}
                </span>
                <span className="text-sm font-medium leading-relaxed">{option}</span>
              </div>

              {isAnswered && isThisCorrect && (
                <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 flex-shrink-0 ml-2" />
              )}
              {isAnswered && isThisSelected && !isThisCorrect && (
                <XCircle className="w-5 h-5 text-rose-600 dark:text-rose-400 flex-shrink-0 ml-2" />
              )}
            </button>
          );
        })}
      </div>

      {/* Explanation Box on Answer */}
      {isAnswered && (
        <div className="mb-6 p-4 rounded-2xl bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-900/60 animate-fadeIn">
          <div className="flex items-start space-x-2.5">
            <Lightbulb className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-amber-800 dark:text-amber-300">
                Explanation
              </p>
              <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 mt-1 leading-relaxed">
                {questionData.explanation || 'Review the study notes for full concept context.'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Action Footer */}
      {isAnswered && (
        <div className="flex justify-end pt-2">
          <button
            type="button"
            onClick={() => {
              setSelectedOption(null);
              onNextQuestion();
            }}
            className="py-3 px-6 rounded-xl bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-700 hover:to-indigo-700 text-white font-semibold text-sm shadow-lg shadow-brand-500/25 flex items-center space-x-2 transition-transform active:scale-95"
          >
            <span>{isLastQuestion ? 'View Results & Score' : 'Next Question'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
};

export default QuizCard;
