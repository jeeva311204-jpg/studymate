const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema(
  {
    role: {
      type: String,
      enum: ['user', 'assistant'],
      required: true,
    },
    content: {
      type: String,
      required: true,
      maxlength: 120000,
    },
    svg: {
      type: String,
      default: null,
    },
    description: {
      type: String,
      default: null,
    },
    mode: {
      type: String,
      default: 'auto',
    },
    hasImage: {
      type: Boolean,
      default: false,
    },
    generatedImage: {
      type: Boolean,
      default: false,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: true }
);

const conversationSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80,
    },
    messages: {
      type: [messageSchema],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for querying user's conversations ordered by updatedAt
conversationSchema.index({ user: 1, updatedAt: -1 });

// TTL index to automatically expire conversations 90 days after updatedAt
conversationSchema.index({ updatedAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

module.exports = mongoose.model('Conversation', conversationSchema);
