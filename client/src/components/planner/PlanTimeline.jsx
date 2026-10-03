import React, { useState } from 'react';
import api from '../../services/api';
import {
  Calendar,
  Clock,
  CheckCircle2,
  Circle,
  Lightbulb,
  Sparkles,
  Trash2,
  ChevronRight,
  TrendingUp,
} from 'lucide-react';

const PlanTimeline = ({ plan, onPlanUpdated, onPlanDeleted }) => {
  const [loadingTaskId, setLoadingTaskId] = useState(null);

  if (!plan) return null;

  const examDate = new Date(plan.examDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const daysDiff = Math.ceil((examDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  // Calculate task progress
  let totalTasks = 0;
  let completedTasks = 0;
  plan.schedule.forEach((day) => {
    (day.tasks || []).forEach((t) => {
      totalTasks += 1;
      if (t.completed) completedTasks += 1;
    });
  });
  const progressPercent = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  const handleToggleTask = async (dayIndex, taskIndex) => {
    const key = `${dayIndex}-${taskIndex}`;
    setLoadingTaskId(key);

    try {
      const res = await api.patch(`/planner/${plan._id}/toggle-task`, {
        dayIndex,
        taskIndex,
      });
      if (onPlanUpdated) {
        onPlanUpdated(res.data.plan);
      }
    } catch (err) {
      console.error('Failed to toggle task:', err);
    } finally {
      setLoadingTaskId(null);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(`Are you sure you want to delete "${plan.title}"?`)) return;
    try {
      await api.delete(`/planner/${plan._id}`);
      if (onPlanDeleted) {
        onPlanDeleted(plan._id);
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to delete plan');
    }
  };

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Plan Header Card */}
      <div className="glass-panel bg-white/90 dark:bg-slate-900/90 rounded-3xl p-6 sm:p-8 border border-slate-200 dark:border-slate-800 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center space-x-2">
              <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/60 flex items-center space-x-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                <span>AI Study Roadmap</span>
              </span>
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                {daysDiff > 0 ? `${daysDiff} Days Until Exam` : 'Exam Today!'}
              </span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white mt-2 tracking-tight">
              {plan.title}
            </h2>
          </div>

          <button
            type="button"
            onClick={handleDelete}
            className="p-2.5 rounded-xl border border-rose-200 dark:border-rose-900/60 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-xs font-semibold flex items-center space-x-1.5 transition-colors"
            title="Delete this study plan"
          >
            <Trash2 className="w-4 h-4" />
            <span className="hidden sm:inline">Delete Plan</span>
          </button>
        </div>

        {/* Plan Details Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 rounded-2xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 mb-6">
          <div>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 flex items-center space-x-1">
              <Calendar className="w-3.5 h-3.5" />
              <span>Exam Date</span>
            </span>
            <p className="text-sm font-bold text-slate-800 dark:text-slate-200 mt-1">
              {examDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </p>
          </div>

          <div>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 flex items-center space-x-1">
              <Clock className="w-3.5 h-3.5" />
              <span>Study Hours</span>
            </span>
            <p className="text-sm font-bold text-slate-800 dark:text-slate-200 mt-1">
              {plan.dailyHours} hrs / day
            </p>
          </div>

          <div>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 flex items-center space-x-1">
              <TrendingUp className="w-3.5 h-3.5" />
              <span>Milestones</span>
            </span>
            <p className="text-sm font-bold text-slate-800 dark:text-slate-200 mt-1">
              {plan.schedule.length} Days Planned
            </p>
          </div>

          <div>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 flex items-center space-x-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Tasks Done</span>
            </span>
            <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400 mt-1">
              {completedTasks} of {totalTasks} ({progressPercent}%)
            </p>
          </div>
        </div>

        {/* Progress Bar */}
        <div>
          <div className="flex justify-between items-center text-xs font-semibold text-slate-600 dark:text-slate-400 mb-2">
            <span>Overall Roadmap Progress</span>
            <span className="text-emerald-600 dark:text-emerald-400 font-bold">{progressPercent}% Completed</span>
          </div>
          <div className="w-full bg-slate-100 dark:bg-slate-800 h-2.5 rounded-full overflow-hidden">
            <div
              className="bg-gradient-to-r from-emerald-500 to-teal-500 h-full rounded-full transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      </div>

      {/* Day by Day Timeline Cards */}
      <div className="space-y-5">
        <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center space-x-2">
          <span>Day-by-Day Action Plan</span>
        </h3>

        {plan.schedule.map((day, dayIdx) => {
          const isAllCompleted = day.tasks && day.tasks.every((t) => t.completed);

          return (
            <div
              key={day.dayNumber || dayIdx}
              className={`glass-panel rounded-2xl p-6 border transition-all ${
                isAllCompleted
                  ? 'bg-emerald-50/30 dark:bg-emerald-950/20 border-emerald-300/60 dark:border-emerald-900/60'
                  : 'bg-white/80 dark:bg-slate-900/80 border-slate-200 dark:border-slate-800'
              }`}
            >
              {/* Day Card Header */}
              <div className="flex flex-wrap items-center justify-between gap-2 mb-4 pb-3 border-b border-slate-100 dark:border-slate-800/80">
                <div className="flex items-center space-x-3">
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs ${
                      isAllCompleted
                        ? 'bg-emerald-600 text-white'
                        : 'bg-brand-100 dark:bg-brand-950/60 text-brand-700 dark:text-brand-300'
                    }`}
                  >
                    D{day.dayNumber}
                  </div>
                  <div>
                    <h4 className="text-base font-bold text-slate-900 dark:text-white">
                      {day.focusTopic}
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {day.date} • {day.estimatedMinutes} mins allocated
                    </p>
                  </div>
                </div>

                {isAllCompleted && (
                  <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 flex items-center space-x-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Day Completed</span>
                  </span>
                )}
              </div>

              {/* Actionable Tasks Checklist */}
              <div className="space-y-2.5 mb-4">
                {day.tasks.map((task, taskIdx) => {
                  const key = `${dayIdx}-${taskIdx}`;
                  const isUpdating = loadingTaskId === key;

                  return (
                    <button
                      key={taskIdx}
                      type="button"
                      onClick={() => handleToggleTask(dayIdx, taskIdx)}
                      className={`w-full text-left p-3 rounded-xl border transition-all flex items-start space-x-3 ${
                        task.completed
                          ? 'bg-emerald-50/50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900/40 text-slate-500 dark:text-slate-400 line-through'
                          : 'bg-slate-50/50 dark:bg-slate-800/40 border-slate-200/80 dark:border-slate-800 text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`}
                    >
                      <div className="mt-0.5 flex-shrink-0">
                        {task.completed ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                        ) : (
                          <Circle className="w-4 h-4 text-slate-400 hover:text-brand-500" />
                        )}
                      </div>
                      <span className="text-xs font-medium leading-relaxed flex-1">
                        {task.text}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Daily Tip Callout */}
              {day.tips && (
                <div className="p-3 bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/50 dark:border-amber-900/40 rounded-xl flex items-start space-x-2 text-xs text-slate-700 dark:text-slate-300">
                  <Lightbulb className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                  <span>
                    <strong className="text-amber-800 dark:text-amber-300">Study Tip: </strong>
                    {day.tips}
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default PlanTimeline;
