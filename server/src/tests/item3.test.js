const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const { connectDB, disconnectDB } = require('../config/db');
const { getJwtSecret } = require('../config/jwt');
const User = require('../models/User');
const Note = require('../models/Note');

process.env.PORT = '5001';
const app = require('../index');

describe('Item 3: quizController.saveQuizResult', () => {
  let server;
  let user1;
  let user2;
  let auth1;
  let auth2;
  let user1Note;
  let user2Note;

  before(async () => {
    await connectDB();
    server = app.listen(5001);

    user1 = await User.create({
      name: 'Quiz User 1',
      email: `quiz_u1_${Date.now()}@example.com`,
      password: 'password123',
    });
    auth1 = `Bearer ${jwt.sign({ id: user1._id }, getJwtSecret(), { expiresIn: '1h' })}`;

    user2 = await User.create({
      name: 'Quiz User 2',
      email: `quiz_u2_${Date.now()}@example.com`,
      password: 'password123',
    });
    auth2 = `Bearer ${jwt.sign({ id: user2._id }, getJwtSecret(), { expiresIn: '1h' })}`;

    user1Note = await Note.create({
      user: user1._id,
      title: 'User 1 Note',
      rawContent: 'Sample content 1',
    });

    user2Note = await Note.create({
      user: user2._id,
      title: 'User 2 Note',
      rawContent: 'Sample content 2',
    });
  });

  after(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    await disconnectDB();
  });

  it('rejects questions if empty with 400', async () => {
    const res = await request(server)
      .post('/api/quiz/save-result')
      .set('Authorization', auth1)
      .send({ questions: [] });
    assert.equal(res.status, 400);
    assert.match(res.body.message, /1 to 50/i);
  });

  it('rejects questions if greater than 50 with 400', async () => {
    const manyQuestions = Array(51).fill({
      question: 'Q',
      options: ['A', 'B', 'C', 'D'],
      correctAnswer: 'A',
      userAnswer: 'A',
      isCorrect: true,
    });
    const res = await request(server)
      .post('/api/quiz/save-result')
      .set('Authorization', auth1)
      .send({ questions: manyQuestions });
    assert.equal(res.status, 400);
    assert.match(res.body.message, /1 to 50/i);
  });

  it('computes score from isCorrect and ignores client-sent score', async () => {
    const questions = [
      { question: 'Q1', options: ['A', 'B'], correctAnswer: 'A', userAnswer: 'A', isCorrect: true },
      { question: 'Q2', options: ['A', 'B'], correctAnswer: 'A', userAnswer: 'B', isCorrect: false },
      { question: 'Q3', options: ['A', 'B'], correctAnswer: 'A', userAnswer: 'A', isCorrect: true },
    ];
    const res = await request(server)
      .post('/api/quiz/save-result')
      .set('Authorization', auth1)
      .send({
        score: 999, // Should be ignored!
        totalQuestions: 1, // Should be recomputed as 3!
        questions,
      });

    assert.equal(res.status, 201);
    assert.equal(res.body.score, 2);
    assert.equal(res.body.totalQuestions, 3);
    assert.equal(res.body.percentage, 67); // Math.round(2/3 * 100) = 67
  });

  it('rejects noteId that belongs to another user with 404', async () => {
    const questions = [
      { question: 'Q1', options: ['A', 'B'], correctAnswer: 'A', userAnswer: 'A', isCorrect: true },
    ];
    const res = await request(server)
      .post('/api/quiz/save-result')
      .set('Authorization', auth1)
      .send({
        noteId: user2Note._id,
        questions,
      });
    assert.equal(res.status, 404);
    assert.match(res.body.message, /belong/i);
  });

  it('saves result successfully when noteId belongs to the user', async () => {
    const questions = [
      { question: 'Q1', options: ['A', 'B'], correctAnswer: 'A', userAnswer: 'A', isCorrect: true },
    ];
    const res = await request(server)
      .post('/api/quiz/save-result')
      .set('Authorization', auth1)
      .send({
        noteId: user1Note._id,
        questions,
      });
    assert.equal(res.status, 201);
    assert.equal(res.body.score, 1);
    assert.equal(res.body.totalQuestions, 1);
    assert.equal(res.body.percentage, 100);
  });
});
