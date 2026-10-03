const Note = require('../models/Note');
const { extractTextFromFile } = require('../utils/textExtractor');
const { getGenerativeModel, getGeminiClient, generateWithModelFallback } = require('../config/gemini');
const { MAX_NOTE_CHARACTERS } = require('../config/constants');
const { executeWithRetry } = require('../utils/aiValidator');

const MAX_NOTES_PER_USER = 50;

// Schema validator for Deep Topic Analysis (Gemini-like topic breakdown)
const validateTopicAnalysisSchema = (parsed) => {
  if (!parsed || typeof parsed !== 'object') {
    return { valid: false, error: 'Expected an object with topic modules.' };
  }
  const { topic, overview, modules, sixteenMarks } = parsed;
  if (!Array.isArray(modules) || modules.length === 0) {
    return { valid: false, error: 'Expected at least one module in "modules" array.' };
  }

  const cleanModules = modules.map((m, idx) => ({
    id: m.id || `module-${idx + 1}`,
    title: m.title || `Important Subtopic ${idx + 1}`,
    importance: m.importance || 'High syllabus weightage',
    keyConcepts: Array.isArray(m.keyConcepts) ? m.keyConcepts : [],
    notes: m.notes || 'Comprehensive academic lecture notes on this concept.',
    twoMarks: Array.isArray(m.twoMarks)
      ? m.twoMarks.map((q) => ({
          question: q.question || 'Define or explain this concept.',
          answer: q.answer || 'Core technical definition and key keywords.',
          frequency: q.frequency || 'AI-predicted likely question',
        }))
      : [],
    eightMarks: Array.isArray(m.eightMarks)
      ? m.eightMarks.map((q) => ({
          question: q.question || 'Discuss this concept in detail with suitable examples.',
          answer: q.answer || 'Structured technical explanation with bullet points and code.',
          frequency: q.frequency || 'Core syllabus topic',
        }))
      : [],
  }));

  const cleanSixteenMarks = Array.isArray(sixteenMarks)
    ? sixteenMarks.map((q) => ({
        question: q.question || 'Comprehensive essay/architectural question on this subject.',
        answer: q.answer || 'Detailed architectural and conceptual answer with structured sections.',
        frequency: q.frequency || 'Comprehensive essay question',
      }))
    : [];

  return {
    valid: true,
    data: {
      topic: topic || 'Academic Subject',
      overview: overview || 'In-depth academic breakdown and syllabus analysis.',
      modules: cleanModules,
      sixteenMarks: cleanSixteenMarks,
    },
  };
};

// Helper to generate bullet-point summary via Gemini
const generateAiSummary = async (content) => {
  const client = getGeminiClient();

  if (!client) {
    const error = new Error(
      'AI Summary service is unavailable: GEMINI_API_KEY is not configured in server/.env. Please configure a valid Gemini API key.'
    );
    error.statusCode = 503;
    throw error;
  }

  // Model prompt
  const prompt = `You are an expert academic tutor. Analyze the following study notes and generate a concise, high-yield bullet-point summary for a student.

Formatting Guidelines:
Use clean Markdown with bold keywords. Organize with these exact headings:
### 📌 Core Summary & Big Picture
(3-5 concise bullet points summarizing the big picture)

### 🔑 Key Concepts & Definitions
(4-6 essential terms and concepts with bold titles and clear definitions)

### 💡 Critical Takeaways & Exam Tips
(3-4 high-yield points that are most likely to appear on exams)

Notes Content:
"""
${content.slice(0, MAX_NOTE_CHARACTERS)}
"""`;

  return await generateWithModelFallback(prompt);
};

