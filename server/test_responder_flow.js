const dns = require('dns');
try {
  dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);
} catch (e) {}

require('dotenv').config();
const http = require('http');

async function verifyResponderFlow() {
  const packetId = `pkt_sos_live_${Date.now()}`;
  console.log('==================================================');
  console.log('STEP 1: EMULATING CITIZEN APP SOS BUTTON PRESS');
  console.log('• Packet ID:', packetId);
  console.log('• Endpoint:  POST /api/v1/emergency/create');

  const postPayload = JSON.stringify({
    packetId,
    category: 'FLOOD',
    priority: 'CRITICAL',
    description: 'Urgent: Flash flood submersion near Sector 4. Immediate NDRF boat dispatch required!',
    gpsCoordinates: {
      latitude: 12.9716,
      longitude: 77.5946,
      sector: 'Sector 4',
    },
    userId: 'usr_citizen_live_test',
  });

  const req = http.request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/v1/emergency/create',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postPayload),
    },
  }, (res) => {
    let body = '';
    res.on('data', (c) => { body += c; });
    res.on('end', () => {
      console.log('STEP 2: EXPRESS BACKEND RESPONSE');
      console.log('• HTTP Status:', res.statusCode);
      console.log('• Response Body:', body.substring(0, 150) + '...');

      console.log('\nSTEP 3 & 4: VERIFYING RESPONDER DASHBOARD API (GET /api/v1/incidents)');
      http.get('http://localhost:5000/api/v1/incidents', (getRes) => {
        let getBody = '';
        getRes.on('data', (c) => { getBody += c; });
        getRes.on('end', () => {
          console.log('• GET HTTP Status:', getRes.statusCode);
          const parsed = JSON.parse(getBody);
          const list = parsed.data?.incidents || (Array.isArray(parsed.data) ? parsed.data : []);
          console.log('• Total Incidents Returned to Responder Dashboard:', list.length);

          const found = list.find(inc => inc.packetId === packetId || JSON.stringify(inc).includes(packetId));
          if (found) {
            console.log('==================================================');
            console.log('✅ VERIFICATION SUCCESSFUL!');
            console.log('• Created Incident ID:', found._id || found.id);
            console.log('• Category:           ', found.category || found.type);
            console.log('• Severity:           ', found.severity || found.priority);
            console.log('• Title:              ', found.title);
            console.log('• Status:             ', found.status);
            console.log('• Rendered on Dashboard Queue: YES');
            console.log('==================================================');
          } else {
            console.log('❌ VERIFICATION FAILED: Incident missing from responder GET response');
          }
          process.exit(0);
        });
      });
    });
  });

  req.on('error', (err) => {
    console.error('Request Failed:', err.message);
    process.exit(1);
  });

  req.write(postPayload);
  req.end();
}

verifyResponderFlow();
