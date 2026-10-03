const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const { connectDB, disconnectDB } = require('../config/db');
const { getJwtSecret } = require('../config/jwt');
const User = require('../models/User');

process.env.PORT = '5001';
const app = require('../index');

describe('Item 2: validateObjectId middleware for :id and :noteId', () => {
  let server;
  let authToken;

  before(async () => {
    await connectDB();
    server = app.listen(5001);

    // Create a temporary user to authenticate routes
    const user = await User.create({
      name: 'Test Auth User',
      email: `test_obj_id_${Date.now()}@example.com`,
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

  it('rejects invalid :id on GET /api/notes/:id with 400 "Invalid id"', async () => {
    const res = await request(server)
      .get('/api/notes/not-a-valid-id')
      .set('Authorization', authToken);
    assert.equal(res.status, 400);
    assert.equal(res.body.message, 'Invalid id');
  });

  it('rejects invalid :id on POST /api/notes/:id/summarize with 400 "Invalid id"', async () => {
    const res = await request(server)
      .post('/api/notes/not-a-valid-id/summarize')
      .set('Authorization', authToken);
    assert.equal(res.status, 400);
    assert.equal(res.body.message, 'Invalid id');
  });

  it('rejects invalid :noteId on GET /api/flashcards/note/:noteId with 400 "Invalid id"', async () => {
    const res = await request(server)
      .get('/api/flashcards/note/bad-note-id')
      .set('Authorization', authToken);
    assert.equal(res.status, 400);
    assert.equal(res.body.message, 'Invalid id');
  });

  it('rejects invalid :noteId on GET /api/questions/note/:noteId with 400 "Invalid id"', async () => {
    const res = await request(server)
      .get('/api/questions/note/bad-note-id')
      .set('Authorization', authToken);
    assert.equal(res.status, 400);
    assert.equal(res.body.message, 'Invalid id');
  });

  it('rejects invalid :id on GET /api/planner/:id with 400 "Invalid id"', async () => {
    const res = await request(server)
      .get('/api/planner/bad-plan-id')
      .set('Authorization', authToken);
    assert.equal(res.status, 400);
    assert.equal(res.body.message, 'Invalid id');
  });

  it('rejects invalid :id on PATCH /api/planner/:id/toggle-task with 400 "Invalid id"', async () => {
    const res = await request(server)
      .patch('/api/planner/bad-plan-id/toggle-task')
      .set('Authorization', authToken)
      .send({ dayIndex: 0, taskIndex: 0 });
    assert.equal(res.status, 400);
    assert.equal(res.body.message, 'Invalid id');
  });

  it('rejects invalid :id on GET /api/quiz/result/:id with 400 "Invalid id"', async () => {
    const res = await request(server)
      .get('/api/quiz/result/bad-quiz-result-id')
      .set('Authorization', authToken);
    assert.equal(res.status, 400);
    assert.equal(res.body.message, 'Invalid id');
  });
});
