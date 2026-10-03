const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const { connectDB, disconnectDB } = require('../config/db');

process.env.PORT = '5001';
const app = require('../index');

describe('Item 1: authController validation', () => {
  let server;

  before(async () => {
    await connectDB();
    server = app.listen(5001);
  });

  after(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    await disconnectDB();
  });

  it('rejects non-string name with 400', async () => {
    const res = await request(server)
      .post('/api/auth/register')
      .send({ name: 12345, email: 'test@example.com', password: 'password123' });
    assert.equal(res.status, 400);
    assert.match(res.body.message, /strings/i);
  });

  it('rejects non-string email with 400', async () => {
    const res = await request(server)
      .post('/api/auth/register')
      .send({ name: 'John Doe', email: { value: 'test@example.com' }, password: 'password123' });
    assert.equal(res.status, 400);
    assert.match(res.body.message, /strings/i);
  });

  it('rejects non-string password with 400', async () => {
    const res = await request(server)
      .post('/api/auth/register')
      .send({ name: 'John Doe', email: 'test@example.com', password: ['pass'] });
    assert.equal(res.status, 400);
    assert.match(res.body.message, /strings/i);
  });

  it('rejects invalid email regex with 400 (not 500)', async () => {
    const res = await request(server)
      .post('/api/auth/register')
      .send({ name: 'John Doe', email: 'not-an-email', password: 'password123' });
    assert.equal(res.status, 400);
    assert.match(res.body.message, /valid email/i);
  });

  it('rejects password shorter than 8 characters with 400', async () => {
    const res = await request(server)
      .post('/api/auth/register')
      .send({ name: 'John Doe', email: 'valid@example.com', password: 'short' });
    assert.equal(res.status, 400);
    assert.match(res.body.message, /8 and 72/i);
  });

  it('rejects password longer than 72 characters with 400', async () => {
    const longPassword = 'a'.repeat(73);
    const res = await request(server)
      .post('/api/auth/register')
      .send({ name: 'John Doe', email: 'valid2@example.com', password: longPassword });
    assert.equal(res.status, 400);
    assert.match(res.body.message, /8 and 72/i);
  });

  it('registers successfully with valid inputs', async () => {
    const uniqueEmail = `valid_${Date.now()}@example.com`;
    const res = await request(server)
      .post('/api/auth/register')
      .send({ name: 'Valid User', email: uniqueEmail, password: 'validPassword123' });
    assert.equal(res.status, 201);
    assert.equal(res.body.user.email, uniqueEmail);
    assert.ok(res.body.token);
  });
});
