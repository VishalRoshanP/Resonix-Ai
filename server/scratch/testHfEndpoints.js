const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const token = process.env.HF_TOKEN;
console.log('Testing HF_TOKEN:', token ? `${token.substring(0, 8)}...` : 'NONE');

async function testCompletions() {
  const modelId = 'google/gemma-4-E4B-it';

  // Test 1: /v1/completions
  console.log('\n--- Test 1: https://router.huggingface.co/v1/completions ---');
  try {
    const res = await fetch('https://router.huggingface.co/v1/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: modelId,
        prompt: '<start_of_turn>user\nTriage emergency: Flood in Sector 4<end_of_turn>\n<start_of_turn>model\n',
        max_tokens: 50,
        temperature: 0.1
      })
    });
    console.log(`Status: ${res.status} ${res.statusText}`);
    const text = await res.text();
    console.log('Response:', text);
  } catch (err) {
    console.log('Error:', err.message);
  }

  // Test 2: HfInference from @huggingface/inference with provider specified or textGeneration
  console.log('\n--- Test 2: @huggingface/inference SDK textGeneration ---');
  try {
    const { HfInference } = require('@huggingface/inference');
    const hf = new HfInference(token);
    // Try textGeneration / textGenerationStream
    const res = await hf.textGeneration({
      model: modelId,
      inputs: '<start_of_turn>user\nTriage emergency: Flood in Sector 4<end_of_turn>\n<start_of_turn>model\n',
      parameters: { max_new_tokens: 50 }
    });
    console.log('HfInference Result:', res);
  } catch (err) {
    console.log('HfInference Error:', err.message);
  }

  // Test 3: router.huggingface.co with provider (e.g. hf-inference, novita, together, etc.)
  const providers = ['hf-inference', 'together', 'fireworks-ai', 'nebius', 'fal-ai', 'replicate', 'hyperbolic'];
  for (const provider of providers) {
    console.log(`\n--- Test Provider: ${modelId}:${provider} ---`);
    try {
      const res = await fetch('https://router.huggingface.co/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: `${modelId}:${provider}`,
          messages: [{ role: 'user', content: 'Hello' }],
          max_tokens: 20
        })
      });
      console.log(`Status (${provider}): ${res.status}`);
      const txt = await res.text();
      console.log(`Response (${provider}):`, txt.substring(0, 150));
    } catch (e) {
      console.log(`Error (${provider}):`, e.message);
    }
  }
}

testCompletions();
