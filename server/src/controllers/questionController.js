const Note = require('../models/Note');
const { getGeminiClient, generateWithModelFallback } = require('../config/gemini');
const { executeWithRetry } = require('../utils/aiValidator');
const { MAX_NOTE_CHARACTERS } = require('../config/constants');

// Schema validator for Exam Question Bank
const validateExamQuestionSchema = (parsed) => {
  if (!parsed || typeof parsed !== 'object') {
    return { valid: false, error: 'Expected a JSON object with exam question categories.' };
  }

  const { twoMarks, eightMarks, sixteenMarks, importantTopics } = parsed;

  if (!Array.isArray(twoMarks) || twoMarks.length === 0) {
    return { valid: false, error: 'Expected an array of 2-mark questions (Part A).' };
  }
  if (!Array.isArray(eightMarks) || eightMarks.length === 0) {
    return { valid: false, error: 'Expected an array of 8-mark questions (Part B).' };
  }
  if (!Array.isArray(sixteenMarks) || sixteenMarks.length === 0) {
    return { valid: false, error: 'Expected an array of 16-mark questions (Part C).' };
  }

  // Normalize twoMarks
  const cleanTwoMarks = twoMarks.map((q, idx) => ({
    question: q.question || `Important 2-Mark Question ${idx + 1}`,
    answer: q.answer || 'Definition and core concept.',
    marks: 2,
    frequency: q.frequency || 'AI-predicted likely question',
    keyTopics: Array.isArray(q.keyTopics) ? q.keyTopics : [],
  }));

  // Normalize eightMarks
  const cleanEightMarks = eightMarks.map((q, idx) => ({
    question: q.question || `Important 8-Mark Question ${idx + 1}`,
    answer: q.answer || 'Detailed point-by-point explanation.',
    marks: 8,
    frequency: q.frequency || 'AI-predicted likely question',
    keyTopics: Array.isArray(q.keyTopics) ? q.keyTopics : [],
  }));

  // Normalize sixteenMarks
  const cleanSixteenMarks = sixteenMarks.map((q, idx) => ({
    question: q.question || `Important 16-Mark Comprehensive Question ${idx + 1}`,
    answer: q.answer || 'Comprehensive essay breakdown.',
    marks: 16,
    frequency: q.frequency || 'Core syllabus topic',
    keyTopics: Array.isArray(q.keyTopics) ? q.keyTopics : [],
  }));

  // Normalize importantTopics
  const cleanTopics = Array.isArray(importantTopics)
    ? importantTopics.map((t) => ({
        topic: typeof t === 'string' ? t : t.topic || 'Core Subject Unit',
        probability: t.probability || 'High relevance',
        description: t.description || 'Core syllabus topic predicted as important by AI.',
        sampleQuestion: t.sampleQuestion || '',
        sampleAnswer: t.sampleAnswer || '',
      }))
    : [];

  return {
    valid: true,
    data: {
      analysisSummary:
        parsed.analysisSummary ||
        'AI-predicted likely examination questions categorized by 2-mark, 8-mark, and 16-mark weightage based on academic curriculum patterns.',
      importantTopics: cleanTopics,
      twoMarks: cleanTwoMarks,
      eightMarks: cleanEightMarks,
      sixteenMarks: cleanSixteenMarks,
    },
  };
};

/**
 * @desc    Generate AI-Predicted Likely Exam Question Bank (2 Marks, 8 Marks, 16 Marks with Answers)
 * @route   POST /api/questions/generate
 * @access  Private
 */
