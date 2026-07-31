const dns = require('dns');
try {
  dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);
} catch (e) {}

require('dotenv').config();
const http = require('http');

async function testPostAndGet() {
  const packetId = `pkt_verify_${Date.now()}`;
  console.log('==================================================');
  console.log('TESTING POST /api/v1/emergency/create with Packet ID:', packetId);

  const postData = JSON.stringify({
    packetId,
    category: 'CRITICAL',
    description: 'Test Emergency SOS from automated verification script',
    gpsCoordinates: {
      latitude: 12.9716,
      longitude: 77.5946,
      sector: 'Sector 4',
    },
    userId: 'usr_test_verification',
  });

  const postOptions = {
    hostname: 'localhost',
    port: 5000,
    path: '/api/v1/emergency/create',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData),
    },
  };

  const req = http.request(postOptions, (res) => {
    let responseBody = '';
    res.on('data', (chunk) => { responseBody += chunk; });
    res.on('end', () => {
      console.log('POST Response Status:', res.statusCode);
      console.log('POST Response Body:', responseBody);

      // Now test GET /api/v1/incidents
      console.log('\n==================================================');
      console.log('TESTING GET /api/v1/incidents');
      http.get('http://localhost:5000/api/v1/incidents', (getRes) => {
        let getBody = '';
        getRes.on('data', (chunk) => { getBody += chunk; });
        getRes.on('end', () => {
          console.log('GET Response Status:', getRes.statusCode);
          const parsed = JSON.parse(getBody);
          const list = parsed.data?.incidents || (Array.isArray(parsed.data) ? parsed.data : []);
          console.log('Total Incidents Returned:', list.length);
          
          const found = list.find(inc => inc.packetId === packetId || JSON.stringify(inc).includes(packetId));
          if (found) {
            console.log('==================================================');
            console.log('✅ TEST PASSED: Created Incident successfully found in GET /api/v1/incidents!');
            console.log('• Incident ID:', found._id || found.id);
            console.log('• Packet ID:  ', found.packetId || packetId);
            console.log('• Title:      ', found.title);
            console.log('==================================================');
          } else {
            console.log('❌ TEST FAILED: Created incident was not found in GET response');
          }
          process.exit(0);
        });
      });
    });
  });

  req.on('error', (e) => {
    console.error('POST Request Error:', e);
    process.exit(1);
  });

  req.write(postData);
  req.end();
}

testPostAndGet();
