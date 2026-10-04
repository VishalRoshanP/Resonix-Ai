/**
 * Response Parser for RESONIX AI Outputs
 * Handles text cleaning, markdown code-block stripping, structured JSON extraction, and fallback mechanisms.
 * 
 * v2.0.0 — Added:
 * - Trailing comma removal
 * - Truncated JSON repair (auto-close unmatched braces/brackets)
 * - Nested JSON extraction
 * - Better diagnostic logging on parse failures
 */

const logger = require('../../utils/logger');

class ResponseParser {
  /**
   * Cleans raw text response from model
   * @param {Array|Object|string} responsePayload
   * @returns {string} Raw extracted output text
   */
  extractText(responsePayload) {
    if (!responsePayload) return '';

    if (typeof responsePayload === 'string') {
      return responsePayload.trim();
    }

    if (Array.isArray(responsePayload) && responsePayload.length > 0) {
      const first = responsePayload[0];
      return first.generated_text || first.text || JSON.stringify(first);
    }

    if (typeof responsePayload === 'object') {
      return responsePayload.generated_text || responsePayload.text || JSON.stringify(responsePayload);
    }

    return String(responsePayload);
  }

  /**
   * Attempts to repair common JSON issues from LLM output
   * @private
   * @param {string} text - Raw text that might be malformed JSON
   * @returns {string} Repaired text
   */
  _repairJson(text) {
    let repaired = text;

    // Remove trailing commas before } or ]
    repaired = repaired.replace(/,\s*([\]}])/g, '$1');

    // Remove any text before the first { or [
    const firstBrace = repaired.indexOf('{');
    const firstBracket = repaired.indexOf('[');
    let startIdx = -1;
    if (firstBrace >= 0 && firstBracket >= 0) {
      startIdx = Math.min(firstBrace, firstBracket);
    } else if (firstBrace >= 0) {
      startIdx = firstBrace;
    } else if (firstBracket >= 0) {
      startIdx = firstBracket;
    }

    if (startIdx > 0) {
      repaired = repaired.substring(startIdx);
    }

    // Remove any text after the last matching } or ]
    const lastBrace = repaired.lastIndexOf('}');
    const lastBracket = repaired.lastIndexOf(']');
    const endIdx = Math.max(lastBrace, lastBracket);
    if (endIdx >= 0 && endIdx < repaired.length - 1) {
      repaired = repaired.substring(0, endIdx + 1);
    }

    // Try to close truncated JSON by counting unmatched braces/brackets
    let braceCount = 0;
    let bracketCount = 0;
    let inString = false;
    let escape = false;

    for (let i = 0; i < repaired.length; i++) {
      const ch = repaired[i];
      if (escape) {
        escape = false;
        continue;
      }
      if (ch === '\\') {
        escape = true;
        continue;
      }
      if (ch === '"') {
        inString = !inString;
        continue;
      }
      if (!inString) {
        if (ch === '{') braceCount++;
        else if (ch === '}') braceCount--;
        else if (ch === '[') bracketCount++;
        else if (ch === ']') bracketCount--;
      }
    }

    // If we're inside a string, close it
    if (inString) {
      repaired += '"';
    }

    // Close unmatched brackets and braces
    while (bracketCount > 0) {
      repaired += ']';
      bracketCount--;
    }
    while (braceCount > 0) {
      repaired += '}';
      braceCount--;
    }

    // Remove trailing commas again after repair
    repaired = repaired.replace(/,\s*([\]}])/g, '$1');

    return repaired;
  }

  /**
   * Parses JSON out of model response, with multi-stage repair pipeline
   * @param {Array|Object|string} responsePayload
   * @param {Object} [fallback={}] Fallback object if parsing fails
   * @returns {Object} Parsed JSON object
   */
  parseJson(responsePayload, fallback = {}) {
    const rawText = this.extractText(responsePayload);

    if (!rawText || rawText.length === 0) {
      logger.warn('[ResponseParser] Empty response from Gemma model. Using fallback.');
      return fallback;
    }

    // Stage 1: Direct JSON parse attempt
    try {
      return JSON.parse(rawText);
    } catch (_) {}

    // Stage 2A: Extract markdown codeblock (```json { ... } ```)
    const codeBlockMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    if (codeBlockMatch && codeBlockMatch[1]) {
      const content = codeBlockMatch[1].trim();
      try {
        return JSON.parse(content);
      } catch (_) {
        try {
          return JSON.parse(this._repairJson(content));
        } catch (_) {}
      }
    }

    // Stage 2B: Extract last JSON object in rawText (for chain-of-thought outputs)
    const lastBraceStart = rawText.lastIndexOf('{');
    const lastBraceEnd = rawText.lastIndexOf('}');
    if (lastBraceStart >= 0 && lastBraceEnd > lastBraceStart) {
      try {
        const candidate = rawText.substring(lastBraceStart, lastBraceEnd + 1);
        return JSON.parse(candidate);
      } catch (_) {
        try {
          const repaired = this._repairJson(rawText.substring(lastBraceStart, lastBraceEnd + 1));
          return JSON.parse(repaired);
        } catch (_) {}
      }
    }

    // Stage 3: Extract and parse first JSON object/array via regex
    try {
      const jsonMatch = rawText.match(/([\{\[])[\s\S]*([\}\]])/);
      if (jsonMatch) {
        const extracted = rawText.substring(
          rawText.indexOf(jsonMatch[1]),
          rawText.lastIndexOf(jsonMatch[2]) + 1
        );
        return JSON.parse(extracted);
      }
    } catch (_) {}

    // Stage 4: Repair malformed JSON (trailing commas, truncated output, unmatched braces)
    try {
      const repaired = this._repairJson(rawText);
      return JSON.parse(repaired);
    } catch (_) {}

    // Stage 5: Strip markdown fences + repair
    try {
      const cleanedAndRepaired = this._repairJson(
        rawText.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim()
      );
      return JSON.parse(cleanedAndRepaired);
    } catch (_) {}

    // Stage 6: Key-Value Bullet Point & Loose Schema Extractor
    try {
      if (
        rawText.includes('dominantHazard') ||
        rawText.includes('category') ||
        rawText.includes('detectedCategory') ||
        rawText.includes('disasterCategory') ||
        rawText.includes('detectedLanguage') ||
        rawText.includes('englishTranslation') ||
        rawText.includes('related')
      ) {
        const extractedObj = {};

        const relMatch = rawText.match(/`?related`?\s*:\s*(true|false)/i);
        if (relMatch) extractedObj.related = relMatch[1].toLowerCase() === 'true';

        const domMatch = rawText.match(/`?dominantHazard`?\s*:\s*["'`]?([A-Z_]+)["'`]?/i);
        if (domMatch) extractedObj.dominantHazard = domMatch[1].toUpperCase();

        const catMatch = rawText.match(/`?(?:detectedCategory|category|disasterCategory)`?\s*:\s*["'`]?([A-Z_]+)["'`]?/i);
        if (catMatch) {
          extractedObj.category = catMatch[1].toUpperCase();
          extractedObj.detectedCategory = catMatch[1].toUpperCase();
          extractedObj.disasterCategory = catMatch[1].toUpperCase();
        }

        const citizenCatMatch = rawText.match(/`?(?:citizenSelectedCategory|selectedCategory)`?\s*:\s*["'`]?([A-Z_]+)["'`]?/i);
        if (citizenCatMatch) {
          extractedObj.citizenSelectedCategory = citizenCatMatch[1].toUpperCase();
          extractedObj.selectedCategory = citizenCatMatch[1].toUpperCase();
        }

        const sevMatch = rawText.match(/`?severity`?\s*:\s*["'`]?([A-Z_]+)["'`]?/i);
        if (sevMatch) extractedObj.severity = sevMatch[1].toUpperCase();

        const prioMatch = rawText.match(/`?priority`?\s*:\s*["'`]?([A-Z_]+)["'`]?/i);
        if (prioMatch) extractedObj.priority = prioMatch[1].toUpperCase();

        const confMatch = rawText.match(/`?confidence(?:Score)?`?\s*:\s*([0-9.]+)/i);
        if (confMatch) {
          extractedObj.confidenceScore = parseFloat(confMatch[1]);
          extractedObj.confidence = parseFloat(confMatch[1]);
        }

        const langMatch = rawText.match(/`?(?:detectedLanguage|language)`?\s*:\s*["']?([A-Za-z]+)["']?/i);
        if (langMatch) extractedObj.detectedLanguage = langMatch[1];

        const codeMatch = rawText.match(/`?(?:languageCode|detectedLanguageCode)`?\s*:\s*["']?([a-z]{2}(?:-[A-Z]{2})?)["']?/i);
        if (codeMatch) extractedObj.languageCode = codeMatch[1];

        const nativeMatch = rawText.match(/`?nativeScriptTranscript`?\s*:\s*["']([^"']+)["']/i);
        if (nativeMatch) {
          extractedObj.nativeScriptTranscript = nativeMatch[1];
          extractedObj.nativeScriptAvailable = true;
        }

        const transMatch = rawText.match(/`?(?:englishTranslation|translatedTranscript)`?\s*:\s*["']([^"']+)["']/i);
        if (transMatch) extractedObj.englishTranslation = transMatch[1];

        const normMatch = rawText.match(/`?(?:normalizedMeaning|meaning)`?\s*:\s*["']([^"']+)["']/i);
        if (normMatch) extractedObj.normalizedMeaning = normMatch[1];

        const sumMatch = rawText.match(/`?summary`?\s*:\s*["']([^"']+)["']/i);
        if (sumMatch) extractedObj.summary = sumMatch[1];

        const reasonMatch = rawText.match(/`?(?:riskReason|reason|reasoningExplanation)`?\s*:\s*["']([^"']+)["']/i);
        if (reasonMatch) {
          extractedObj.reason = reasonMatch[1];
          extractedObj.riskReason = reasonMatch[1];
        }

        const contraMatch = rawText.match(/`?(?:categoryConflict|contradictionDetected)`?\s*:\s*(true|false)/i);
        if (contraMatch) {
          extractedObj.categoryConflict = contraMatch[1].toLowerCase() === 'true';
          extractedObj.contradictionDetected = extractedObj.categoryConflict;
        }

        const reviewMatch = rawText.match(/`?needsReview`?\s*:\s*(true|false)/i);
        if (reviewMatch) extractedObj.needsReview = reviewMatch[1].toLowerCase() === 'true';

        const basisMatch = rawText.match(/`?evidenceBasis`?\s*:\s*["']?([A-Z_]+)["']?/i);
        if (basisMatch) extractedObj.evidenceBasis = basisMatch[1];

        const trapMatch = rawText.match(/`?trapped`?\s*:\s*(true|false)/i);
        if (trapMatch) extractedObj.trapped = trapMatch[1].toLowerCase() === 'true';

        const victimsMatch = rawText.match(/`?(?:reportedAffectedPeople|affected_people_estimate|peopleAffected)`?\s*:\s*([0-9]+)/i);
        if (victimsMatch) extractedObj.reportedAffectedPeople = parseInt(victimsMatch[1], 10);

        const evMatch = rawText.match(/`?(?:keyEvidence|evidence)`?\s*:\s*\[([^\]]+)\]/i);
        if (evMatch) {
          extractedObj.evidence = evMatch[1].split(',').map((s) => s.replace(/["'`]/g, '').trim()).filter(Boolean);
          extractedObj.keyEvidence = extractedObj.evidence;
        }

        const unkMatch = rawText.match(/`?unknowns`?\s*:\s*\[([^\]]+)\]/i);
        if (unkMatch) {
          extractedObj.unknowns = unkMatch[1].split(',').map((s) => s.replace(/["'`]/g, '').trim()).filter(Boolean);
        }

        if (extractedObj.category || extractedObj.detectedCategory || extractedObj.dominantHazard || extractedObj.detectedLanguage || extractedObj.related !== undefined) {
          logger.info('[ResponseParser] Successfully extracted structured emergency fields from model output.');
          return extractedObj;
        }
      }
    } catch (_) {}

    // All parse attempts failed
    logger.warn('[ResponseParser] All JSON parse attempts failed for Gemma output. Using fallback.', {
      rawTextLength: rawText.length,
      rawTextPreview: rawText.substring(0, 200),
    });

    return fallback;
  }

  /**
   * Sanitizes streaming token chunks into uniform text strings
   * @param {string|Object} chunk
   * @returns {string} Clean token text
   */
  parseStreamChunk(chunk) {
    if (typeof chunk === 'string') return chunk;
    if (chunk?.token?.text) return chunk.token.text;
    if (chunk?.generated_text) return chunk.generated_text;
    return JSON.stringify(chunk);
  }
}

module.exports = new ResponseParser();
