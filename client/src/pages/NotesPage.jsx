import React, { useState, useEffect } from 'react';
import api from '../services/api';
import NoteUploader from '../components/notes/NoteUploader';
import SummaryViewer from '../components/notes/SummaryViewer';
import { BookOpen, Search, FileText, ChevronRight, Loader2 } from 'lucide-react';

const NotesPage = () => {
  const [notes, setNotes] = useState([]);
  const [selectedNote, setSelectedNote] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchNotes = async () => {
    try {
      const res = await api.get('/notes');
      setNotes(res.data.notes);
      if (res.data.notes.length > 0 && !selectedNote) {
        // Fetch full first note with rawContent
        fetchFullNote(res.data.notes[0]._id);
      }
    } catch (err) {
      console.error('Failed to fetch notes:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchFullNote = async (id) => {
    try {
      const res = await api.get(`/notes/${id}`);
      setSelectedNote(res.data.note);
    } catch (err) {
      console.error('Failed to fetch full note:', err);
    }
  };

  useEffect(() => {
    fetchNotes();
  }, []);

  const handleNoteCreated = (newNote) => {
    setNotes((prev) => [newNote, ...prev]);
    setSelectedNote(newNote);
  };

  const handleNoteUpdated = (updatedNote) => {
    setSelectedNote(updatedNote);
    setNotes((prev) =>
      prev.map((n) => (n._id === updatedNote._id ? { ...n, summary: updatedNote.summary } : n))
    );
  };

  const handleNoteDeleted = (deletedId) => {
    const remaining = notes.filter((n) => n._id !== deletedId);
    setNotes(remaining);
    if (selectedNote?._id === deletedId) {
      if (remaining.length > 0) {
        fetchFullNote(remaining[0]._id);
      } else {
        setSelectedNote(null);
      }
    }
  };

  const filteredNotes = notes.filter((n) =>
    n.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center space-x-3">
          <BookOpen className="w-8 h-8 text-brand-600 dark:text-brand-400" />
          <span>Notes & AI Summarizer</span>
        </h1>
        <p className="text-slate-600 dark:text-slate-400 mt-2 text-sm sm:text-base">
          Upload lecture slides, book chapters, or paste raw notes to extract high-yield bullet point summaries.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Note Uploader & Note List (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          <NoteUploader onNoteCreated={handleNoteCreated} />

          {/* Saved Notes Library */}
          <div className="glass-panel bg-white/80 dark:bg-slate-900/80 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                Saved Notes ({notes.length})
              </h2>
            </div>

            {/* Search Input */}
            <div className="relative mb-3">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <Search className="w-4 h-4" />
              </div>
              <input
                type="text"
                placeholder="Search notes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>

            {/* List */}
            {loading ? (
              <div className="py-8 text-center flex flex-col items-center justify-center text-slate-500 text-xs">
                <Loader2 className="w-5 h-5 animate-spin mb-2 text-brand-500" />
                <span>Loading notes...</span>
              </div>
            ) : filteredNotes.length === 0 ? (
              <div className="py-8 text-center text-slate-500 text-xs">
                {searchQuery ? 'No notes match your search.' : 'No notes saved yet. Upload or paste one above!'}
              </div>
            ) : (
              <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
                {filteredNotes.map((item) => {
                  const isSelected = selectedNote?._id === item._id;
                  return (
                    <button
                      key={item._id}
                      onClick={() => fetchFullNote(item._id)}
                      className={`w-full text-left p-3 rounded-xl transition-all flex items-center justify-between border ${
                        isSelected
                          ? 'bg-brand-50/80 dark:bg-brand-950/50 border-brand-300 dark:border-brand-800 shadow-sm'
                          : 'bg-slate-50/50 dark:bg-slate-800/40 border-slate-100 dark:border-slate-800/80 hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`}
                    >
                      <div className="flex items-center space-x-3 overflow-hidden">
                        <div
                          className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                            isSelected
                              ? 'bg-brand-600 text-white'
                              : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                          }`}
                        >
                          <FileText className="w-4 h-4" />
                        </div>
                        <div className="truncate">
                          <p
                            className={`text-xs font-semibold truncate ${
                              isSelected
                                ? 'text-brand-700 dark:text-brand-300'
                                : 'text-slate-800 dark:text-slate-200'
                            }`}
                          >
                            {item.title}
                          </p>
                          <p className="text-[10px] text-slate-400 mt-0.5">
                            {new Date(item.createdAt).toLocaleDateString()} • {item.sourceType.toUpperCase()}
                          </p>
                        </div>
                      </div>
                      <ChevronRight
                        className={`w-4 h-4 flex-shrink-0 ${
                          isSelected ? 'text-brand-600 dark:text-brand-400' : 'text-slate-400'
                        }`}
                      />
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Active Note Summary & Actions (7 cols) */}
        <div className="lg:col-span-7">
          <SummaryViewer
            note={selectedNote}
            onNoteUpdated={handleNoteUpdated}
            onNoteDeleted={handleNoteDeleted}
          />
        </div>
      </div>
    </div>
  );
};

export default NotesPage;
