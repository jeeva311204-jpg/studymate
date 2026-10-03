import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import {
  Sparkles,
  BookOpen,
  HelpCircle,
  Layers,
  Calendar,
  ArrowRight,
  TrendingUp,
  Award,
  CheckCircle2,
  Clock,
  Plus,
  Loader2,
  FileText,
  Search,
} from 'lucide-react';

const DashboardPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [quickTopic, setQuickTopic] = useState('');

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await api.get('/dashboard/stats');
        setStats(res.data);
      } catch (err) {
        console.error('Failed to load dashboard data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  if (loading) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center">
        <Loader2 className="w-10 h-10 text-brand-600 animate-spin mb-4" />
        <p className="text-sm font-semibold text-slate-600 dark:text-slate-400">Loading your study hub...</p>
      </div>
    );
  }

  const { metrics, scoreTrend = [], recentNotes = [], recentQuizzes = [], activePlan } = stats || {
    metrics: { totalNotes: 0, totalQuizzes: 0, averageScore: 0, activePlansCount: 0 },
  };

  // Helper to render an SVG smooth progress chart
  const renderProgressChart = () => {
    if (scoreTrend.length === 0) {
      return (
        <div className="py-12 text-center flex flex-col items-center justify-center">
          <Award className="w-12 h-12 text-purple-400 opacity-60 mb-2" />
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">No quiz data yet</p>
          <p className="text-xs text-slate-500 mt-1 max-w-xs">
            Complete your first 10-question quiz to start charting your learning progress and accuracy over time.
          </p>
          <Link
            to="/quiz"
            className="mt-4 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-semibold text-xs rounded-xl shadow-md transition-transform active:scale-95"
          >
            Take First Quiz
          </Link>
        </div>
      );
    }

    const svgWidth = 600;
    const svgHeight = 200;
    const padding = 35;
    const chartW = svgWidth - padding * 2;
    const chartH = svgHeight - padding * 2;

    const points = scoreTrend.map((item, idx) => {
      const x = padding + (idx / Math.max(scoreTrend.length - 1, 1)) * chartW;
      const y = padding + chartH - (item.score / 100) * chartH;
      return { x, y, score: item.score, date: item.date, title: item.title };
    });

    const pathD = points.reduce((acc, pt, i) => {
      if (i === 0) return `M ${pt.x} ${pt.y}`;
      return `${acc} L ${pt.x} ${pt.y}`;
    }, '');

    const areaD = `${pathD} L ${points[points.length - 1].x} ${padding + chartH} L ${points[0].x} ${padding + chartH} Z`;

    return (
      <div className="w-full overflow-x-auto">
        <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="w-full h-48 select-none">
          <defs>
            <linearGradient id="scoreGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Grid lines */}
          {[0, 25, 50, 75, 100].map((val) => {
            const y = padding + chartH - (val / 100) * chartH;
            return (
              <g key={val}>
                <line
                  x1={padding}
                  y1={y}
                  x2={svgWidth - padding}
                  y2={y}
                  stroke="currentColor"
                  className="text-slate-200 dark:text-slate-800"
                  strokeDasharray="4 4"
                />
                <text
                  x={padding - 8}
                  y={y + 3}
                  textAnchor="end"
                  className="text-[9px] fill-slate-400 font-semibold"
                >
                  {val}%
                </text>
              </g>
            );
          })}

          {/* Gradient area */}
          <path d={areaD} fill="url(#scoreGradient)" />

          {/* Stroke path */}
          <path
            d={pathD}
            fill="none"
            stroke="#8b5cf6"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Points */}
          {points.map((pt, i) => (
            <g key={i} className="group cursor-pointer">
              <circle
                cx={pt.x}
                cy={pt.y}
                r="5"
                fill="#8b5cf6"
                className="stroke-white dark:stroke-slate-900 stroke-2 group-hover:scale-125 transition-transform"
              />
              <text
                x={pt.x}
                y={pt.y - 10}
                textAnchor="middle"
                className="text-[10px] font-bold fill-brand-600 dark:fill-brand-400 opacity-90"
              >
                {pt.score}%
              </text>
              <text
                x={pt.x}
                y={padding + chartH + 16}
                textAnchor="middle"
                className="text-[9px] fill-slate-400 font-medium"
              >
                {pt.date}
              </text>
            </g>
          ))}
        </svg>
      </div>
    );
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 animate-fadeIn">
      {/* Welcome Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-brand-600 via-indigo-600 to-violet-600 p-8 sm:p-10 text-white shadow-xl shadow-brand-500/20">
        <div className="relative z-10 max-w-2xl">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-white/20 backdrop-blur-md text-xs font-semibold uppercase tracking-wider mb-4">
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            <span>AI Student Workspace</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
            Welcome back, {user?.name || 'Student'}!
          </h1>
          <p className="mt-2 text-slate-100/90 text-sm sm:text-base leading-relaxed">
            Your notes, quiz performance, interactive flashcards, and exam plans are ready. What would you like to focus on today?
          </p>

          {/* Gemini Deep Topic Search Bar */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (quickTopic.trim()) {
                navigate(`/questions?topic=${encodeURIComponent(quickTopic.trim())}`);
              }
            }}
            className="mt-5 max-w-xl"
          >
            <div className="relative flex items-center">
              <input
                type="text"
                value={quickTopic}
                onChange={(e) => setQuickTopic(e.target.value)}
                placeholder="Search any topic (e.g. Java, DBMS, OS) for Gemini notes & likely exam Qs..."
                className="w-full pl-10 pr-28 py-3 bg-white/15 hover:bg-white/20 focus:bg-white/25 backdrop-blur-md border border-white/25 rounded-2xl text-white placeholder-blue-100 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-white/50 shadow-inner transition-all"
              />
              <Search className="w-4 h-4 text-blue-200 absolute left-3.5" />
              <button
                type="submit"
                disabled={!quickTopic.trim()}
                className="absolute right-1.5 px-3.5 py-1.5 rounded-xl bg-white text-brand-700 font-bold text-xs shadow-md hover:bg-slate-100 transition-all disabled:opacity-50"
              >
                Analyze AI
              </button>
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px] text-blue-100">
              <span className="font-semibold text-amber-200">Popular:</span>
              {['Java', 'DBMS', 'Operating Systems', 'Networks'].map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => navigate(`/questions?topic=${encodeURIComponent(t)}`)}
                  className="px-2 py-0.5 rounded-md bg-white/10 hover:bg-white/20 border border-white/10 transition-colors"
                >
                  {t}
                </button>
              ))}
            </div>
          </form>

          {/* Quick Action Shortcuts */}
          <div className="mt-5 flex flex-wrap gap-2.5">
            <Link
              to="/questions"
              className="inline-flex items-center space-x-2 px-4 py-2 rounded-xl bg-amber-400 text-amber-950 font-bold text-xs shadow-md hover:bg-amber-300 transition-all hover:scale-[1.02]"
            >
              <Award className="w-3.5 h-3.5" />
              <span>Likely Exam Questions</span>
            </Link>
            <Link
              to="/notes"
              className="inline-flex items-center space-x-2 px-4 py-2 rounded-xl bg-white text-brand-700 font-semibold text-xs shadow-md hover:bg-slate-50 transition-all hover:scale-[1.02]"
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>Upload Notes / Topic</span>
            </Link>
            <Link
              to="/quiz"
              className="inline-flex items-center space-x-2 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 backdrop-blur-md text-white font-semibold text-xs border border-white/20 transition-all"
            >
              <HelpCircle className="w-3.5 h-3.5" />
              <span>Take Quiz</span>
            </Link>
            <Link
              to="/flashcards"
              className="inline-flex items-center space-x-2 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 backdrop-blur-md text-white font-semibold text-xs border border-white/20 transition-all"
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Flashcards</span>
            </Link>
            <Link
              to="/planner"
              className="inline-flex items-center space-x-2 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 backdrop-blur-md text-white font-semibold text-xs border border-white/20 transition-all"
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>Study Plan</span>
            </Link>
          </div>
        </div>
      </div>

      {/* 4 Metric Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        <Link
          to="/notes"
          className="glass-panel bg-white/80 dark:bg-slate-900/80 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 hover:border-brand-500/40 transition-all group"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Saved Notes
            </span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <BookOpen className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white">
            {metrics.totalNotes}
          </p>
          <span className="text-[11px] text-brand-600 dark:text-brand-400 font-semibold flex items-center mt-2 group-hover:translate-x-0.5 transition-transform">
            <span>Manage notes</span>
            <ArrowRight className="w-3 h-3 ml-1" />
          </span>
        </Link>

        <Link
          to="/quiz"
          className="glass-panel bg-white/80 dark:bg-slate-900/80 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 hover:border-purple-500/40 transition-all group"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Quizzes Taken
            </span>
            <div className="w-8 h-8 rounded-lg bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 flex items-center justify-center">
              <HelpCircle className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white">
            {metrics.totalQuizzes}
          </p>
          <span className="text-[11px] text-purple-600 dark:text-purple-400 font-semibold flex items-center mt-2 group-hover:translate-x-0.5 transition-transform">
            <span>Challenge yourself</span>
            <ArrowRight className="w-3 h-3 ml-1" />
          </span>
        </Link>

        <div className="glass-panel bg-white/80 dark:bg-slate-900/80 p-5 rounded-2xl border border-slate-200 dark:border-slate-800">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Average Score
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <Award className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white">
            {metrics.averageScore}%
          </p>
          <p className="text-[11px] text-slate-400 mt-2">
            Based on all completed tests
          </p>
        </div>

        <Link
          to="/planner"
          className="glass-panel bg-white/80 dark:bg-slate-900/80 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 hover:border-emerald-500/40 transition-all group"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Study Plans
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <Calendar className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white">
            {metrics.activePlansCount}
          </p>
          <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold flex items-center mt-2 group-hover:translate-x-0.5 transition-transform">
            <span>View timeline</span>
            <ArrowRight className="w-3 h-3 ml-1" />
          </span>
        </Link>
      </div>

      {/* Progress Chart */}
      <div className="glass-panel bg-white/80 dark:bg-slate-900/80 rounded-3xl p-6 sm:p-8 border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-2">
            <TrendingUp className="w-5 h-5 text-brand-600 dark:text-brand-400" />
            <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
              Quiz Score Performance Trend
            </h2>
          </div>
          <span className="text-xs text-slate-400 font-medium">Recent Sessions</span>
        </div>
        {renderProgressChart()}
      </div>

      {/* 2 Column Split: Saved Notes & Past Quizzes */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Saved Notes (7 cols) */}
        <div className="lg:col-span-7 glass-panel bg-white/80 dark:bg-slate-900/80 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center space-x-2">
              <BookOpen className="w-4 h-4 text-brand-500" />
              <span>Recent Notes ({recentNotes.length})</span>
            </h3>
            <Link
              to="/notes"
              className="text-xs font-semibold text-brand-600 dark:text-brand-400 hover:underline flex items-center space-x-1"
            >
              <span>View All</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          {recentNotes.length === 0 ? (
            <div className="py-8 text-center text-slate-500 text-xs">
              <p>No notes saved yet.</p>
              <Link
                to="/notes"
                className="mt-2 inline-flex items-center space-x-1 text-brand-600 font-semibold hover:underline"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Upload or Paste Notes</span>
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {recentNotes.map((note) => (
                <div
                  key={note._id}
                  className="p-4 rounded-2xl bg-slate-50/60 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3"
                >
                  <div className="flex items-center space-x-3 truncate">
                    <div className="w-9 h-9 rounded-xl bg-brand-100 dark:bg-brand-950/60 text-brand-600 dark:text-brand-400 flex items-center justify-center flex-shrink-0">
                      <FileText className="w-4 h-4" />
                    </div>
                    <div className="truncate">
                      <p className="text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-200 truncate max-w-xs">
                        {note.title}
                      </p>
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        {new Date(note.createdAt).toLocaleDateString()} • {note.sourceType.toUpperCase()}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-1.5 text-xs">
                    <Link
                      to={`/questions?noteId=${note._id}`}
                      className="px-2 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-medium hover:bg-indigo-100 dark:hover:bg-indigo-900/60 transition-colors flex items-center space-x-1"
                      title="AI-Predicted Likely Exam Questions"
                    >
                      <Award className="w-3.5 h-3.5" />
                      <span>Exam Qs</span>
                    </Link>
                    <Link
                      to={`/quiz?noteId=${note._id}`}
                      className="px-2.5 py-1.5 rounded-lg bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 font-medium hover:bg-purple-100 dark:hover:bg-purple-900/60 transition-colors flex items-center space-x-1"
                    >
                      <HelpCircle className="w-3.5 h-3.5" />
                      <span>Quiz</span>
                    </Link>
                    <Link
                      to={`/flashcards?noteId=${note._id}`}
                      className="px-2.5 py-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 font-medium hover:bg-amber-100 dark:hover:bg-amber-900/60 transition-colors flex items-center space-x-1"
                    >
                      <Layers className="w-3.5 h-3.5" />
                      <span>Cards</span>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Quiz Scores (5 cols) */}
        <div className="lg:col-span-5 glass-panel bg-white/80 dark:bg-slate-900/80 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center space-x-2">
              <Award className="w-4 h-4 text-purple-500" />
              <span>Past Quiz Scores</span>
            </h3>
            <Link
              to="/quiz"
              className="text-xs font-semibold text-purple-600 dark:text-purple-400 hover:underline flex items-center space-x-1"
            >
              <span>Arena</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          {recentQuizzes.length === 0 ? (
            <div className="py-8 text-center text-slate-500 text-xs">
              <p>No past quizzes completed yet.</p>
              <Link
                to="/quiz"
                className="mt-2 inline-flex items-center space-x-1 text-purple-600 font-semibold hover:underline"
              >
                <span>Take a Practice Quiz</span>
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {recentQuizzes.map((q) => (
                <div
                  key={q._id}
                  className="p-3.5 rounded-2xl bg-slate-50/60 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 flex items-center justify-between"
                >
                  <div className="truncate pr-2">
                    <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
                      {q.noteTitle}
                    </p>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      {new Date(q.createdAt).toLocaleDateString()} • {q.score} / {q.totalQuestions} Correct
                    </p>
                  </div>

                  <span
                    className={`px-2.5 py-1 rounded-xl text-xs font-bold ${
                      q.percentage >= 80
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                        : q.percentage >= 60
                        ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                        : 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300'
                    }`}
                  >
                    {q.percentage}%
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
