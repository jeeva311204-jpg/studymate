import React, { useState, useEffect } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  RotateCw,
  Shuffle,
  CheckCircle,
  Sparkles,
  BookOpen,
  Trophy,
} from 'lucide-react';

const FlashcardDeck = ({
  initialCards,
  deckTitle,
  onResetDeck,
}) => {
  const [cards, setCards] = useState(initialCards);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [masteredIds, setMasteredIds] = useState(new Set());

  const currentCard = cards[currentIndex] || cards[0];
  const totalCards = cards.length;

  // Keyboard navigation support
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Don't intercept if user is typing in an input or textarea
      if (['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;

      if (e.code === 'Space') {
        e.preventDefault();
        setIsFlipped((prev) => !prev);
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        handleNext();
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        handlePrev();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentIndex, cards.length]);

  const handleNext = () => {
    setIsFlipped(false);
    setCurrentIndex((prev) => (prev + 1) % totalCards);
  };

  const handlePrev = () => {
    setIsFlipped(false);
    setCurrentIndex((prev) => (prev - 1 + totalCards) % totalCards);
  };

  const handleShuffle = () => {
    setIsFlipped(false);
    const shuffled = [...cards].sort(() => Math.random() - 0.5);
    setCards(shuffled);
    setCurrentIndex(0);
  };

  const toggleMastered = (cardIdx) => {
    setMasteredIds((prev) => {
      const next = new Set(prev);
      if (next.has(cardIdx)) {
        next.delete(cardIdx);
      } else {
        next.add(cardIdx);
      }
      return next;
    });
  };

  const isCurrentMastered = masteredIds.has(currentIndex);
  const progressPercent = Math.round(((currentIndex + 1) / totalCards) * 100);

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-fadeIn">
      {/* Deck Header & Stats */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white truncate max-w-sm">
            {deckTitle}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Card {currentIndex + 1} of {totalCards} • {masteredIds.size} Mastered
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={handleShuffle}
            className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 text-xs font-semibold flex items-center space-x-1.5 transition-colors"
            title="Shuffle deck cards"
          >
            <Shuffle className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Shuffle</span>
          </button>

          <button
            type="button"
            onClick={() => toggleMastered(currentIndex)}
            className={`px-3 py-2 rounded-xl border text-xs font-semibold flex items-center space-x-1.5 transition-all ${
              isCurrentMastered
                ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300'
                : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'
            }`}
          >
            <CheckCircle className={`w-3.5 h-3.5 ${isCurrentMastered ? 'text-emerald-500 fill-emerald-500/20' : ''}`} />
            <span>{isCurrentMastered ? 'Mastered' : 'Mark Mastered'}</span>
          </button>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
        <div
          className="bg-gradient-to-r from-amber-500 to-orange-500 h-full rounded-full transition-all duration-300"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* 3D Flippable Card Stage */}
      <div className="perspective-1000 w-full min-h-[360px] sm:min-h-[380px] cursor-pointer" onClick={() => setIsFlipped(!isFlipped)}>
        <div
          className={`relative w-full h-full min-h-[360px] sm:min-h-[380px] rounded-3xl transition-transform duration-500 transform-style-preserve-3d shadow-2xl ${
            isFlipped ? 'rotate-y-180' : ''
          }`}
        >
          {/* Card FRONT */}
          <div className="absolute inset-0 backface-hidden rounded-3xl p-8 sm:p-10 flex flex-col justify-between bg-white dark:bg-slate-900 border-2 border-slate-200/80 dark:border-slate-800 shadow-xl select-none">
            <div className="flex items-center justify-between">
              <span className="px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-900/60">
                {currentCard.category || 'Term / Question'}
              </span>
              <span className="text-xs font-semibold text-slate-400">
                {currentIndex + 1} / {totalCards}
              </span>
            </div>

            <div className="my-auto py-6 text-center">
              <h3 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white leading-relaxed">
                {currentCard.front}
              </h3>
            </div>

            <div className="flex items-center justify-between text-xs text-slate-400 pt-4 border-t border-slate-100 dark:border-slate-800">
              <span className="flex items-center space-x-1">
                <RotateCw className="w-3.5 h-3.5" />
                <span>Click or press [Space] to flip</span>
              </span>
              <span className="hidden sm:inline">Use [←] / [→] keys</span>
            </div>
          </div>

          {/* Card BACK */}
          <div className="absolute inset-0 backface-hidden rotate-y-180 rounded-3xl p-8 sm:p-10 flex flex-col justify-between bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950 dark:from-slate-900 dark:via-slate-950 dark:to-brand-950 text-white border-2 border-indigo-500/40 shadow-xl select-none">
            <div className="flex items-center justify-between">
              <span className="px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                Answer & Key Definition
              </span>
              <span className="text-xs font-semibold text-slate-400">
                {currentIndex + 1} / {totalCards}
              </span>
            </div>

            <div className="my-auto py-6">
              <p className="text-base sm:text-lg text-slate-100 font-medium leading-relaxed">
                {currentCard.back}
              </p>
            </div>

            <div className="flex items-center justify-between text-xs text-slate-400 pt-4 border-t border-slate-800">
              <span className="flex items-center space-x-1">
                <RotateCw className="w-3.5 h-3.5" />
                <span>Click or press [Space] to flip front</span>
              </span>
              {isCurrentMastered && (
                <span className="text-emerald-400 font-semibold flex items-center space-x-1">
                  <CheckCircle className="w-3.5 h-3.5" />
                  <span>Mastered</span>
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Control Buttons */}
      <div className="flex items-center justify-between gap-4 pt-2">
        <button
          type="button"
          onClick={handlePrev}
          className="flex-1 py-3 px-4 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-semibold text-xs flex items-center justify-center space-x-2 transition-all shadow-sm active:scale-95"
        >
          <ChevronLeft className="w-4 h-4" />
          <span>Previous</span>
        </button>

        <button
          type="button"
          onClick={() => setIsFlipped(!isFlipped)}
          className="py-3 px-5 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-amber-800 dark:text-amber-300 font-semibold text-xs flex items-center space-x-1.5 transition-all hover:bg-amber-100 dark:hover:bg-amber-900/60"
        >
          <RotateCw className="w-4 h-4" />
          <span>Flip</span>
        </button>

        <button
          type="button"
          onClick={handleNext}
          className="flex-1 py-3 px-4 rounded-2xl bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white font-semibold text-xs flex items-center justify-center space-x-2 transition-all shadow-md shadow-amber-500/20 active:scale-95"
        >
          <span>Next Card</span>
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Mastery Summary Card */}
      {masteredIds.size === totalCards && (
        <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <Trophy className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300">
              Deck Completed! All {totalCards} cards marked as mastered.
            </span>
          </div>
          <button
            type="button"
            onClick={() => setMasteredIds(new Set())}
            className="text-xs font-semibold text-emerald-700 hover:underline"
          >
            Reset Mastery
          </button>
        </div>
      )}
    </div>
  );
};

export default FlashcardDeck;
