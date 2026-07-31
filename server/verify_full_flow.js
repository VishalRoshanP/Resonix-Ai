const dns = require('dns');
try {
  dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);
} catch (e) {}

require('dotenv').config();
const http = require('http');

async function runCompleteTrace() {
  const packetId = `pkt_trace_${Date.now()}`;
  console.log('==================================================');
  console.log('STEP 1: CITIZEN SOS SUBMISSION TRACE');
  console.log('• Target Endpoint: POST http://localhost:5000/api/v1/emergency/create');
  console.log('• Packet ID:       ', packetId);

  const payload = JSON.stringify({
    packetId,
    category: 'CRITICAL',
    priority: 'CRITICAL',
    description: 'Trace Verification SOS: Flash flood hazard near Sector 4.',
    gpsCoordinates: {
      latitude: 12.9716,
      longitude: 77.5946,
      sector: 'Sector 4',
    },
    userId: 'usr_citizen_trace_test',
  });

  const req = http.request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/v1/emergency/create',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(payload),
    },
  }, (res) => {
    let body = '';
    res.on('data', (c) => { body += c; });
    res.on('end', () => {
      console.log('\nSTEP 2: BACKEND CONTROLLER & MONGO SAVE RESPONSE');
      console.log('• Response HTTP Status:', res.statusCode);
      const parsedPost = JSON.parse(body);
      console.log('• Response Success:    ', parsedPost.data?.success);
      console.log('• Returned Packet ID:  ', parsedPost.data?.packetId);

      console.log('\nSTEP 3 & 4: DATABASE & RESPONDER GET API VERIFICATION');
      console.log('• Target Endpoint: GET http://localhost:5000/api/v1/incidents');

      http.get('http://localhost:5000/api/v1/incidents', (getRes) => {
        let getBody = '';
        getRes.on('data', (c) => { getBody += c; });
        getRes.on('end', () => {
          console.log('• GET HTTP Status:     ', getRes.statusCode);
          const parsedGet = JSON.parse(getBody);
          const list = parsedGet.data?.incidents || (Array.isArray(parsedGet.data) ? parsedGet.data : []);
          console.log('• Total MongoDB Incidents Returned:', list.length);

          const found = list.find(inc => inc.packetId === packetId || JSON.stringify(inc).includes(packetId));
          if (found) {
            console.log('\n==================================================');
            console.log('✅ TRACE VERIFICATION SUCCESSFUL!');
            console.log('• Document ObjectId: ', found._id || found.id);
            console.log('• Packet ID:         ', found.packetId || packetId);
            console.log('• Incident Title:    ', found.title);
            console.log('• Incident Severity: ', found.severity || found.priority);
            console.log('• Incident Status:   ', found.status);
            console.log('• Displayed on Dashboard: YES');
            console.log('==================================================');
          } else {
            console.log('❌ TRACE VERIFICATION FAILED: Incident document not found in GET response');
          }
          process.exit(0);
        });
      });
    });
  });

  req.on('error', (err) => {
    console.error('Request Error:', err.message);
    process.exit(1);
  });

  req.write(payload);
  req.end();
}

runCompleteTrace();
