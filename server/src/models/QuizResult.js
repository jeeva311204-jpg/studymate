const mongoose = require('mongoose');

const quizQuestionResultSchema = new mongoose.Schema({
  question: {
    type: String,
    required: true,
  },
  options: [{
    type: String,
    required: true,
  }],
  correctAnswer: {
    type: String,
    required: true,
  },
  userAnswer: {
    type: String,
    required: true,
  },
  isCorrect: {
    type: Boolean,
    required: true,
  },
  explanation: {
    type: String,
    default: '',
  },
});

const quizResultSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    note: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Note',
      default: null,
    },
    noteTitle: {
      type: String,
      default: 'General Study Session',
    },
    score: {
      type: Number,
      required: true,
    },
    totalQuestions: {
      type: Number,
      required: true,
      default: 10,
    },
    percentage: {
      type: Number,
      required: true,
    },
    questions: [quizQuestionResultSchema],
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('QuizResult', quizResultSchema);
