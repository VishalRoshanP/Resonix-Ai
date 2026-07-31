const http = require('http');
const app = require('../app');

async function runHealthEndpointTests() {
  console.log('=== RUNNING BACKEND HEALTH ENDPOINTS VERIFICATION ===\n');
  let failures = 0;

  function assert(condition, message) {
    if (!condition) {
      console.error(`❌ FAIL: ${message}`);
      failures++;
    } else {
      console.log(`✅ PASS: ${message}`);
    }
  }

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    // 1. Test /api/health
    const healthRes = await fetch(`${baseUrl}/api/health`);
    const healthJson = await healthRes.json();
    assert(healthRes.status === 200, 'GET /api/health returns HTTP 200');
    assert(healthJson.status === 'success', 'GET /api/health status is success');
    assert(healthJson.data.serverStatus === 'Healthy', 'GET /api/health includes serverStatus');
    assert(healthJson.data.databaseStatus !== undefined, 'GET /api/health includes databaseStatus');
    assert(healthJson.data.mongoDBConnection !== undefined, 'GET /api/health includes mongoDBConnection object');
    assert(healthJson.data.environment !== undefined, 'GET /api/health includes environment');
    assert(healthJson.data.apiVersion !== undefined, 'GET /api/health includes apiVersion');
    assert(healthJson.data.timestamp !== undefined, 'GET /api/health includes timestamp');
    assert(healthJson.data.gemmaStatus !== undefined, 'GET /api/health includes gemmaStatus placeholder');

    // 2. Test /api/version
    const versionRes = await fetch(`${baseUrl}/api/version`);
    const versionJson = await versionRes.json();
    assert(versionRes.status === 200, 'GET /api/version returns HTTP 200');
    assert(versionJson.status === 'success', 'GET /api/version status is success');
    assert(versionJson.data.apiVersion !== undefined, 'GET /api/version includes apiVersion');
    assert(versionJson.data.environment !== undefined, 'GET /api/version includes environment');
    assert(versionJson.data.gemmaVersion !== undefined, 'GET /api/version includes gemmaVersion');
    assert(versionJson.data.timestamp !== undefined, 'GET /api/version includes timestamp');

    // 3. Test /api/status
    const statusRes = await fetch(`${baseUrl}/api/status`);
    const statusJson = await statusRes.json();
    assert(statusRes.status === 200, 'GET /api/status returns HTTP 200');
    assert(statusJson.status === 'success', 'GET /api/status status is success');
    assert(statusJson.data.serverStatus === 'Operational', 'GET /api/status serverStatus is Operational');
    assert(typeof statusJson.data.uptimeSeconds === 'number', 'GET /api/status includes uptimeSeconds');
    assert(statusJson.data.databaseStatus !== undefined, 'GET /api/status includes databaseStatus');
    assert(statusJson.data.mongoDBConnection !== undefined, 'GET /api/status includes mongoDBConnection');
    assert(statusJson.data.environment !== undefined, 'GET /api/status includes environment');
    assert(statusJson.data.apiVersion !== undefined, 'GET /api/status includes apiVersion');
    assert(statusJson.data.timestamp !== undefined, 'GET /api/status includes timestamp');
    assert(statusJson.data.gemmaStatus !== undefined, 'GET /api/status includes gemmaStatus');

    server.close();

    console.log('\n=== VERIFICATION SUMMARY ===');
    if (failures === 0) {
      console.log('✨ ALL 3 HEALTH ENDPOINTS VERIFIED & PASSED SUCCESSFULLY! ✨\n');
    } else {
      console.error(`❌ ${failures} TEST(S) FAILED.\n`);
      process.exit(1);
    }
  } catch (err) {
    server.close();
    console.error('Test execution error:', err);
    process.exit(1);
  }
}

runHealthEndpointTests();
