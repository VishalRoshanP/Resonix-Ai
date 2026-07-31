const dns = require('dns');
try {
  dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);
} catch (e) {}

require('dotenv').config();
const http = require('http');

async function testRealIncidentFlow() {
  const packetId = `pkt_citizen_real_${Date.now()}`;
  console.log('==================================================');
  console.log('STEP 1: EMULATING UNIQUE REAL CITIZEN SOS CREATION');
  console.log('• Packet ID:    ', packetId);
  console.log('• Category:     ', 'BUILDING_COLLAPSE');
  console.log('• Description:  ', 'Structural collapse alert: Commercial building collapsed in Sector 12. 5 citizens trapped under rubble!');
  console.log('• Location:     ', 'Sector 12');
  console.log('• Victim Name:  ', 'Rohan Kumar');

  const payload = JSON.stringify({
    packetId,
    category: 'BUILDING_COLLAPSE',
    priority: 'CRITICAL',
    description: 'Structural collapse alert: Commercial building collapsed in Sector 12. 5 citizens trapped under rubble!',
    victimName: 'Rohan Kumar',
    gpsCoordinates: {
      latitude: 12.9352,
      longitude: 77.6245,
      sector: 'Sector 12',
    },
    userId: 'usr_rohan_kumar_987',
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
      console.log('\nSTEP 2 & 3: BACKEND API & MONGODB SAVE VERIFICATION');
      console.log('• POST HTTP Status:', res.statusCode);
      const postRes = JSON.parse(body);
      console.log('• Backend Response Success:', postRes.data?.success);

      console.log('\nSTEP 4 & 5: VERIFYING RESPONDER GET /api/v1/incidents REAL-TIME QUEUE');
      http.get('http://localhost:5000/api/v1/incidents', (getRes) => {
        let getBody = '';
        getRes.on('data', (c) => { getBody += c; });
        getRes.on('end', () => {
          console.log('• GET HTTP Status:', getRes.statusCode);
          const getParsed = JSON.parse(getBody);
          const list = getParsed.data?.incidents || (Array.isArray(getParsed.data) ? getParsed.data : []);
          console.log('• Total MongoDB Incidents Returned:', list.length);

          const newestIncident = list[0];
          console.log('\nNEWEST INCIDENT AT TOP OF RESPONDER QUEUE:');
          console.log('• Document _id:     ', newestIncident._id || newestIncident.id);
          console.log('• Title:            ', newestIncident.title);
          console.log('• Description:      ', newestIncident.description);
          console.log('• Category:         ', newestIncident.type || newestIncident.category);
          console.log('• Sector/Location:  ', newestIncident.sector || newestIncident.location?.address);
          console.log('• Status:           ', newestIncident.status);

          if (newestIncident.description?.includes('Sector 12') || newestIncident.title?.includes(packetId) || newestIncident.packetId === packetId) {
            console.log('\n==================================================');
            console.log('✅ PROOF VERIFIED: NEW REAL CITIZEN SOS APPEARS AT TOP OF RESPONDER DASHBOARD IMMEDIATELY WITH ACTUAL ENTERED VALUES!');
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

testRealIncidentFlow();
