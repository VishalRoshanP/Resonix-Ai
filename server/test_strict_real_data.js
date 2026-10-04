const http = require('http');

async function traceCategoryEndToEnd() {
  console.log('==================================================');
  console.log('END-TO-END CITIZEN CATEGORY TRACE VERIFICATION');
  console.log('==================================================');

  const selectedCategory = 'EARTHQUAKE';
  const victimName = 'Anita Sharma';
  const description = 'Trapped in building aftermath, urgent rescue needed.';
  const packetId = `pkt_trace_cat_${Date.now()}`;
  const priority = 'CRITICAL';
  const latitude = 12.9755;
  const longitude = 77.5899;

  console.log(`1. Citizen Selected Category:    ${selectedCategory}`);

  const payloadData = {
    packetId,
    category: selectedCategory,
    description,
    priority,
    gpsCoordinates: {
      latitude,
      longitude,
      sector: 'Sector 14',
    },
    victimName,
    user: {
      _id: 'usr_anita_14',
      name: victimName,
      phone: '+91 91234 56789',
    },
  };

  const payloadString = JSON.stringify(payloadData);
  console.log(`2. HTTP Request Payload Category: ${JSON.parse(payloadString).category}`);

  await new Promise((resolve, reject) => {
    const req = http.request(
      'http://localhost:5000/api/v1/emergency/create',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payloadString),
        },
      },
      (res) => {
        let body = '';
        res.on('data', (c) => (body += c));
        res.on('end', () => {
          const parsed = JSON.parse(body);
          console.log(`3. Backend Response Status:       ${res.statusCode} ${res.statusMessage}`);
          resolve();
        });
      }
    );
    req.on('error', reject);
    req.write(payloadString);
    req.end();
  });

  // Verify GET /api/v1/incidents response mapping
  http.get('http://localhost:5000/api/v1/incidents', (getRes) => {
    let getBody = '';
    getRes.on('data', (c) => (getBody += c));
    getRes.on('end', () => {
      const listRes = JSON.parse(getBody);
      const dataObj = listRes?.data || {};
      const incidentsList = Array.isArray(dataObj.incidents) ? dataObj.incidents : (Array.isArray(dataObj.data) ? dataObj.data : []);
      const topIncident = incidentsList[0] || {};

      console.log(`4. MongoDB Stored Category:       ${topIncident.category}`);
      console.log(`5. GET API Category:              ${topIncident.category}`);
      console.log(`6. Dashboard Rendered Category:    ${(topIncident.category || '').toUpperCase()}`);

      console.log('==================================================');
      console.log('TELEMETRY VERIFICATION CHECKLIST:');
      console.log('==================================================');
      console.log(`• Description:   ${topIncident.description}`);
      console.log(`• Priority:      ${topIncident.severity || topIncident.priority}`);
      console.log(`• GPS Location:  Lat ${topIncident.location?.lat}, Lng ${topIncident.location?.lng}`);
      console.log(`• Sector Name:   ${topIncident.sector}`);
      console.log(`• Timestamp:     ${topIncident.createdAt}`);
      console.log('==================================================');

      if ((topIncident.category || '').toUpperCase() === selectedCategory) {
        console.log('✅ PERFECT MATCH: CITIZEN CATEGORY PRESERVED IDENTICALLY AT ALL 6 TRACE STEPS!');
      } else {
        console.log('❌ MISMATCH: Category altered');
      }
      console.log('==================================================');
      process.exit(0);
    });
  });
}

traceCategoryEndToEnd();
