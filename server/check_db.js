require('dotenv').config();
const dns = require('dns');
try {
  dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);
} catch (e) {}

const mongoose = require('mongoose');

async function testConnection() {
  console.log('==================================================');
  console.log('MONGODB DIAGNOSTIC TEST WITH PUBLIC DNS');
  console.log('MONGODB_URI:', process.env.MONGODB_URI);

  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 10000,
      family: 4,
    });

    console.log('Connected Host:', conn.connection.host);
    console.log('Connected DB Name:', conn.connection.name);
    
    const collections = await conn.connection.db.listCollections().toArray();
    console.log('Collections in Database:', collections.map(c => c.name));

    const Incident = require('./models/Incident');
    const EmergencyPacket = require('./models/EmergencyPacket');

    const incidentCount = await Incident.countDocuments();
    const packetCount = await EmergencyPacket.countDocuments();

    console.log('Incident Document Count:', incidentCount);
    console.log('EmergencyPacket Document Count:', packetCount);

    const sampleIncidents = await Incident.find({}).limit(5);
    console.log('Sample Incidents Count:', sampleIncidents.length);

    process.exit(0);
  } catch (err) {
    console.error('MongoDB Diagnostic Error:', err);
    process.exit(1);
  }
}

testConnection();