// @desc    Upload note file (PDF or TXT) and auto-summarize
// @route   POST /api/notes/upload
// @access  Private
exports.uploadNotes = async (req, res) => {
  try {
    const noteCount = await Note.countDocuments({ user: req.user._id });
    if (noteCount >= MAX_NOTES_PER_USER) {
      return res.status(400).json({
        error: true,
        message: `Note limit reached: You have reached the maximum limit of ${MAX_NOTES_PER_USER} notes per account. Please delete some existing notes to upload or generate new ones.`,
      });
    }

    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded. Please upload a PDF or TXT file.' });
    }

    const title = req.body.title?.trim() || req.file.originalname.replace(/\.[^/.]+$/, '');
    const extractedText = await extractTextFromFile(
      req.file.buffer,
      req.file.mimetype,
      req.file.originalname
    );

    const isPdf = req.file.mimetype === 'application/pdf' || req.file.originalname.endsWith('.pdf');
    const sourceType = isPdf ? 'pdf' : 'txt';

    // Generate summary - if AI fails, save note first with empty summary
    let summary = '';
    let summaryFailed = false;
    try {
      summary = await generateAiSummary(extractedText);
    } catch (aiErr) {
      console.error('[NoteController.uploadNotes] AI Error:', aiErr.message);
      summary = '';
      summaryFailed = true;
    }

    const wasTruncated = extractedText.length > MAX_NOTE_CHARACTERS;
    const truncationNotice = wasTruncated
      ? `Note text exceeded ${MAX_NOTE_CHARACTERS.toLocaleString()} characters. Only the first ${MAX_NOTE_CHARACTERS.toLocaleString()} characters were used for summary generation.`
      : null;

    const note = await Note.create({
      user: req.user._id,
      title,
      sourceType,
      originalFilename: req.file.originalname,
      rawContent: extractedText,
      summary,
    });

    return res.status(201).json({
      message: summaryFailed
        ? 'Note uploaded, but summary generation failed. You can retry summarizing.'
        : 'Note uploaded and summarized successfully',
      note,
      summaryFailed,
      retry: summaryFailed,
      truncated: wasTruncated,
      truncationNotice,
    });
  } catch (err) {
    console.error('[NoteController.uploadNotes] Error:', err);
    const status = err.statusCode || (err.message?.includes('scanned') ? 400 : 500);
    const message = (status === 500 && process.env.NODE_ENV === 'production')
      ? 'An unexpected internal error occurred.'
      : (err.message || 'Failed to process and upload note.');
    return res.status(status).json({ message });
  }
};

// @desc    Paste raw text note and auto-summarize
// @route   POST /api/notes/paste
// @access  Private
exports.pasteNotes = async (req, res) => {
  try {
    const noteCount = await Note.countDocuments({ user: req.user._id });
    if (noteCount >= MAX_NOTES_PER_USER) {
      return res.status(400).json({
        error: true,
        message: `Note limit reached: You have reached the maximum limit of ${MAX_NOTES_PER_USER} notes per account. Please delete some existing notes to upload or generate new ones.`,
      });
    }

    const { title, content } = req.body;

    if (!content || content.trim().length < 10) {
      return res.status(400).json({ message: 'Please provide at least 10 characters of study notes to summarize.' });
    }

    const noteTitle = title?.trim() || 'Untitled Note - ' + new Date().toLocaleDateString();

    // Generate summary - if AI fails, save note first with empty summary
    let summary = '';
    let summaryFailed = false;
    try {
      summary = await generateAiSummary(content);
    } catch (aiErr) {
      console.error('[NoteController.pasteNotes] AI Error:', aiErr.message);
      summary = '';
      summaryFailed = true;
    }

    const wasTruncated = content.length > MAX_NOTE_CHARACTERS;
    const truncationNotice = wasTruncated
      ? `Note text exceeded ${MAX_NOTE_CHARACTERS.toLocaleString()} characters. Only the first ${MAX_NOTE_CHARACTERS.toLocaleString()} characters were used for summary generation.`
      : null;

    const note = await Note.create({
      user: req.user._id,
      title: noteTitle,
      sourceType: 'paste',
      rawContent: content.trim(),
      summary,
    });

    return res.status(201).json({
      message: summaryFailed
        ? 'Note saved, but summary generation failed. You can retry summarizing.'
        : 'Note saved and summarized successfully',
      note,
      summaryFailed,
      retry: summaryFailed,
      truncated: wasTruncated,
      truncationNotice,
    });
  } catch (err) {
    console.error('[NoteController.pasteNotes] Error:', err);
    const message = process.env.NODE_ENV === 'production' ? 'An unexpected internal error occurred.' : (err.message || 'Failed to save note.');
    return res.status(500).json({ message });
  }
};

