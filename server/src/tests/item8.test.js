const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const { connectDB, disconnectDB } = require('../config/db');

process.env.PORT = '5001';
const app = require('../index');

describe('Item 8: /api/health db status', () => {
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

  it('returns db: true when mongoose connection is ready', async () => {
    const res = await request(server).get('/api/health');
    assert.equal(res.status, 200);
    assert.equal(res.body.status, 'ok');
    assert.equal(res.body.db, true);
  });
});
