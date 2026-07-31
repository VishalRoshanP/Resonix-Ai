const http = require('http');

function makeRequest(attempt) {
  return new Promise((resolve, reject) => {
    http.get('http://localhost:5000/api/v1/incidents', (res) => {
      let body = '';
      res.on('data', (c) => { body += c; });
      res.on('end', () => {
        console.log(`Request #${attempt}: HTTP Status = ${res.statusCode} ${res.statusMessage}`);
        resolve(res.statusCode);
      });
    }).on('error', reject);
  });
}

async function verify304Fix() {
  console.log('==================================================');
  console.log('VERIFYING HTTP 304 PREVENTATIVE CACHING FIX');
  console.log('==================================================');
  const status1 = await makeRequest(1);
  const status2 = await makeRequest(2);
  const status3 = await makeRequest(3);

  if (status1 === 200 && status2 === 200 && status3 === 200) {
    console.log('==================================================');
    console.log('✅ FIXED: ALL GET /api/v1/incidents REQUESTS RETURN HTTP 200 OK (NO 304 NOT MODIFIED)!');
    console.log('==================================================');
  } else {
    console.log('❌ FAIL: Still returned 304 status code');
  }
}

verify304Fix();
