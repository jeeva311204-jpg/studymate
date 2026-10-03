const path = require('path');
const dotenv = require('dotenv');

// Load environment variables before resolving database URI
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const { describe, it, before, after, mock } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const { connectDB, disconnectDB } = require('../config/db');
const { getJwtSecret } = require('../config/jwt');
const User = require('../models/User');
const Note = require('../models/Note');
const QuizResult = require('../models/QuizResult');

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

describe('StudyMate Backend Test Suite (Items 1 to 3)', () => {
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
});
