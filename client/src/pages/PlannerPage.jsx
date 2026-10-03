import React, { useState, useEffect } from 'react';
import api from '../services/api';
import PlanTimeline from '../components/planner/PlanTimeline';
import {
  Calendar,
  Sparkles,
  Clock,
  BookOpen,
  Loader2,
  AlertCircle,
  Plus,
  CheckCircle2,
} from 'lucide-react';

const PlannerPage = () => {
  const [plans, setPlans] = useState([]);
  const [activePlan, setActivePlan] = useState(null);
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [isCreatingNew, setIsCreatingNew] = useState(false);

  // Form inputs
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 14); // Default to 2 weeks ahead
  const defaultDateStr = tomorrow.toISOString().split('T')[0];

  const [title, setTitle] = useState('');
  const [examDate, setExamDate] = useState(defaultDateStr);
  const [dailyHours, setDailyHours] = useState(2.5);
  const [selectedNoteIds, setSelectedNoteIds] = useState([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [plansRes, notesRes] = await Promise.all([
          api.get('/planner'),
          api.get('/notes'),
        ]);
        setPlans(plansRes.data.plans);
        setNotes(notesRes.data.notes);
        if (plansRes.data.plans.length > 0) {
          setActivePlan(plansRes.data.plans[0]);
        } else {
          setIsCreatingNew(true);
        }
      } catch (err) {
        console.error('Failed to load study plans:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const handleToggleNoteSelection = (noteId) => {
    setSelectedNoteIds((prev) =>
      prev.includes(noteId) ? prev.filter((id) => id !== noteId) : [...prev, noteId]
    );
  };

  const handleCreatePlan = async (e) => {
    e.preventDefault();
    setError('');
    setCreating(true);

    try {
      const res = await api.post('/planner/generate', {
        title: title.trim() || undefined,
        examDate,
        dailyHours: Number(dailyHours),
        selectedNoteIds,
      });

      setPlans((prev) => [res.data.plan, ...prev]);
      setActivePlan(res.data.plan);
      setIsCreatingNew(false);
      setTitle('');
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to generate study plan.');
    } finally {
      setCreating(false);
    }
  };

  const handlePlanUpdated = (updatedPlan) => {
    setActivePlan(updatedPlan);
    setPlans((prev) => prev.map((p) => (p._id === updatedPlan._id ? updatedPlan : p)));
  };

  const handlePlanDeleted = (deletedId) => {
    const remaining = plans.filter((p) => p._id !== deletedId);
    setPlans(remaining);
    if (remaining.length > 0) {
      setActivePlan(remaining[0]);
    } else {
      setActivePlan(null);
      setIsCreatingNew(true);
    }
  };

  const minDate = new Date();
  minDate.setDate(minDate.getDate() + 1);
  const minDateStr = minDate.toISOString().split('T')[0];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Page Header */}
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center space-x-3">
            <Calendar className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
            <span>AI Study Planner</span>
          </h1>
          <p className="text-slate-600 dark:text-slate-400 mt-2 text-sm sm:text-base">
            Input your exam date and daily study availability to generate an automated day-by-day roadmap.
          </p>
        </div>

        {plans.length > 0 && (
          <div className="flex items-center space-x-3">
            {/* Plan switcher */}
            <select
              value={activePlan?._id || ''}
              onChange={(e) => {
                const found = plans.find((p) => p._id === e.target.value);
                if (found) {
                  setActivePlan(found);
                  setIsCreatingNew(false);
                }
              }}
              className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              {plans.map((p) => (
                <option key={p._id} value={p._id}>
                  {p.title}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={() => setIsCreatingNew(!isCreatingNew)}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs flex items-center space-x-1.5 shadow-sm transition-transform active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>{isCreatingNew ? 'View Active Plan' : 'New Plan'}</span>
            </button>
          </div>
        )}
      </div>

      {loading ? (
        <div className="py-20 text-center flex flex-col items-center justify-center">
          <Loader2 className="w-8 h-8 text-emerald-600 animate-spin mb-3" />
          <p className="text-sm font-semibold text-slate-600 dark:text-slate-400">Loading study plans...</p>
        </div>
      ) : isCreatingNew || !activePlan ? (
        /* Create New Plan Form */
        <div className="max-w-2xl mx-auto glass-panel bg-white/80 dark:bg-slate-900/80 rounded-3xl p-6 sm:p-8 border border-slate-200 dark:border-slate-800 shadow-xl">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center space-x-2 mb-6">
            <Sparkles className="w-5 h-5 text-emerald-600" />
            <span>Design Your Exam Study Schedule</span>
          </h2>

          {error && (
            <div className="mb-6 p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 flex items-start space-x-3 text-rose-700 dark:text-rose-400 text-xs">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleCreatePlan} className="space-y-5">
            {/* Plan Title */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                Plan Name / Exam Target
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Biology 101 Midterm Prep"
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-xs transition-all"
              />
            </div>

            {/* Exam Date Picker */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                Target Exam Date
              </label>
              <div className="relative">
                <input
                  type="date"
                  required
                  min={minDateStr}
                  value={examDate}
                  onChange={(e) => setExamDate(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 text-xs transition-all"
                />
              </div>
            </div>

            {/* Daily Hours Slider & Quick Pills */}
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  Daily Study Availability
                </label>
                <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                  {dailyHours} hours / day ({Math.round(dailyHours * 60)} mins)
                </span>
              </div>
              <input
                type="range"
                min="0.5"
                max="8"
                step="0.5"
                value={dailyHours}
                onChange={(e) => setDailyHours(parseFloat(e.target.value))}
                className="w-full accent-emerald-600 cursor-pointer"
              />
              <div className="flex gap-2 mt-2">
                {[1, 2, 3, 4, 6].map((hrs) => (
                  <button
                    key={hrs}
                    type="button"
                    onClick={() => setDailyHours(hrs)}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold border transition-colors ${
                      dailyHours === hrs
                        ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300'
                        : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    {hrs} hr{hrs > 1 ? 's' : ''}
                  </button>
                ))}
              </div>
            </div>

            {/* Select Notes to Cover */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                Select Notes to Cover in this Plan
              </label>
              {notes.length === 0 ? (
                <p className="text-xs text-slate-500 p-3 bg-slate-50 dark:bg-slate-800 rounded-xl">
                  No notes saved yet. We will generate a general comprehensive study schedule based on your exam timeframe.
                </p>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {notes.map((note) => {
                    const isChecked = selectedNoteIds.includes(note._id);
                    return (
                      <div
                        key={note._id}
                        onClick={() => handleToggleNoteSelection(note._id)}
                        className={`p-3 rounded-xl border cursor-pointer transition-all flex items-center justify-between text-xs ${
                          isChecked
                            ? 'bg-emerald-50/60 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200'
                            : 'bg-slate-50/50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                        }`}
                      >
                        <div className="flex items-center space-x-2.5 truncate">
                          <BookOpen className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                          <span className="font-semibold truncate">{note.title}</span>
                        </div>
                        <div className="w-4 h-4 flex items-center justify-center flex-shrink-0">
                          {isChecked ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                          ) : (
                            <div className="w-3.5 h-3.5 rounded border border-slate-300 dark:border-slate-600" />
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={creating}
              className="w-full py-3.5 px-6 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-semibold text-sm shadow-lg shadow-emerald-500/25 flex items-center justify-center space-x-2 transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50"
            >
              {creating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Gemini is generating your day-by-day schedule...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Generate Day-by-Day Study Plan</span>
                </>
              )}
            </button>
          </form>
        </div>
      ) : (
        /* Active Plan View */
        <PlanTimeline
          plan={activePlan}
          onPlanUpdated={handlePlanUpdated}
          onPlanDeleted={handlePlanDeleted}
        />
      )}
    </div>
  );
};

export default PlannerPage;
