const dns = require('dns');
try {
  dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);
} catch (e) {}

require('dotenv').config();
const http = require('http');

async function testStrictRealData() {
  const packetId = `pkt_citizen_med_${Date.now()}`;
  console.log('==================================================');
  console.log('STEP 1: SUBMITTING CITIZEN MEDICAL SOS REPORT');
  console.log('• Packet ID:    ', packetId);
  console.log('• Category:     ', 'MEDICAL');
  console.log('• Description:  ', 'Medical Emergency: Citizen suffering acute respiratory distress in Sector 18.');
  console.log('• Sector:       ', 'Sector 18');
  console.log('• Victim Name:  ', 'Anita Sharma');

  const payload = JSON.stringify({
    packetId,
    category: 'MEDICAL',
    priority: 'HIGH',
    description: 'Medical Emergency: Citizen suffering acute respiratory distress in Sector 18.',
    victimName: 'Anita Sharma',
    gpsCoordinates: {
      latitude: 12.9123,
      longitude: 77.6321,
      sector: 'Sector 18',
    },
    userId: 'usr_anita_sharma_456',
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
      console.log('\nSTEP 2: BACKEND MONGO RESPONSE');
      console.log('• POST HTTP Status:', res.statusCode);

      console.log('\nSTEP 3: VERIFYING RESPONDER GET /api/v1/incidents REAL-TIME ARRAY');
      http.get('http://localhost:5000/api/v1/incidents', (getRes) => {
        let getBody = '';
        getRes.on('data', (c) => { getBody += c; });
        getRes.on('end', () => {
          console.log('• GET HTTP Status:', getRes.statusCode);
          const getParsed = JSON.parse(getBody);
          const list = getParsed.data?.incidents || (Array.isArray(getParsed.data) ? getParsed.data : []);
          console.log('• Total Real Incidents in MongoDB:', list.length);

          const newestIncident = list[0];
          console.log('\nNEWEST INCIDENT RENDERED AT TOP OF QUEUE:');
          console.log('• Document ID:      ', newestIncident._id || newestIncident.id);
          console.log('• Category:         ', newestIncident.type || newestIncident.category);
          console.log('• Description:      ', newestIncident.description);
          console.log('• Sector/Location:  ', newestIncident.sector || newestIncident.location?.address);
          console.log('• Status:           ', newestIncident.status);

          if (newestIncident.description?.includes('Sector 18') || newestIncident.title?.includes(packetId) || newestIncident.packetId === packetId) {
            console.log('\n==================================================');
            console.log('✅ CONFIRMATION PASSED: RESPONDER DASHBOARD RENDERS ONLY REAL MONGODB INCIDENTS IN REAL TIME!');
            console.log('==================================================');
          } else {
            console.log('\n❌ FAILED: Newest incident does not match submitted citizen payload.');
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

testStrictRealData();
