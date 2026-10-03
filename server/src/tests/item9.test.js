const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

describe('Item 9: Deployment configs & README', () => {
  it('server/package.json contains engines with node >=20', () => {
    const pkgPath = path.resolve(__dirname, '../../package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    assert.ok(pkg.engines);
    assert.equal(pkg.engines.node, '>=20');
  });

  it('client/vercel.json rewrites all routes to /index.html', () => {
    const vercelPath = path.resolve(__dirname, '../../../client/vercel.json');
    assert.ok(fs.existsSync(vercelPath), 'client/vercel.json must exist');
    const vercelConfig = JSON.parse(fs.readFileSync(vercelPath, 'utf8'));
    assert.ok(Array.isArray(vercelConfig.rewrites));
    const rewrite = vercelConfig.rewrites.find(
      (r) => r.source === '/(.*)' && r.destination === '/index.html'
    );
    assert.ok(rewrite, 'Rewrite rule for /(.*) to /index.html must be present');
  });

  it('README.md contains Deployment section with environment variables table', () => {
    const readmePath = path.resolve(__dirname, '../../../README.md');
    const content = fs.readFileSync(readmePath, 'utf8');
    assert.match(content, /## 🚀 Deployment/);
    assert.match(content, /MONGODB_URI/);
    assert.match(content, /JWT_SECRET/);
    assert.match(content, /GEMINI_API_KEY/);
    assert.match(content, /CLIENT_URL/);
    assert.match(content, /VITE_API_URL/);
  });
});
