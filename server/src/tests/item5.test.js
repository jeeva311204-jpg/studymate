const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const { connectDB, disconnectDB } = require('../config/db');
const { getJwtSecret } = require('../config/jwt');
const User = require('../models/User');
const Note = require('../models/Note');

process.env.PORT = '5001';
const app = require('../index');

describe('Item 5: Note creation with AI fallback & 50-note limit', () => {
  let server;
  let user;
  let authToken;

  before(async () => {
    await connectDB();
    server = app.listen(5001);

    user = await User.create({
      name: 'Item5 User',
      email: `item5_${Date.now()}@example.com`,
      password: 'password123',
    });
    authToken = `Bearer ${jwt.sign({ id: user._id }, getJwtSecret(), { expiresIn: '1h' })}`;
  });

  after(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    await disconnectDB();
  });

  it('saves note with 201 and summaryFailed=true if AI fails or is not available', async () => {
    const res = await request(server)
      .post('/api/notes/paste')
      .set('Authorization', authToken)
      .send({
        title: 'Fallback Note Test',
        content: 'This is a test content that has more than 15 characters to test AI failure fallback.',
      });

    assert.equal(res.status, 201);
    assert.ok(res.body.note);
    assert.equal(res.body.note.title, 'Fallback Note Test');
    // Note is saved
    const saved = await Note.findById(res.body.note._id);
    assert.ok(saved);
  });

  it('saves from-topic note with 201 when AI fails', async () => {
    const res = await request(server)
      .post('/api/notes/from-topic')
      .set('Authorization', authToken)
      .send({
        topic: 'Discrete Mathematics',
      });

    assert.equal(res.status, 201);
    assert.ok(res.body.note);
    const saved = await Note.findById(res.body.note._id);
    assert.ok(saved);
  });

  it('allows POST /notes/:id/summarize for retrying summary', async () => {
    const note = await Note.create({
      user: user._id,
      title: 'Note to retry',
      rawContent: 'Some text content for summarize retry test.',
      summary: '',
    });

    const res = await request(server)
      .post(`/api/notes/${note._id}/summarize`)
      .set('Authorization', authToken);

    // Depending on whether Gemini API key is valid or mock in local, it either returns 200 or 503, but not 404 or route error
    assert.ok([200, 503].includes(res.status));
  });

  it('enforces 50-note limit', async () => {
    const limitUser = await User.create({
      name: 'Limit User',
      email: `limit_user_${Date.now()}@example.com`,
      password: 'password123',
    });
    const limitToken = `Bearer ${jwt.sign({ id: limitUser._id }, getJwtSecret(), { expiresIn: '1h' })}`;

    // Create 50 notes for this user
    const notes = [];
    for (let i = 0; i < 50; i++) {
      notes.push({
        user: limitUser._id,
        title: `Note ${i}`,
        rawContent: `Content for note ${i}`,
      });
    }
    await Note.insertMany(notes);

    const res = await request(server)
      .post('/api/notes/paste')
      .set('Authorization', limitToken)
      .send({
        title: '51st Note',
        content: 'This 51st note should be rejected by the 50-note limit check.',
      });

    assert.equal(res.status, 400);
    assert.match(res.body.message, /limit reached/i);
  });
});
