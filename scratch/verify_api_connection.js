const http = require('http');

console.log('=== RESONIX AI Shared API Verification ===');

const BASE_URL = 'http://localhost:5000/api/v1';

function checkEndpoint(path) {
  return new Promise((resolve) => {
    http.get(`${BASE_URL}${path}`, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        resolve({
          path,
          statusCode: res.statusCode,
          headers: res.headers,
          data: data.slice(0, 150),
        });
      });
    }).on('error', (err) => {
      resolve({ path, error: err.message });
    });
  });
}

async function runVerification() {
  const endpoints = ['/health', '/status', '/version', '/incidents', '/reports', '/relay'];

  console.log(`Checking backend API on ${BASE_URL}...\n`);

  for (const ep of endpoints) {
    const res = await checkEndpoint(ep);
    if (res.error) {
      console.log(`❌ [${ep}] Request Error: ${res.error}`);
    } else {
      console.log(`✅ [${ep}] Status Code: ${res.statusCode} | Data Preview: ${res.data}`);
    }
  }

  console.log('\n=== Shared API Verification Finished ===');
}

runVerification();
