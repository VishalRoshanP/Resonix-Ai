const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const apiKey = process.env.GOOGLE_API_KEY;

if (!apiKey) {
  console.error('ERROR: GOOGLE_API_KEY is not set in server/.env');
  process.exit(1);
}

console.log('GOOGLE_API_KEY loaded successfully (length:', apiKey.length, ')');

async function listModels() {
  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
    if (!response.ok) {
      const errText = await response.text();
      console.error('Failed to list models. HTTP Status:', response.status, errText);
      return;
    }

    const data = await response.json();
    const allModels = data.models || [];
    console.log(`\nTotal models returned by Google AI Studio API: ${allModels.length}`);

    console.log('\n--- ALL AVAILABLE MODELS ---');
    allModels.forEach(m => {
      console.log(`- ${m.name} (${m.displayName || 'No display name'})`);
    });

    const gemmaModels = allModels.filter(m => 
      m.name.toLowerCase().includes('gemma') || (m.displayName && m.displayName.toLowerCase().includes('gemma'))
    );

    console.log(`\n--- GEMMA MODELS FOUND (${gemmaModels.length}) ---`);
    gemmaModels.forEach(m => {
      console.log(`Model ID: ${m.name}`);
      console.log(`Display Name: ${m.displayName}`);
      console.log(`Description: ${m.description}`);
      console.log(`Supported Generation Methods:`, m.supportedGenerationMethods);
      console.log('----------------------------------------------------');
    });

    const e4bModels = gemmaModels.filter(m =>
      m.name.toLowerCase().includes('e4b') || (m.displayName && m.displayName.toLowerCase().includes('e4b'))
    );

    console.log(`\n--- SPECIFIC GEMMA 4 E4B MODELS FOUND (${e4bModels.length}) ---`);
    e4bModels.forEach(m => {
      console.log(`MATCH: ${m.name}`);
    });

  } catch (err) {
    console.error('Error querying Google AI Studio API:', err.message);
  }
}

listModels();
