const Note = require('../models/Note');
const { getGenerativeModel, getGeminiClient, generateWithModelFallback } = require('../config/gemini');
const { executeWithRetry } = require('../utils/aiValidator');
const { MAX_NOTE_CHARACTERS } = require('../config/constants');

// Helper to validate the 15-flashcard schema
const validateFlashcardSchema = (parsed) => {
  if (!Array.isArray(parsed)) {
    return { valid: false, error: 'Expected a JSON array of flashcards.' };
  }
  if (parsed.length < 15) {
    return { valid: false, error: `Expected 15 flashcards, but received ${parsed.length}.` };
  }

  for (let i = 0; i < 15; i++) {
    const card = parsed[i];
    if (!card.front || typeof card.front !== 'string' || card.front.trim().length < 2) {
      return { valid: false, error: `Card ${i + 1} is missing a valid 'front' text.` };
    }
    if (!card.back || typeof card.back !== 'string' || card.back.trim().length < 2) {
      return { valid: false, error: `Card ${i + 1} is missing a valid 'back' text.` };
    }
  }

  return { valid: true, data: parsed.slice(0, 15) };
};

// @desc    Generate exactly 15 flashcards from a note or raw text
// @route   POST /api/flashcards/generate
// @access  Private
exports.generateFlashcards = async (req, res) => {
  const client = getGeminiClient();

  // If Gemini key is not configured, do not return fake cards; return 503 immediately
  if (!client) {
    return res.status(503).json({
      error: true,
      message: 'AI Flashcards generator is unavailable: GEMINI_API_KEY is not configured in server/.env. Please configure a valid API key.',
    });
  }

  try {
    const { noteId, content: rawInput, noteTitle } = req.body;

    let textToAnalyze = rawInput || '';
    let title = noteTitle || 'Study Deck';
    let targetNote = null;

    if (noteId) {
      targetNote = await Note.findOne({ _id: noteId, user: req.user._id });
      if (!targetNote) {
        return res.status(404).json({ message: 'Note not found.' });
      }
      textToAnalyze = targetNote.rawContent;
      title = targetNote.title;
    }

    if (!textToAnalyze || textToAnalyze.trim().length < 20) {
      return res.status(400).json({ message: 'Insufficient study content to generate flashcards.' });
    }

    const wasTruncated = textToAnalyze.length > MAX_NOTE_CHARACTERS;
    const truncationNotice = wasTruncated
      ? `Note text exceeded ${MAX_NOTE_CHARACTERS.toLocaleString()} characters. Only the first ${MAX_NOTE_CHARACTERS.toLocaleString()} characters were used for flashcard generation.`
      : null;

    const model = getGenerativeModel({
      generationConfig: {
        responseMimeType: 'application/json',
      },
    });

    const basePrompt = `You are an expert learning specialist.
Analyze the following study material and generate EXACTLY 15 high-yield flashcards for student memorization and active recall.

STRICT JSON SCHEMA:
Return a JSON array containing exactly 15 objects with this structure:
[
  {
    "id": 1,
    "front": "Concise term, high-level question, or core principle to recall",
    "back": "Clear, accurate definition, essential explanation, or key takeaways",
    "category": "Topic category or sub-concept"
  }
]

RULES:
1. Generate EXACTLY 15 cards.
2. Front must be concise and engaging (1-2 lines).
3. Back must be accurate and comprehensive (2-4 lines).
4. Output ONLY the JSON array, no extra commentary.

Study Material:
"""
${textToAnalyze.slice(0, MAX_NOTE_CHARACTERS)}
"""`;

    const generatorFn = async (correctiveFeedback) => {
      const prompt = correctiveFeedback ? `${basePrompt}\n\n${correctiveFeedback}` : basePrompt;
      return await generateWithModelFallback(prompt, {
        generationConfig: {
          responseMimeType: 'application/json',
        },
      });
    };

    const cards = await executeWithRetry(generatorFn, validateFlashcardSchema);

    // Save flashcards to the note if noteId was provided
    if (targetNote) {
      targetNote.flashcards = cards.map((c) => ({
        front: c.front,
        back: c.back,
        mastered: false,
      }));
      await targetNote.save();
    }

    return res.status(200).json({
      deckTitle: title,
      noteId: noteId || null,
      totalCards: 15,
      flashcards: cards,
      truncated: wasTruncated,
      truncationNotice,
    });
  } catch (err) {
    console.error('[FlashcardController.generateFlashcards] Error:', err);
    return res.status(503).json({
      error: true,
      message: err.message || 'Failed to generate flashcards. Gemini AI service is unavailable.',
    });
  }
};

// @desc    Get saved flashcards for a note
// @route   GET /api/flashcards/note/:noteId
// @access  Private
exports.getDeckByNoteId = async (req, res) => {
  try {
    const note = await Note.findOne({ _id: req.params.noteId, user: req.user._id });
    if (!note) {
      return res.status(404).json({ message: 'Note not found.' });
    }
    return res.status(200).json({
      deckTitle: note.title,
      noteId: note._id,
      flashcards: note.flashcards || [],
    });
  } catch (err) {
    console.error('[FlashcardController.getDeckByNoteId] Error:', err);
    return res.status(500).json({ message: 'Failed to retrieve flashcard deck.' });
  }
};
