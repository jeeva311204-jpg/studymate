const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const dns = require('dns');

describe('Item 7: db.js dns.setServers in production', () => {
  it('does not invoke dns.setServers when NODE_ENV === "production"', () => {
    let called = false;
    const originalSetServers = dns.setServers;
    dns.setServers = () => {
      called = true;
    };

    const origEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    // Clear module cache for db.js
    delete require.cache[require.resolve('../config/db')];

    try {
      require('../config/db');
      assert.equal(called, false, 'dns.setServers should NOT be called in production');
    } finally {
      process.env.NODE_ENV = origEnv;
      dns.setServers = originalSetServers;
      delete require.cache[require.resolve('../config/db')];
    }
  });

  it('invokes dns.setServers when NODE_ENV !== "production"', () => {
    let called = false;
    const originalSetServers = dns.setServers;
    dns.setServers = () => {
      called = true;
    };

    const origEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';

    delete require.cache[require.resolve('../config/db')];

    try {
      require('../config/db');
      assert.equal(called, true, 'dns.setServers SHOULD be called in development');
    } finally {
      process.env.NODE_ENV = origEnv;
      dns.setServers = originalSetServers;
      delete require.cache[require.resolve('../config/db')];
    }
  });
});
