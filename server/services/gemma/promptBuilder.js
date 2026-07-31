/**
 * Prompt Builder Utility for Gemma 4 E4B
 * Formats system context, user inputs, and structured JSON requirements for Gemma inference.
 */

class PromptBuilder {
  /**
   * Builds formatted chat prompt adhering to Gemma 4 instruction template
   * @param {Object} params
   * @param {string} params.systemInstruction - Base system role/instructions
   * @param {string|Object} params.userInput - Raw user prompt or structured object
   * @param {Object} [params.context] - Additional context parameters
   * @returns {string} Formatted prompt string
   */
  buildChatPrompt({ systemInstruction, userInput, context = {} }) {
    const formattedContext = Object.keys(context).length > 0
      ? `\nCONTEXT:\n${JSON.stringify(context, null, 2)}\n`
      : '';

    const formattedInput = typeof userInput === 'object'
      ? JSON.stringify(userInput, null, 2)
      : userInput;

    return `<start_of_turn>user\n${systemInstruction}${formattedContext}\nINPUT:\n${formattedInput}<end_of_turn>\n<start_of_turn>model\n`;
  }

  /**
   * Directs Gemma to respond exclusively with valid JSON conforming to an expected schema description
   * @param {string} systemInstruction
   * @param {Object|string} userInput
   * @param {string} schemaDescription - Textual description of expected JSON structure
   * @returns {string} Formatted JSON-enforced prompt
   */
  buildJsonPrompt({ systemInstruction, userInput, schemaDescription }) {
    const jsonDirective = `\nCRITICAL: Respond ONLY with valid, raw JSON. Do not include markdown code block markers (\`\`\`json), explanations, or preamble.\nEXPECTED JSON SCHEMA:\n${schemaDescription}`;
    
    return this.buildChatPrompt({
      systemInstruction: `${systemInstruction}\n${jsonDirective}`,
      userInput,
    });
  }

  /**
   * Prepares multimodal payload description for image/audio input analysis
   * @param {Object} params
   * @param {string} params.systemInstruction
   * @param {string} params.mediaType - 'IMAGE' | 'VOICE' | 'AUDIO'
   * @param {string} [params.promptText]
   * @param {Object} [params.metadata]
   * @returns {string}
   */
  buildMultimodalPrompt({ systemInstruction, mediaType, promptText = '', metadata = {} }) {
    const mediaHeader = `[MULTIMODAL INPUT DETECTED: TYPE=${mediaType}]`;
    const combinedInput = `${mediaHeader}\nPROMPT: ${promptText}\nMETADATA: ${JSON.stringify(metadata)}`;

    return this.buildChatPrompt({
      systemInstruction,
      userInput: combinedInput,
    });
  }
}

module.exports = new PromptBuilder();
