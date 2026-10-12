import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import api, { validateApiUrl } from './api.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Client API URL Validation & Interceptor', () => {
  it('validateApiUrl throws error when URL directly contains "/api/api"', () => {
    assert.throws(
      () => validateApiUrl('/api/api/ask'),
      (err) => {
        assert.ok(err instanceof Error);
        assert.match(err.message, /\/api\/api/);
        return true;
      }
    );

    assert.throws(
      () => validateApiUrl('https://example.com/api/api/test'),
      (err) => {
        assert.match(err.message, /\/api\/api/);
        return true;
      }
    );
  });

  it('validateApiUrl throws error when baseURL ends with "/api" and URL starts with "/api/"', () => {
    assert.throws(
      () => validateApiUrl('/api/ask', '/api'),
      (err) => {
        assert.match(err.message, /\/api\/api/);
        return true;
      }
    );

    assert.throws(
      () => validateApiUrl('/api/ask', 'http://localhost:5000/api'),
      (err) => {
        assert.match(err.message, /\/api\/api/);
        return true;
      }
    );
  });

  it('validateApiUrl succeeds for clean base-relative paths', () => {
    assert.equal(validateApiUrl('/ask', '/api'), '/ask');
    assert.equal(validateApiUrl('/ask/conversations', 'http://localhost:5000/api'), '/ask/conversations');
    assert.equal(validateApiUrl('/notes', '/api'), '/notes');
    assert.equal(validateApiUrl('/auth/login', '/api'), '/auth/login');
  });

  it('api instance request interceptor rejects requests containing "/api/api"', async () => {
    await assert.rejects(
      async () => {
        await api.get('/api/api/test');
      },
      (err) => {
        assert.match(err.message, /\/api\/api/);
        return true;
      }
    );

    await assert.rejects(
      async () => {
        await api.post('/api/ask', { test: true });
      },
      (err) => {
        assert.match(err.message, /\/api\/api/);
        return true;
      }
    );
  });

  it('verifies no source files in client/src contain API calls starting with "/api/"', () => {
    const srcDir = path.resolve(__dirname, '..');
    const matches = [];

    const scanDirectory = (dir) => {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          scanDirectory(fullPath);
        } else if (/\.(js|jsx)$/.test(entry.name) && !entry.name.includes('.test.')) {
          const content = fs.readFileSync(fullPath, 'utf8');
          const lines = content.split('\n');
          lines.forEach((line, idx) => {
            // Check for api.<method>('/api/...') or api.<method>("/api/...") or api.<method>(`/api/...`)
            if (/api\.(?:get|post|put|patch|delete)\s*\(\s*['"`]\/api\//.test(line)) {
              matches.push({ file: fullPath, line: idx + 1, text: line.trim() });
            }
          });
        }
      }
    };

    scanDirectory(srcDir);
    assert.deepEqual(
      matches,
      [],
      `Found forbidden "/api/" prefixed API calls: ${JSON.stringify(matches, null, 2)}`
    );
  });
});
