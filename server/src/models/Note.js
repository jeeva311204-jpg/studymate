const mongoose = require('mongoose');

const flashcardSchema = new mongoose.Schema({
  front: {
    type: String,
    required: true,
  },
  back: {
    type: String,
    required: true,
  },
  mastered: {
    type: Boolean,
    default: false,
  },
});

const questionItemSchema = new mongoose.Schema({
  question: { type: String, required: true },
  answer: { type: String, required: true },
  marks: { type: Number, enum: [2, 8, 16], required: true },
  frequency: { type: String },
  keyTopics: [{ type: String }],
});

const examQuestionsSchema = new mongoose.Schema({
  generatedAt: { type: Date, default: Date.now },
  analysisSummary: { type: String, default: '' },
  importantTopics: [
    {
      topic: { type: String, required: true },
      probability: { type: String, default: 'High' },
      description: { type: String, default: '' },
    },
  ],
  twoMarks: [questionItemSchema],
  eightMarks: [questionItemSchema],
  sixteenMarks: [questionItemSchema],
});

const topicModuleSchema = new mongoose.Schema({
  id: { type: String },
  title: { type: String, required: true },
  importance: { type: String },
  keyConcepts: [{ type: String }],
  notes: { type: String, default: '' },
  twoMarks: [
    {
      question: { type: String },
      answer: { type: String },
      frequency: { type: String },
    },
  ],
  eightMarks: [
    {
      question: { type: String },
      answer: { type: String },
      frequency: { type: String },
    },
  ],
});

const noteSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: [true, 'Note title is required'],
      trim: true,
      maxlength: 200,
    },
    sourceType: {
      type: String,
      enum: ['paste', 'pdf', 'txt', 'topic'],
      default: 'paste',
    },
    originalFilename: {
      type: String,
      default: null,
    },
    rawContent: {
      type: String,
      required: [true, 'Raw content is required'],
    },
    summary: {
      type: String,
      default: '',
    },
    flashcards: [flashcardSchema],
    examQuestions: {
      type: examQuestionsSchema,
      default: null,
    },
    topicModules: [topicModuleSchema],
    tags: [
      {
        type: String,
        trim: true,
      },
    ],
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Note', noteSchema);
