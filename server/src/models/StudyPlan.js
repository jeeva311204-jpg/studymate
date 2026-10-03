const mongoose = require('mongoose');

const taskItemSchema = new mongoose.Schema({
  text: {
    type: String,
    required: true,
  },
  completed: {
    type: Boolean,
    default: false,
  },
});

const dayScheduleSchema = new mongoose.Schema({
  dayNumber: {
    type: Number,
    required: true,
  },
  date: {
    type: String,
    required: true,
  },
  focusTopic: {
    type: String,
    required: true,
  },
  tasks: [taskItemSchema],
  estimatedMinutes: {
    type: Number,
    default: 120,
  },
  tips: {
    type: String,
    default: '',
  },
});

const studyPlanSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: [true, 'Plan title is required'],
      trim: true,
    },
    examDate: {
      type: Date,
      required: true,
    },
    dailyHours: {
      type: Number,
      required: true,
      min: 0.5,
      max: 16,
    },
    notesCovered: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Note',
      },
    ],
    schedule: [dayScheduleSchema],
  },
  {
    timestamps: true,
  }
);

// Virtual for calculating completion rate
studyPlanSchema.virtual('progress').get(function () {
  let total = 0;
  let done = 0;
  if (!this.schedule || this.schedule.length === 0) return 0;
  this.schedule.forEach((day) => {
    (day.tasks || []).forEach((task) => {
      total += 1;
      if (task.completed) done += 1;
    });
  });
  return total > 0 ? Math.round((done / total) * 100) : 0;
});

studyPlanSchema.set('toJSON', { virtuals: true });
studyPlanSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('StudyPlan', studyPlanSchema);