// @desc    Get all saved notes for the user
// @route   GET /api/notes
// @access  Private
exports.getNotes = async (req, res) => {
  try {
    const notes = await Note.find({ user: req.user._id })
      .select('-rawContent')
      .sort({ createdAt: -1 });

    return res.status(200).json({ notes });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to retrieve notes.' });
  }
};

// @desc    Get single note with full rawContent
// @route   GET /api/notes/:id
// @access  Private
exports.getNoteById = async (req, res) => {
  try {
    const note = await Note.findOne({ _id: req.params.id, user: req.user._id });
    if (!note) {
      return res.status(404).json({ message: 'Note not found.' });
    }
    return res.status(200).json({ note });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to retrieve note.' });
  }
};

// @desc    Regenerate summary for an existing note
// @route   POST /api/notes/:id/summarize
// @access  Private
exports.regenerateSummary = async (req, res) => {
  const client = getGeminiClient();
  if (!client) {
    return res.status(503).json({
      error: true,
      message: 'AI Summary service is unavailable: GEMINI_API_KEY is not configured in server/.env. Please configure a valid Gemini API key.',
    });
  }

  try {
    const note = await Note.findOne({ _id: req.params.id, user: req.user._id });
    if (!note) {
      return res.status(404).json({ message: 'Note not found.' });
    }

    const summary = await generateAiSummary(note.rawContent);
    note.summary = summary;
    await note.save();

    return res.status(200).json({
      message: 'Summary regenerated successfully',
      summary: note.summary,
    });
  } catch (err) {
    const status = err.statusCode || 503;
    return res.status(status).json({
      error: true,
      message: err.message || 'Failed to regenerate summary. AI service is unavailable.',
    });
  }
};

// @desc    Delete note
// @route   DELETE /api/notes/:id
// @access  Private
exports.deleteNote = async (req, res) => {
  try {
    const note = await Note.findOneAndDelete({ _id: req.params.id, user: req.user._id });
    if (!note) {
      return res.status(404).json({ message: 'Note not found.' });
    }
    return res.status(200).json({ message: 'Note deleted successfully.' });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to delete note.' });
  }
};

