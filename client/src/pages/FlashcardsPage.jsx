import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../services/api';
import FlashcardDeck from '../components/flashcards/FlashcardDeck';
import {
  Layers,
  Sparkles,
  BookOpen,
  Loader2,
  AlertCircle,
  RotateCcw,
} from 'lucide-react';

const FlashcardsPage = () => {
  const [searchParams] = useSearchParams();
  const preselectedNoteId = searchParams.get('noteId');

  const [notes, setNotes] = useState([]);
  const [selectedNoteId, setSelectedNoteId] = useState(preselectedNoteId || '');
  const [customText, setCustomText] = useState('');
  const [activeInputMode, setActiveInputMode] = useState(preselectedNoteId ? 'note' : 'note');

  const [flashcards, setFlashcards] = useState([]);
  const [deckTitle, setDeckTitle] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [truncationNotice, setTruncationNotice] = useState('');

  useEffect(() => {
    const fetchNotes = async () => {
      try {
        const res = await api.get('/notes');
        setNotes(res.data.notes);

        if (preselectedNoteId) {
          setSelectedNoteId(preselectedNoteId);
          const found = res.data.notes.find((n) => n._id === preselectedNoteId);
          if (found) {
            setDeckTitle(found.title);
            // Check if note already has saved flashcards
            if (found.flashcards && found.flashcards.length === 15) {
              setFlashcards(found.flashcards);
            }
          }
        } else if (res.data.notes.length > 0) {
          setSelectedNoteId(res.data.notes[0]._id);
          setDeckTitle(res.data.notes[0].title);
        }
      } catch (err) {
        console.error('Failed to load notes for flashcards:', err);
      }
    };

    fetchNotes();
  }, [preselectedNoteId]);

  const handleGenerate = async () => {
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
      } else {
        if (!customText.trim() || customText.trim().length < 25) {
          setError('Please provide at least 25 characters of study notes to generate flashcards.');
          setLoading(false);
          return;
        }
        payload = { content: customText.trim(), noteTitle: 'Custom Deck' };
      }

      const res = await api.post('/flashcards/generate', payload);
      setFlashcards(res.data.flashcards);
      setDeckTitle(res.data.deckTitle);
      setTruncationNotice(res.data.truncationNotice || '');
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to generate flashcards.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center space-x-3">
            <Layers className="w-8 h-8 text-amber-500" />
            <span>AI 3D Flashcards</span>
          </h1>
          <p className="text-slate-600 dark:text-slate-400 mt-2 text-sm sm:text-base">
            Active recall powered by 15 high-yield flippable concept flashcards.
          </p>
        </div>

        {flashcards.length > 0 && (
          <button
            type="button"
            onClick={() => setFlashcards([])}
            className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center space-x-2 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Choose Different Notes</span>
          </button>
        )}
      </div>

      {flashcards.length === 0 ? (
        /* Setup / Generation Form */
        <div className="max-w-2xl mx-auto glass-panel bg-white/80 dark:bg-slate-900/80 rounded-3xl p-6 sm:p-8 border border-slate-200 dark:border-slate-800 shadow-xl">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center space-x-2 mb-6">
            <Sparkles className="w-5 h-5 text-amber-500" />
            <span>Generate 15 Flashcards Deck</span>
          </h2>

          {error && (
            <div className="mb-6 p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 flex items-start space-x-3 text-rose-700 dark:text-rose-400 text-xs">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Mode Switcher */}
          <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-xs font-semibold mb-6">
            <button
              type="button"
              onClick={() => setActiveInputMode('note')}
              className={`flex-1 py-2 rounded-lg transition-all flex items-center justify-center space-x-2 ${
                activeInputMode === 'note'
                  ? 'bg-white dark:bg-slate-900 text-amber-600 dark:text-amber-400 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <BookOpen className="w-4 h-4" />
              <span>From Saved Notes</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveInputMode('custom')}
              className={`flex-1 py-2 rounded-lg transition-all flex items-center justify-center space-x-2 ${
                activeInputMode === 'custom'
                  ? 'bg-white dark:bg-slate-900 text-amber-600 dark:text-amber-400 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Sparkles className="w-4 h-4" />
              <span>Paste Custom Topic</span>
            </button>
          </div>

          {activeInputMode === 'note' ? (
            <div className="space-y-4 mb-6">
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                Select Note Material
              </label>
              {notes.length === 0 ? (
                <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-xl text-xs text-slate-500">
                  No saved notes found. Upload notes in the Notes section or switch to "Paste Custom Topic".
                </div>
              ) : (
                <select
                  value={selectedNoteId}
                  onChange={(e) => {
                    setSelectedNoteId(e.target.value);
                    const f = notes.find((n) => n._id === e.target.value);
                    if (f) setDeckTitle(f.title);
                  }}
                  className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white text-xs font-medium focus:outline-none focus:ring-2 focus:ring-amber-500"
                >
                  {notes.map((n) => (
                    <option key={n._id} value={n._id}>
                      {n.title} ({new Date(n.createdAt).toLocaleDateString()})
                    </option>
                  ))}
                </select>
              )}
            </div>
          ) : (
            <div className="space-y-4 mb-6">
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                Key Concepts / Topic Notes
              </label>
              <textarea
                rows={6}
                value={customText}
                onChange={(e) => setCustomText(e.target.value)}
                placeholder="Paste key terms, definitions, formulas, or summaries to distill into 15 flashcards..."
                className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500 text-xs resize-y"
              />
            </div>
          )}

          <button
            type="button"
            disabled={loading || (activeInputMode === 'note' && !selectedNoteId) || (activeInputMode === 'custom' && !customText.trim())}
            onClick={handleGenerate}
            className="w-full py-3.5 px-6 rounded-xl bg-gradient-to-r from-amber-500 via-amber-600 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-semibold text-sm shadow-lg shadow-amber-500/25 flex items-center justify-center space-x-2 transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Distilling 15 Essential Flashcards...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>Generate 15 Flashcards</span>
              </>
            )}
          </button>
        </div>
      ) : (
        /* Active Deck Viewer */
        <>
          {truncationNotice && (
            <div className="max-w-2xl mx-auto mb-4 p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 flex items-start space-x-2.5 text-amber-700 dark:text-amber-400 text-xs">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{truncationNotice}</span>
            </div>
          )}
          <FlashcardDeck
            initialCards={flashcards}
            deckTitle={deckTitle}
            onResetDeck={() => setFlashcards([])}
          />
        </>
      )}
    </div>
  );
};

export default FlashcardsPage;
