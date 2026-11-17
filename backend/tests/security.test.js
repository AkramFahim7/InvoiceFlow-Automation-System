const test = require('node:test');
const assert = require('node:assert/strict');
const {
  securityHeaders,
  createRateLimiter,
} = require('../src/middleware/security.middleware');
const { escapeHtml } = require('../src/services/emailTemplates.service');

test('securityHeaders attaches nosniff, X-Frame-Options, and Referrer-Policy', () => {
  const headers = {};
  const res = {
    setHeader(name, value) {
      headers[name] = value;
    },
  };

  let nextCalled = false;
  securityHeaders({}, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, true);
  assert.equal(headers['X-Content-Type-Options'], 'nosniff');
  assert.equal(headers['X-Frame-Options'], 'DENY');
  assert.equal(headers['Referrer-Policy'], 'strict-origin-when-cross-origin');
});

test('createRateLimiter allows requests up to maxRequests and blocks excess with 429', () => {
  const limiter = createRateLimiter({
    windowMs: 60000,
    maxRequests: 2,
    keyPrefix: 'unit',
  });

  const req = { ip: '127.0.0.1' };
  const headers = {};
  const res = {
    setHeader(name, value) {
      headers[name] = value;
    },
  };

  const results = [];
  for (let i = 0; i < 3; i += 1) {
    limiter(req, res, (err) => {
      results.push(err || null);
    });
  }

  assert.equal(results[0], null);
  assert.equal(results[1], null);
  assert.ok(results[2] instanceof Error);
  assert.equal(results[2].statusCode, 429);
  assert.ok(Number(headers['Retry-After']) >= 1);
});

test('escapeHtml neutralizes script tags and quotes in HTML email templates', () => {
  const dirty = `<script>alert("xss")</script> & 'single'`;
  const clean = escapeHtml(dirty);
  assert.equal(
    clean,
    '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt; &amp; &#39;single&#39;'
  );
});

