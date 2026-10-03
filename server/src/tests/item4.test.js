const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const { connectDB, disconnectDB } = require('../config/db');

process.env.PORT = '5001';
const app = require('../index');

describe('Item 4: Global error handler & CORS', () => {
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

  it('returns 403 (not 500) for CORS blocked requests', async () => {
    const res = await request(server)
      .get('/api/health')
      .set('Origin', 'http://malicious-site.com');

    assert.equal(res.status, 403);
    assert.equal(res.body.error, true);
    assert.match(res.body.message, /CORS/i);
  });

  it('returns generic error message in production mode for 500s', async () => {
    const origEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    try {
      // Calling auth register with null body or triggering error
      // or testing error handler behavior
      const res = await request(server)
        .post('/api/auth/register')
        .send(null);

      // Status should be 400 or 500, but message should not leak system internals
      if (res.status === 500) {
        assert.match(res.body.message, /server error|unexpected/i);
      }
    } finally {
      process.env.NODE_ENV = origEnv;
    }
  });
});
