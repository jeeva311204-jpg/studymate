const mongoose = require('mongoose');
const Note = require('../models/Note');
const QuizResult = require('../models/QuizResult');
const { getGenerativeModel, getGeminiClient, generateWithModelFallback } = require('../config/gemini');
const { executeWithRetry } = require('../utils/aiValidator');
const { MAX_NOTE_CHARACTERS } = require('../config/constants');

// Helper to validate the 10-MCQ schema with AI-predicted topic metadata and model QA
const validateQuizSchema = (parsed) => {
  let questions = Array.isArray(parsed) ? parsed : (parsed?.questions || parsed?.quiz || []);
  if (!Array.isArray(questions)) {
    return { valid: false, error: 'Expected a JSON array of questions or an object with a questions array.' };
  }
  if (questions.length < 10) {
    return { valid: false, error: `Expected 10 questions, but received ${questions.length}.` };
  }

  // Check each question structure
  for (let i = 0; i < 10; i++) {
    const q = questions[i];
    if (!q || typeof q !== 'object') {
      return { valid: false, error: `Question ${i + 1} is not a valid object.` };
    }
    if (!q.question || typeof q.question !== 'string') {
      return { valid: false, error: `Question ${i + 1} is missing a valid 'question' text.` };
    }
    if (!Array.isArray(q.options) || q.options.length !== 4) {
      return { valid: false, error: `Question ${i + 1} must contain exactly 4 options.` };
    }
    if (q.options.some((opt) => typeof opt !== 'string' || !opt.trim())) {
      return { valid: false, error: `Question ${i + 1} contains empty or invalid options.` };
    }

    // Reject questions with duplicate options
    const normalizedOptions = q.options.map((opt) => opt.trim().toLowerCase());
    const uniqueOptions = new Set(normalizedOptions);
    if (uniqueOptions.size !== q.options.length) {
      return {
        valid: false,
        error: `Question ${i + 1} contains duplicate options. All 4 options must be distinct.`,
      };
    }

    if (!q.correctAnswer || typeof q.correctAnswer !== 'string') {
      return { valid: false, error: `Question ${i + 1} is missing 'correctAnswer'.` };
    }

    // Check if correctAnswer is one of the options (case-insensitive or exact)
    const hasMatch = normalizedOptions.includes(q.correctAnswer.trim().toLowerCase());
    if (!hasMatch) {
      return {
        valid: false,
        error: `Question ${i + 1} 'correctAnswer' ("${q.correctAnswer}") does not match any of the provided options.`,
      };
    }
  }

  const validatedQuestions = questions.slice(0, 10).map((q, idx) => ({
    id: q.id || idx + 1,
    question: q.question,
    options: q.options,
    correctAnswer: q.correctAnswer,
    explanation: q.explanation || 'Detailed academic explanation.',
    importantTopic: q.importantTopic || 'Core Syllabus Concept',
    examFrequency: q.examFrequency || 'AI-predicted likely question',
  }));

  const analysisSummary =
    parsed?.analysisSummary ||
    'AI-predicted practice questions generated from syllabus topics and core academic concepts.';
  const importantTopics = Array.isArray(parsed?.importantTopics) ? parsed.importantTopics : [];
  const isPastPaperBased = false;

  return {
    valid: true,
    data: {
      questions: validatedQuestions,
      analysisSummary,
      importantTopics,
      isPastPaperBased,
    },
  };
};