// @desc    Perform deep topic breakdown & generate notes + AI-predicted likely exam questions directly from a topic name (e.g. "Java", "DBMS")
// @route   POST /api/notes/from-topic
// @route   POST /api/notes/from-topic
// @access  Private
exports.createFromTopic = async (req, res) => {
  try {
    const noteCount = await Note.countDocuments({ user: req.user._id });
    if (noteCount >= MAX_NOTES_PER_USER) {
      return res.status(400).json({
        error: true,
        message: `Note limit reached: You have reached the maximum limit of ${MAX_NOTES_PER_USER} notes per account. Please delete some existing notes to upload or generate new ones.`,
      });
    }

    const { topic, subjectArea } = req.body;

    if (!topic || topic.trim().length < 2) {
      return res.status(400).json({ message: 'Please provide a valid topic or subject name (e.g. "Java", "DBMS").' });
    }

    const cleanTopic = topic.trim();
    let analysis = null;
    let summaryFailed = false;
    let rawContent = '';
    let summary = '';
    let topicModules = [];
    let examQuestions = null;

    try {
      const client = getGeminiClient();
      if (!client) {
        throw new Error('AI Service is unavailable: GEMINI_API_KEY is not configured.');
      }

      const basePrompt = `You are a distinguished university professor, chief syllabus curator, and academic author performing deep topic analysis like Google Gemini.
USER SEARCH QUERY / SUBJECT: "${cleanTopic}"
Context: ${subjectArea || 'Standard University Engineering / Computer Science Syllabus (Anna University, VTU, Mumbai University, Pune, JNTU, GATE, UGC)'}

TASK:
1. Deeply analyze the subject "${cleanTopic}" according to standard university engineering curricula.
2. Identify the most critical, fundamental IMPORTANT SUB-TOPICS / MODULES that examiners test.
   (For example, if the topic is "Java", identify: Operators & Data Types, Control Statements, Object-Oriented Programming (Classes & Objects), Inheritance, Polymorphism & Abstraction, Exception Handling, Collections Framework & Multithreading).
   (For "DBMS": Relational Model & SQL, ER Modeling & Normalization, Transaction Processing & ACID, Concurrency Control & Locking, Indexing & B-Trees, Storage & Recovery).
   (For "Operating Systems": Process Management & Threads, CPU Scheduling, Deadlocks & Synchronization, Memory Management & Paging, Virtual Memory, File Systems).
3. For EACH identified important sub-topic, provide:
   - "id": Unique string identifier (e.g. "module-1")
   - "title": Clear topic name (e.g. "Operators & Expressions", "Control Statements", "Inheritance in Java", "Polymorphism")
   - "importance": Relative syllabus importance and weightage (e.g. "Core Module - High Syllabus Weightage")
   - "keyConcepts": 3-5 crucial keywords/subtopics
   - "notes": Deep, academic-standard study lecture notes in Markdown with precise definitions, syntax explanations, rules, comparison tables where appropriate, and complete working code snippets.
   - "twoMarks": 2-mark conceptual or definition questions with exact model answers
   - "eightMarks": 8-mark analytical/comparative questions with structured model answers and code
4. Provide comprehensive 16-mark essay questions for the overall subject with full model answer outlines.

STRICT JSON SCHEMA:
{
  "topic": "${cleanTopic}",
  "overview": "Comprehensive academic overview of the subject",
  "modules": [
    {
      "id": "module-1",
      "title": "Topic name (e.g. Operators & Expressions)",
      "importance": "Core Module - High Syllabus Weightage",
      "keyConcepts": ["Arithmetic & Relational Operators", "Bitwise vs Logical", "Ternary Operator", "Precedence"],
      "notes": "Comprehensive markdown lecture notes with definitions, syntax, and working code examples...",
      "twoMarks": [
        {
          "question": "What is the difference between >> and >>> operators in Java?",
          "answer": ">> is the signed right shift operator... whereas >>> is the unsigned right shift operator...",
          "frequency": "AI-predicted likely question"
        }
      ],
      "eightMarks": [
        {
          "question": "Explain operator precedence and associativity in Java with illustrative code examples.",
          "answer": "Structured model answer with explanation and code...",
          "frequency": "Core syllabus topic"
        }
      ]
    }
  ],
  "sixteenMarks": [
    {
      "question": "Discuss in detail the principles of Object-Oriented Programming in Java (Inheritance, Polymorphism, Encapsulation, Abstraction) with comprehensive architecture and working code implementation.",
      "answer": "In-depth model answer covering all 4 pillars with architecture and code...",
      "frequency": "Comprehensive essay question"
    }
  ]
}

Provide at least 5-7 core modules. For programming languages like Java, be sure to include Operators, Control Statements, Inheritance, and Polymorphism. Output ONLY the JSON object.`;

      const generatorFn = async (correctiveFeedback) => {
        const prompt = correctiveFeedback ? `${basePrompt}\n\n${correctiveFeedback}` : basePrompt;
        return await generateWithModelFallback(prompt, {
          generationConfig: {
            responseMimeType: 'application/json',
          },
        });
      };

      analysis = await executeWithRetry(generatorFn, validateTopicAnalysisSchema);

      // Compile comprehensive rawContent from modules
      rawContent = `# ${analysis.topic || cleanTopic}: Comprehensive Study & Revision Guide

## Subject Overview
${analysis.overview}

---

${analysis.modules
  .map(
    (m, idx) =>
      `## Module ${idx + 1}: ${m.title}
**Weightage / Exam Frequency:** ${m.importance}
**Key Concepts:** ${m.keyConcepts.join(', ')}

${m.notes}`
  )
  .join('\n\n---\n\n')}`;

      // Compile exam questions
      const compiledTwoMarks = [];
      const compiledEightMarks = [];
      const compiledImportantTopics = [];

      analysis.modules.forEach((m) => {
        compiledImportantTopics.push({
          topic: m.title,
          probability: m.importance,
          description: m.keyConcepts.join(', '),
          sampleQuestion: m.twoMarks?.[0]?.question || '',
          sampleAnswer: m.twoMarks?.[0]?.answer || '',
        });

        if (Array.isArray(m.twoMarks)) {
          m.twoMarks.forEach((q) => {
            compiledTwoMarks.push({
              question: q.question,
              answer: q.answer,
              marks: 2,
              frequency: q.frequency || 'AI-predicted likely question',
              keyTopics: m.keyConcepts || [],
            });
          });
        }

        if (Array.isArray(m.eightMarks)) {
          m.eightMarks.forEach((q) => {
            compiledEightMarks.push({
              question: q.question,
              answer: q.answer,
              marks: 8,
              frequency: q.frequency || 'Core syllabus topic',
              keyTopics: m.keyConcepts || [],
            });
          });
        }
      });

      const compiledSixteenMarks = (analysis.sixteenMarks || []).map((q) => ({
        question: q.question,
        answer: q.answer,
        marks: 16,
        frequency: q.frequency || 'Comprehensive essay question',
        keyTopics: [cleanTopic],
      }));

      examQuestions = {
        generatedAt: new Date(),
        analysisSummary: analysis.overview,
        importantTopics: compiledImportantTopics,
        twoMarks: compiledTwoMarks,
        eightMarks: compiledEightMarks,
        sixteenMarks: compiledSixteenMarks,
      };

      topicModules = analysis.modules;

      // Executive summary for quick review
      summary = `### 📌 Core Overview: ${cleanTopic}
${analysis.overview}

### 🔑 Important Syllabus Topics Identified:
${analysis.modules.map((m) => `- **${m.title}** (${m.importance}): ${m.keyConcepts.join(', ')}`).join('\n')}

### 💡 High-Yield Exam Takeaways:
- **Part A (2 Marks):** ${compiledTwoMarks.length} AI-predicted definition & conceptual questions.
- **Part B (8 Marks):** ${compiledEightMarks.length} analytical and architectural questions with code.
- **Part C (16 Marks):** ${compiledSixteenMarks.length} comprehensive essay blueprint questions.`;
    } catch (aiErr) {
      console.error('[NoteController.createFromTopic] AI Error:', aiErr.message);
      summaryFailed = true;
      rawContent = cleanTopic;
      summary = '';
      topicModules = [];
      examQuestions = null;
    }

    const note = await Note.create({
      user: req.user._id,
      title: `${cleanTopic} - Comprehensive Study Guide`,
      sourceType: 'topic',
      rawContent,
      summary,
      topicModules,
      examQuestions,
    });

    return res.status(201).json({
      message: summaryFailed
        ? 'Note created from topic, but summary generation failed. You can retry summarizing.'
        : `Gemini Deep Topic Analysis generated successfully for "${cleanTopic}" with ${analysis.modules.length} important topics and complete exam question bank.`,
      note,
      analysis,
      summaryFailed,
      retry: summaryFailed,
    });
  } catch (err) {
    console.error('[NoteController.createFromTopic] Error:', err);
    const message = process.env.NODE_ENV === 'production' ? 'An unexpected internal error occurred.' : (err.message || 'Failed to generate study guide from topic.');
    return res.status(500).json({ message });
  }
};