exports.generateExamQuestions = async (req, res) => {
  const client = getGeminiClient();

  // If Gemini key is not configured, return 503 immediately
  if (!client) {
    return res.status(503).json({
      error: true,
      message:
        'AI Exam Question Generator is unavailable: GEMINI_API_KEY is not configured in server/.env. Please configure a valid API key.',
    });
  }

  try {
    const { noteId, topic: customTopic, content: rawInput } = req.body;

    let textToAnalyze = rawInput || '';
    let subjectTitle = customTopic || 'Academic Subject';
    let targetNote = null;

    if (noteId) {
      targetNote = await Note.findOne({ _id: noteId, user: req.user._id });
      if (!targetNote) {
        return res.status(404).json({ message: 'Note not found.' });
      }
      textToAnalyze = targetNote.rawContent;
      subjectTitle = targetNote.title;
    }

    if (!textToAnalyze && !customTopic) {
      return res.status(400).json({
        message: 'Please provide either a noteId, study content, or a subject topic (e.g. DBMS).',
      });
    }

    const wasTruncated = textToAnalyze.length > MAX_NOTE_CHARACTERS;
    const truncationNotice = wasTruncated
      ? `Note text exceeded ${MAX_NOTE_CHARACTERS.toLocaleString()} characters. Only the first ${MAX_NOTE_CHARACTERS.toLocaleString()} characters were analyzed.`
      : null;

    const basePrompt = `You are a distinguished university professor and academic curriculum specialist.

TASK: Formulate an **AI-predicted Likely Exam Question Bank with Accurate Model Answers** organized into Part A (2 Marks), Part B (8 Marks), and Part C (16 Marks) based on standard academic curriculum weightage.

Subject/Topic: "${subjectTitle}"

CRITICAL INSTRUCTIONS:
1. CURRICULUM ANALYSIS:
   - Identify the most critical syllabus concepts and formulate questions that rigorously test fundamental principles, analytical mechanisms, and definitions according to university engineering/science curricula.
2. HONEST PREDICTIONS:
   - Provide realistic, high-yield practice questions that represent core examination topics without claiming to be exact official past papers.

STRICT JSON SCHEMA:
Return ONLY a valid JSON object matching this exact structure:
{
  "analysisSummary": "2-3 sentence overview analyzing likely examination themes and core topic weightage for ${subjectTitle} based on academic curriculum patterns.",
  "importantTopics": [
    {
      "topic": "Name of core module / topic",
      "probability": "e.g. High Syllabus Relevance",
      "description": "Why this topic is central to the curriculum",
      "sampleQuestion": "Key representative question testing this topic",
      "sampleAnswer": "Concise model answer key explaining the concept"
    }
  ],
  "twoMarks": [
    {
      "question": "Clear, concise 2-mark conceptual or definition question (e.g. Define ACID properties, Distinguish between Primary and Foreign Key, State Amdahl's Law)",
      "answer": "Concise, 100% accurate 2-3 sentence model answer with essential technical keywords bolded for maximum marks.",
      "marks": 2,
      "frequency": "AI-predicted likely question",
      "keyTopics": ["Keyword1", "Keyword2"]
    }
  ],
  "eightMarks": [
    {
      "question": "Structured 8-mark analytical or comparative question (e.g. Explain 3NF and BCNF normalization with suitable examples, Describe the working of B-Trees)",
      "answer": "Structured model answer organized with clear headings, bullet points, mechanisms, examples, and comparison table or steps required to achieve 8/8 marks.",
      "marks": 8,
      "frequency": "Core syllabus topic",
      "keyTopics": ["Topic1", "Topic2"]
    }
  ],
  "sixteenMarks": [
    {
      "question": "Comprehensive 16-mark university essay / design / architectural / case-study question (e.g. Discuss in detail the architecture of a Relational Database Management System, explain Concurrency Control using Two-Phase Locking with proof of serializability)",
      "answer": "In-depth, academic-grade model answer with full structure:\\n### 1. Introduction & Core Principle\\n### 2. Architectural Blueprint / Mechanism (explain diagrams/components clearly)\\n### 3. Step-by-Step Mathematical/Technical Elaboration\\n### 4. Practical Real-World Example or Code/Query Demonstration\\n### 5. Advantages, Limitations & Exam Summary",
      "marks": 16,
      "frequency": "Comprehensive essay question",
      "keyTopics": ["MajorTopic1", "MajorTopic2"]
    }
  ]
}

SPECIFICATIONS:
1. Provide at least 6 distinct 2-mark questions.
2. Provide at least 4 distinct 8-mark questions.
3. Provide at least 2 distinct 16-mark comprehensive questions.
4. Ensure answers are deeply accurate, academically authoritative, and structured for maximum marks in university evaluations.
5. In "importantTopics", include at least 3-5 core topics with their question and answer.
6. Output ONLY the JSON object.

Study Material:
"""
${(textToAnalyze || subjectTitle).slice(0, MAX_NOTE_CHARACTERS)}
"""`;

    const generatorFn = async (correctiveFeedback) => {
      const prompt = correctiveFeedback ? `${basePrompt}\n\n${correctiveFeedback}` : basePrompt;
      return await generateWithModelFallback(prompt, {
        generationConfig: {
          responseMimeType: 'application/json',
        },
      });
    };

    const questionBank = await executeWithRetry(generatorFn, validateExamQuestionSchema);

    // If linked to an existing Note in DB, save questions to the note document
    if (targetNote) {
      targetNote.examQuestions = {
        generatedAt: new Date(),
        analysisSummary: questionBank.analysisSummary,
        importantTopics: questionBank.importantTopics,
        twoMarks: questionBank.twoMarks,
        eightMarks: questionBank.eightMarks,
        sixteenMarks: questionBank.sixteenMarks,
      };
      await targetNote.save();
    }

    return res.status(200).json({
      subjectTitle,
      noteId: noteId || null,
      questionBank,
      truncated: wasTruncated,
      truncationNotice,
    });
  } catch (err) {
    console.error('[QuestionController.generateExamQuestions] Error:', err);
    return res.status(503).json({
      error: true,
      message: err.message || 'Failed to generate Exam Question Bank. Gemini AI service is unavailable.',
    });
  }
};

/**
 * @desc    Get saved exam question bank for a note
 * @route   GET /api/questions/note/:noteId
 * @access  Private
 */
exports.getQuestionsByNoteId = async (req, res) => {
  try {
    const note = await Note.findOne({ _id: req.params.noteId, user: req.user._id });
    if (!note) {
      return res.status(404).json({ message: 'Note not found.' });
    }

    return res.status(200).json({
      noteTitle: note.title,
      examQuestions: note.examQuestions || null,
    });
  } catch (err) {
    console.error('[QuestionController.getQuestionsByNoteId] Error:', err);
    return res.status(500).json({ message: 'Failed to retrieve exam questions.' });
  }
};