// @desc    Generate 10 MCQs from a note, raw text, or topic (AI-predicted likely questions)
// @route   POST /api/quiz/generate
// @access  Private
exports.generateQuiz = async (req, res) => {
  const client = getGeminiClient();

  // If Gemini key is not configured, do not return fake content; return 503 error immediately
  if (!client) {
    return res.status(503).json({
      error: true,
      message: 'AI Quiz generator is unavailable: GEMINI_API_KEY is not configured in server/.env. Please configure a valid API key.',
    });
  }

  try {
    const { noteId, content: rawInput, noteTitle, topic } = req.body;

    let textToAnalyze = rawInput || '';
    let title = noteTitle || topic || 'Study Session';

    if (noteId) {
      const note = await Note.findOne({ _id: noteId, user: req.user._id });
      if (!note) {
        return res.status(404).json({ message: 'Note not found.' });
      }
      textToAnalyze = note.rawContent;
      title = note.title;
    } else if (!textToAnalyze && topic) {
      textToAnalyze = topic.trim();
      title = topic.trim();
    }

    if (!textToAnalyze || textToAnalyze.trim().length < 2) {
      return res.status(400).json({ message: 'Please provide study content, a noteId, or a topic name (e.g. DBMS).' });
    }

    const wasTruncated = textToAnalyze.length > MAX_NOTE_CHARACTERS;
    const truncationNotice = wasTruncated
      ? `Note text exceeded ${MAX_NOTE_CHARACTERS.toLocaleString()} characters. Only the first ${MAX_NOTE_CHARACTERS.toLocaleString()} characters were used for quiz generation.`
      : null;

    const basePrompt = `You are a distinguished university professor and academic curriculum specialist.

TASK: Analyze the following subject / study material and formulate 10 HIGH-YIELD MULTIPLE CHOICE QUESTIONS testing core academic curriculum concepts and exam readiness.

Subject / Focus: "${title}"

REQUIREMENTS:
1. ACADEMIC SYLLABUS ALIGNMENT:
   - Formulate 10 challenging practice multiple choice questions that test fundamental principles, analytical mechanisms, and definitions.
   - For each question, indicate the specific core syllabus topic ("importantTopic") and its relevance ("examFrequency", e.g. "Core Syllabus Concept", "High Syllabus Importance").

2. IMPORTANT TOPICS QA REVIEW:
   - In "importantTopics", provide 3-5 critical syllabus topics with representative sample question + model answer pairs ("topic", "weightage", "sampleQuestion", "sampleAnswer").

STRICT JSON SCHEMA:
Return ONLY a valid JSON object matching this exact structure:
{
  "analysisSummary": "2-3 sentences summarizing core syllabus concepts and predicted examination focus areas for ${title}",
  "isPastPaperBased": false,
  "importantTopics": [
    {
      "topic": "Name of core module / topic",
      "weightage": "e.g. Core Topic (High Syllabus Weightage)",
      "sampleQuestion": "Key representative question testing this topic",
      "sampleAnswer": "Accurate model answer explaining the concept"
    }
  ],
  "questions": [
    {
      "id": 1,
      "question": "Clear, challenging question prompt based on curriculum standards?",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctAnswer": "Option A",
      "explanation": "Detailed university-standard explanation of why this answer is correct and why other options are incorrect.",
      "importantTopic": "Core topic name",
      "examFrequency": "Core Syllabus Concept"
    }
  ]
}

RULES:
1. Exactly 10 questions in "questions".
2. Every question must have EXACTLY 4 distinct options.
3. "correctAnswer" MUST exactly match one of the 4 strings in "options".
4. Include at least 3-5 high-yield topics with question + answer in "importantTopics".
5. Output ONLY the JSON object, no surrounding markdown fences or conversational text.

Study Material / Topic:
"""
${(textToAnalyze || title).slice(0, MAX_NOTE_CHARACTERS)}
"""`;

    const generatorFn = async (correctiveFeedback) => {
      const prompt = correctiveFeedback ? `${basePrompt}\n\n${correctiveFeedback}` : basePrompt;
      return await generateWithModelFallback(prompt, {
        generationConfig: {
          responseMimeType: 'application/json',
        },
      });
    };

    const result = await executeWithRetry(generatorFn, validateQuizSchema);
    const questions = result.questions;

    return res.status(200).json({
      noteTitle: title,
      noteId: noteId || null,
      totalQuestions: 10,
      questions,
      analysisSummary: result.analysisSummary,
      importantTopics: result.importantTopics,
      isPastPaperBased: result.isPastPaperBased,
      sourceMode: result.isPastPaperBased ? '10_year_papers' : 'important_topics_fallback',
      truncated: wasTruncated,
      truncationNotice,
    });
  } catch (err) {
    console.error('[QuizController.generateQuiz] Error:', err);
    return res.status(503).json({
      error: true,
      message: err.message || 'Failed to generate quiz. Gemini AI service is unavailable.',
    });
  }
};