// @desc    Perform deep topic breakdown on an existing note
// @route   POST /api/notes/:id/analyze-topics
// @access  Private
exports.analyzeNoteTopics = async (req, res) => {
  const client = getGeminiClient();
  if (!client) {
    return res.status(503).json({
      error: true,
      message: 'AI Service is unavailable: GEMINI_API_KEY is not configured in server/.env.',
    });
  }

  try {
    const note = await Note.findOne({ _id: req.params.id, user: req.user._id });
    if (!note) {
      return res.status(404).json({ message: 'Note not found.' });
    }

    const cleanTopic = note.title.replace(/ - Comprehensive Study Guide.*$/, '');
    const content = note.rawContent.slice(0, MAX_NOTE_CHARACTERS);

    const basePrompt = `You are a distinguished university professor and academic author performing deep topic analysis like Google Gemini.
Analyze the following study material on "${cleanTopic}" and break it down into core fundamental IMPORTANT TOPICS / MODULES.
For each topic, provide key concepts, detailed lecture notes, 2-mark questions + model answers, and 8-mark questions + model answers.
Also provide 16-mark comprehensive essay questions.

STRICT JSON SCHEMA:
{
  "topic": "${cleanTopic}",
  "overview": "Comprehensive academic overview",
  "modules": [
    {
      "id": "module-1",
      "title": "Topic name",
      "importance": "High Weightage",
      "keyConcepts": ["Concept 1", "Concept 2"],
      "notes": "Comprehensive markdown lecture notes with code and definitions...",
      "twoMarks": [{"question": "...", "answer": "...", "frequency": "..."}],
      "eightMarks": [{"question": "...", "answer": "...", "frequency": "..."}]
    }
  ],
  "sixteenMarks": [
    {"question": "...", "answer": "...", "frequency": "..."}
  ]
}

Study Material:
"""
${content}
"""`;

    const generatorFn = async (correctiveFeedback) => {
      const prompt = correctiveFeedback ? `${basePrompt}\n\n${correctiveFeedback}` : basePrompt;
      return await generateWithModelFallback(prompt, {
        generationConfig: {
          responseMimeType: 'application/json',
        },
      });
    };

    const analysis = await executeWithRetry(generatorFn, validateTopicAnalysisSchema);

    // Save to note
    note.topicModules = analysis.modules;

    // Compile exam questions if not present
    if (!note.examQuestions || !note.examQuestions.twoMarks?.length) {
      const compiledTwoMarks = [];
      const compiledEightMarks = [];
      const compiledImportantTopics = [];

      analysis.modules.forEach((m) => {
        compiledImportantTopics.push({
          topic: m.title,
          probability: m.importance,
          description: m.keyConcepts.join(', '),
          sampleQuestion: m.twoMarks?.[0]?.question || '',
          sampleAnswer: m.twoMarks?.[0]?.answer || '',
        });

        if (Array.isArray(m.twoMarks)) {
          m.twoMarks.forEach((q) => {
            compiledTwoMarks.push({
              question: q.question,
              answer: q.answer,
              marks: 2,
              frequency: q.frequency || 'AI-predicted likely question',
              keyTopics: m.keyConcepts || [],
            });
          });
        }

        if (Array.isArray(m.eightMarks)) {
          m.eightMarks.forEach((q) => {
            compiledEightMarks.push({
              question: q.question,
              answer: q.answer,
              marks: 8,
              frequency: q.frequency || 'Core syllabus topic',
              keyTopics: m.keyConcepts || [],
            });
          });
        }
      });

      const compiledSixteenMarks = (analysis.sixteenMarks || []).map((q) => ({
        question: q.question,
        answer: q.answer,
        marks: 16,
        frequency: q.frequency || 'Comprehensive essay question',
        keyTopics: [cleanTopic],
      }));

      note.examQuestions = {
        generatedAt: new Date(),
        analysisSummary: analysis.overview,
        importantTopics: compiledImportantTopics,
        twoMarks: compiledTwoMarks,
        eightMarks: compiledEightMarks,
        sixteenMarks: compiledSixteenMarks,
      };
    }

    await note.save();

    return res.status(200).json({
      message: `Deep topic analysis completed for "${note.title}"`,
      note,
      analysis,
    });
  } catch (err) {
    console.error('[NoteController.analyzeNoteTopics] Error:', err);
    return res.status(500).json({ message: err.message || 'Failed to analyze note topics.' });
  }
};

// @desc    Direct deep topic analysis without requiring existing note (for instant search)
// @route   POST /api/notes/analyze-topic-direct
// @access  Private
exports.analyzeTopicDirect = async (req, res) => {
  const client = getGeminiClient();
  if (!client) {
    return res.status(503).json({
      error: true,
      message: 'AI Service is unavailable: GEMINI_API_KEY is not configured in server/.env.',
    });
  }

  try {
    const { topic } = req.body;
    if (!topic || topic.trim().length < 2) {
      return res.status(400).json({ message: 'Please provide a valid topic name (e.g. "Java").' });
    }
    const cleanTopic = topic.trim();

    req.body.topic = cleanTopic;
    return exports.createFromTopic(req, res);
  } catch (err) {
    console.error('[NoteController.analyzeTopicDirect] Error:', err);
    return res.status(500).json({ message: err.message || 'Failed to analyze topic.' });
  }
};

