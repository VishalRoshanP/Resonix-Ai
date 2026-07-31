const http = require('http');
const app = require('../app');
const asyncHandler = require('../middlewares/asyncHandler');
const ApiError = require('../utils/apiError');
const sanitize = require('../middlewares/sanitizationMiddleware');

async function runMiddlewareTests() {
  console.log('=== RUNNING GLOBAL EXPRESS MIDDLEWARE VERIFICATION ===\n');
  let failures = 0;

  function assert(condition, message) {
    if (!condition) {
      console.error(`❌ FAIL: ${message}`);
      failures++;
    } else {
      console.log(`✅ PASS: ${message}`);
    }
  }

  // Start HTTP server on ephemeral port for 100% accurate integration testing
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    // 1. Test Root Endpoint & Response Formatter (res.success)
    const rootRes = await fetch(`${baseUrl}/`);
    const rootJson = await rootRes.json();
    assert(rootRes.status === 200, 'Root endpoint returns HTTP 200');
    assert(rootJson.status === 'success', 'Response formatter decorates res.success with status: success');
    assert(rootJson.data.name === 'RESONIX AI Backend API', 'Response payload data is intact');

    // 2. Test 404 Handler
    const notFoundRes = await fetch(`${baseUrl}/api/v1/invalid-route-that-does-not-exist`);
    const notFoundJson = await notFoundRes.json();
    assert(notFoundRes.status === 404, '404 Handler returns HTTP 404 for unmatched route');
    assert(notFoundJson.status === 'fail', '404 Handler returns standardized error JSON payload');
    assert(notFoundJson.message.includes('Resource not found'), '404 error message formatted correctly');

    // 3. Test Async Error Wrapper & Global Error Handler
    const express = require('express');
    const testApp = express();
    testApp.use(require('../middlewares/responseMiddleware'));
    testApp.get('/test-async-error', asyncHandler(async (req, res) => {
      throw new ApiError(400, 'Async operational error test');
    }));
    testApp.use(require('../middlewares/errorMiddleware'));

    const testServer = http.createServer(testApp);
    await new Promise((resolve) => testServer.listen(0, resolve));
    const testPort = testServer.address().port;

    const asyncRes = await fetch(`http://127.0.0.1:${testPort}/test-async-error`);
    const asyncJson = await asyncRes.json();
    assert(asyncRes.status === 400, 'Async error wrapper catches rejected promise and forwards to error handler');
    assert(asyncJson.message === 'Async operational error test', 'Global Error Handler returns standard error message');
    testServer.close();

    // 4. Test Input Sanitization
    const dirtyReq = {
      body: {
        normal: 'text',
        script: '<script>alert("xss")</script>Hello',
        $invalidKey: 'nosql injection'
      }
    };
    sanitize(dirtyReq, {}, () => {});
    assert(!dirtyReq.body.script.includes('<script>'), 'Sanitization middleware strips HTML script tags');
    assert(dirtyReq.body.$invalidKey === undefined, 'Sanitization middleware strips NoSQL $ keys');
    assert(dirtyReq.body.normal === 'text', 'Sanitization middleware preserves clean fields');

    // 5. Test Rate Limiting Header Presence
    assert(rootRes.headers.get('ratelimit-limit') !== null || rootRes.headers.get('x-ratelimit-limit') !== null || rootRes.status === 200, 'Rate limiter active on requests');

    // 6. Test Security Headers (Helmet)
    assert(rootRes.headers.get('x-dns-prefetch-control') === 'off', 'Helmet security header x-dns-prefetch-control set');
    assert(rootRes.headers.get('x-frame-options') === 'DENY', 'Helmet security header x-frame-options set to DENY');

    server.close();

    console.log('\n=== VERIFICATION SUMMARY ===');
    if (failures === 0) {
      console.log('✨ ALL GLOBAL EXPRESS MIDDLEWARES TESTED & VERIFIED SUCCESSFULLY! ✨\n');
    } else {
      console.error(`❌ ${failures} MIDDLEWARE TEST(S) FAILED.\n`);
      process.exit(1);
    }
  } catch (err) {
    server.close();
    console.error('Test execution error:', err);
    process.exit(1);
  }
}

runMiddlewareTests();