// @desc    Save completed quiz result
// @route   POST /api/quiz/save-result
// @access  Private
exports.saveQuizResult = async (req, res) => {
  try {
    const { noteId, noteTitle, questions } = req.body;

    if (!Array.isArray(questions) || questions.length < 1 || questions.length > 50) {
      return res.status(400).json({ message: 'Questions must be an array of 1 to 50 items.' });
    }

    for (const q of questions) {
      if (
        !q ||
        typeof q !== 'object' ||
        Array.isArray(q) ||
        typeof q.question !== 'string' ||
        typeof q.correctAnswer !== 'string' ||
        typeof q.userAnswer !== 'string' ||
        !Array.isArray(q.options) ||
        !q.options.every((opt) => typeof opt === 'string') ||
        typeof q.isCorrect !== 'boolean'
      ) {
        return res.status(400).json({
          message:
            'Every question must be an object with string fields question, correctAnswer, userAnswer, an options array of strings, and boolean isCorrect.',
        });
      }
    }

    if (noteTitle !== undefined && noteTitle !== null) {
      if (typeof noteTitle !== 'string' || noteTitle.length > 200) {
        return res.status(400).json({
          message: 'noteTitle must be a string up to 200 characters if provided.',
        });
      }
    }

    if (noteId) {
      if (!mongoose.isValidObjectId(noteId)) {
        return res.status(400).json({ message: 'Invalid note id.' });
      }
      const note = await Note.findOne({ _id: noteId, user: req.user._id });
      if (!note) {
        return res.status(404).json({ message: 'Note not found or does not belong to user.' });
      }
    }

    // Ignore client-sent score and compute directly from questions[].isCorrect
    const computedScore = questions.reduce((acc, q) => acc + (q && q.isCorrect === true ? 1 : 0), 0);
    const totalQuestions = questions.length;
    const percentage = Math.round((computedScore / totalQuestions) * 100);

    const quizResult = await QuizResult.create({
      user: req.user._id,
      note: noteId || null,
      noteTitle: noteTitle || 'Study Session',
      score: computedScore,
      totalQuestions,
      percentage,
      questions,
    });

    return res.status(201).json({
      message: 'Quiz result saved successfully',
      resultId: quizResult._id,
      score: computedScore,
      totalQuestions,
      percentage,
    });
  } catch (err) {
    if (err.name === 'ValidationError' || err.name === 'CastError') {
      return res.status(400).json({ message: err.message });
    }
    console.error('[QuizController.saveQuizResult] Error:', err);
    const message = process.env.NODE_ENV === 'production' ? 'Internal server error' : 'Failed to record quiz results.';
    return res.status(500).json({ message });
  }
};

// @desc    Get user's past quiz results
// @route   GET /api/quiz/history
// @access  Private
exports.getQuizHistory = async (req, res) => {
  try {
    const history = await QuizResult.find({ user: req.user._id })
      .select('-questions')
      .sort({ createdAt: -1 })
      .limit(20);

    return res.status(200).json({ history });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to retrieve quiz history.' });
  }
};

// @desc    Get detailed single quiz result by ID
// @route   GET /api/quiz/result/:id
// @access  Private
exports.getQuizResultById = async (req, res) => {
  try {
    const result = await QuizResult.findOne({ _id: req.params.id, user: req.user._id });
    if (!result) {
      return res.status(404).json({ message: 'Quiz result not found.' });
    }
    return res.status(200).json({ result });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to retrieve quiz result.' });
  }
};

exports.validateQuizSchema = validateQuizSchema;
