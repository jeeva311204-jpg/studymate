/**
 * Cleans potential markdown code fences from AI response string
 */
const cleanJsonString = (raw) => {
  if (!raw || typeof raw !== 'string') return '';
  let str = raw.trim();

  // Strip ```json ... ``` or ``` ... ```
  if (str.startsWith('```')) {
    const lines = str.split('\n');
    // Drop first line if it's ``` or ```json
    if (lines[0].startsWith('```')) {
      lines.shift();
    }
    // Drop last line if it's ```
    if (lines.length > 0 && lines[lines.length - 1].trim() === '```') {
      lines.pop();
    }
    str = lines.join('\n').trim();
  }

  // Find first [ or { to determine if root is an object or an array
  const firstBrace = str.indexOf('{');
  const firstBracket = str.indexOf('[');
  let startIdx = -1;
  let endIdx = -1;

  if (firstBrace !== -1 && firstBracket !== -1) {
    if (firstBrace < firstBracket) {
      startIdx = firstBrace;
      endIdx = str.lastIndexOf('}');
    } else {
      startIdx = firstBracket;
      endIdx = str.lastIndexOf(']');
    }
  } else if (firstBrace !== -1) {
    startIdx = firstBrace;
    endIdx = str.lastIndexOf('}');
  } else if (firstBracket !== -1) {
    startIdx = firstBracket;
    endIdx = str.lastIndexOf(']');
  }

  if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
    str = str.substring(startIdx, endIdx + 1);
  }

  return str;
};

/**
 * Executes an AI generation call with strict JSON validation and exactly 1 automatic retry
 * @param {Function} generatorFn - Async function (correctionPrompt?: string) => Promise<string>
 * @param {Function} validatorFn - Function (parsedJson: any) => { valid: boolean, error?: string, data?: any }
 * @returns {Promise<any>} Validated parsed JSON object/array
 */
const executeWithRetry = async (generatorFn, validatorFn) => {
  let rawResponse = '';
  let parseError = '';

  // Attempt 1: Initial Generation
  try {
    rawResponse = await generatorFn();
    const cleaned = cleanJsonString(rawResponse);
    const parsed = JSON.parse(cleaned);
    const validation = validatorFn(parsed);

    if (validation.valid) {
      return validation.data !== undefined ? validation.data : parsed;
    }
    parseError = validation.error || 'Failed schema validation';
  } catch (err) {
    if (err.status === 404 || err.message?.includes('not found') || err.message?.includes('not configured')) {
      throw err;
    }
    parseError = err.message || 'Malformed JSON syntax';
  }

  console.warn(`[AIValidator] Attempt 1 failed with error: "${parseError}". Initiating retry attempt...`);

  // Attempt 2: Corrective Retry Prompt
  const correctionPrompt = `CORRECTION REQUIRED: Your previous response was invalid JSON or did not match the required schema. Error: "${parseError}". You MUST output ONLY valid JSON without markdown wrapping or conversational text.`;

  try {
    const retryResponse = await generatorFn(correctionPrompt);
    const retryCleaned = cleanJsonString(retryResponse);
    const retryParsed = JSON.parse(retryCleaned);
    const retryValidation = validatorFn(retryParsed);

    if (retryValidation.valid) {
      console.log('[AIValidator] Retry attempt succeeded!');
      return retryValidation.data !== undefined ? retryValidation.data : retryParsed;
    }

    throw new Error(`AI response failed validation after retry: ${retryValidation.error || 'Invalid structure'}`);
  } catch (err) {
    console.error('[AIValidator] Retry attempt also failed:', err.message);
    throw new Error(`Failed to generate valid structured data: ${err.message}`);
  }
};

module.exports = {
  cleanJsonString,
  executeWithRetry,
};
