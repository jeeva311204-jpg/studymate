const mongoose = require('mongoose');

const askUsageSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    date: {
      type: String, // 'YYYY-MM-DD'
      required: true,
      index: true,
    },
    count: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index to ensure one usage record per user per day
askUsageSchema.index({ user: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('AskUsage', askUsageSchema);
