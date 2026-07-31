const express = require('express');
const apiRouter = require('../routes/apiRouter');
const errorHandler = require('../middlewares/errorMiddleware');

const app = express();
app.use(express.json());
app.use('/api', apiRouter);
app.use(errorHandler);

async function runApiArchitectureTests() {
  console.log('=== RUNNING REST API ARCHITECTURE VERIFICATION ===\n');
  let failures = 0;

  function assert(condition, message) {
    if (!condition) {
      console.error(`❌ FAIL: ${message}`);
      failures++;
    } else {
      console.log(`✅ PASS: ${message}`);
    }
  }

  // Simple HTTP simulation helper using Express internal router handling
  function makeRequest(method, url, body = null) {
    return new Promise((resolve) => {
      const reqMock = Object.assign(new (require('events').EventEmitter)(), {
        method,
        url,
        originalUrl: url,
        headers: { 'content-type': 'application/json' },
        body: body || {},
        query: {},
        params: {},
        ip: '127.0.0.1',
      });

      // Parse query string if present
      if (url.includes('?')) {
        const queryString = url.split('?')[1];
        const searchParams = new URLSearchParams(queryString);
        searchParams.forEach((val, key) => {
          reqMock.query[key] = val;
        });
      }

      const resMock = {
        statusCode: 200,
        headers: {},
        status(code) {
          this.statusCode = code;
          return this;
        },
        setHeader(k, v) {
          this.headers[k] = v;
          return this;
        },
        json(data) {
          resolve({ status: this.statusCode, data });
          return this;
        },
        send(data) {
          resolve({ status: this.statusCode, data });
          return this;
        },
      };

      app(reqMock, resMock, (err) => {
        if (err) {
          errorHandler(err, reqMock, resMock, () => {});
        }
      });
    });
  }

  try {
    // 1. /api/auth
    const resAuth = await makeRequest('POST', '/api/auth/google');
    assert(resAuth.status === 501, '/api/auth/google returns 501 Not Implemented');

    // 2. /api/users
    const resUsers = await makeRequest('GET', '/api/users');
    assert(resUsers.status === 200 && resUsers.data.status === 'success', 'GET /api/users returns 200 with users data');

    const resUserFail = await makeRequest('POST', '/api/users', { name: '' });
    assert(resUserFail.status === 400, 'POST /api/users validates missing required input');

    // 3. /api/reports
    const resReports = await makeRequest('GET', '/api/reports');
    assert(resReports.status === 200 && resReports.data.status === 'success', 'GET /api/reports returns 200 with reports data');

    // 4. /api/incidents
    const resIncidents = await makeRequest('GET', '/api/incidents');
    assert(resIncidents.status === 200 && resIncidents.data.status === 'success', 'GET /api/incidents returns 200 with incidents data');

    // 5. /api/dashboard
    const resDashboard = await makeRequest('GET', '/api/dashboard/stats');
    assert(resDashboard.status === 200 && resDashboard.data.data.stats.meshNetworkStatus === 'Optimal', 'GET /api/dashboard/stats returns stats');

    // 6. /api/relay
    const resRelay = await makeRequest('GET', '/api/relay');
    assert(resRelay.status === 200 && Array.isArray(resRelay.data.data.nodes), 'GET /api/relay returns relay nodes array');

    // 7. /api/settings
    const resSettings = await makeRequest('GET', '/api/settings');
    assert(resSettings.status === 200 && resSettings.data.data.settings.theme === 'dark', 'GET /api/settings returns settings object');

    // 8. /api/analytics
    const resAnalytics = await makeRequest('GET', '/api/analytics?range=24h');
    assert(resAnalytics.status === 200 && resAnalytics.data.data.analytics.range === '24h', 'GET /api/analytics returns analytics report');

    // 9. /api/resources
    const resResources = await makeRequest('GET', '/api/resources');
    assert(resResources.status === 200 && resResources.data.status === 'success', 'GET /api/resources returns 200 with resources data');

    console.log('\n=== VERIFICATION SUMMARY ===');
    if (failures === 0) {
      console.log('✨ ALL 9 REST API ROUTE GROUPS TESTED & VERIFIED SUCCESSFULLY! ✨\n');
    } else {
      console.error(`❌ ${failures} ROUTE GROUP TEST(S) FAILED.\n`);
      process.exit(1);
    }
  } catch (err) {
    console.error('Test execution error:', err);
    process.exit(1);
  }
}

runApiArchitectureTests();
