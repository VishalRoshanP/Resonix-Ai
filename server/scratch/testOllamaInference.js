async function testOllamaInference() {
  console.log('Sending test prompt to Ollama model gemma4:e4b...');
  const startTime = Date.now();

  try {
    const response = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gemma4:e4b',
        prompt: '<start_of_turn>user\nTriage emergency: Flash flood in Sector 4, 3 people trapped. Respond with JSON: {"disaster": "FLOOD", "severity": "CRITICAL"}<end_of_turn>\n<start_of_turn>model\n',
        stream: false,
        options: {
          temperature: 0.1,
          num_predict: 200
        }
      })
    });

    const duration = Date.now() - startTime;
    if (!response.ok) {
      console.error('Ollama HTTP Error:', response.status, await response.text());
      return;
    }

    const data = await response.json();
    console.log(`\nSuccess in ${duration}ms!`);
    console.log('Model:', data.model);
    console.log('Generated Output:\n', data.response);
  } catch (err) {
    console.error('Inference Error:', err.message);
  }
}

testOllamaInference();
