async function testOllama() {
  try {
    const versionRes = await fetch('http://localhost:11434/api/version');
    const versionData = await versionRes.json();
    console.log('Ollama Version:', versionData);

    const tagsRes = await fetch('http://localhost:11434/api/tags');
    const tagsData = await tagsRes.json();
    console.log('Ollama Installed Models:');
    if (tagsData.models) {
      tagsData.models.forEach(m => console.log(` - ${m.name} (Size: ${Math.round(m.size / 1024 / 1024)} MB)`));
    }

    const hasTargetModel = tagsData.models && tagsData.models.some(m => m.name === 'gemma4:e4b' || m.name.startsWith('gemma4:e4b'));
    console.log('\nTarget model gemma4:e4b found:', hasTargetModel);

  } catch (err) {
    console.error('Failed to connect to local Ollama server:', err.message);
  }
}

testOllama();
