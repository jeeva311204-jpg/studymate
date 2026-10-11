const { GoogleGenerativeAI } = require('@google/generative-ai');

let genAIInstance = null;

const CANDIDATE_MODELS = [
  'gemini-3.5-flash-lite',
  'gemini-flash-lite-latest',
  'gemini-3.1-flash-lite',
  'gemini-3.5-flash',
  'gemini-3.6-flash',
  'gemini-3-flash-preview',
  'gemini-3.7-flash',
];

const isModelNotFoundError = (err) => {
  if (!err) return false;
  const msg = (err.message || '').toLowerCase();
  const status = err.status || (err.response && err.response.status);
  return (
    status === 404 ||
    msg.includes('not found') ||
    msg.includes('model not found') ||
    msg.includes('is not found') ||
    msg.includes('404') ||
    (status === 400 && msg.includes('not supported for generatecontent'))
  );
};

const getGeminiClient = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'your_gemini_api_key_here') {
    return null;
  }
  if (!genAIInstance) {
    genAIInstance = new GoogleGenerativeAI(apiKey);
  }
  return genAIInstance;
};

const getGenerativeModel = (options = {}) => {
  const client = getGeminiClient();
  if (!client) {
    throw new Error('AI service is not configured. Please contact the administrator.');
  }

  const modelName = process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite';
  return client.getGenerativeModel({
    model: modelName,
    ...options,
  });
};

/**
 * Executes content generation with automatic multi-model failover on 503 (demand spike) or 429
 * Limited to at most 3 candidate models and ~10s total timeout.
 * Logs real errors server-side and throws a generic user-safe error.
 * @param {string|Array} prompt - Prompt to send
 * @param {object} options - Generation options (e.g. responseMimeType)
 * @returns {Promise<string>} Text response
 */
const generateWithModelFallback = async (prompt, options = {}) => {
  const client = getGeminiClient();
  if (!client) {
    throw new Error('AI service is not configured. Please contact the administrator.');
  }

  const preferredModel = process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite';
  const models = [preferredModel, ...CANDIDATE_MODELS.filter((m) => m !== preferredModel)].slice(0, 3);

  let lastError = null;
  let preferredModelNotFound = false;
  const startTime = Date.now();
  const TOTAL_TIMEOUT_MS = 10000;

  for (const modelName of models) {
    if (Date.now() - startTime >= TOTAL_TIMEOUT_MS) {
      break;
    }

    try {
      const model = client.getGenerativeModel({
        model: modelName,
        ...options,
      });

      const result = await model.generateContent(prompt);
      const response = await result.response;
      return response.text();
    } catch (err) {
      lastError = err;
      console.error(`[Gemini Fallback] Model ${modelName} encountered error:`, err.message);

      if (isModelNotFoundError(err)) {
        if (modelName === preferredModel) {
          preferredModelNotFound = true;
        }
        continue;
      }

      const isTransient =
        err.message?.includes('503') ||
        err.message?.includes('429') ||
        err.message?.includes('high demand') ||
        err.message?.includes('Service Unavailable') ||
        err.message?.includes('temporarily') ||
        err.message?.includes('quota');

      if (isTransient) {
        const remainingTime = TOTAL_TIMEOUT_MS - (Date.now() - startTime);
        if (remainingTime > 1500) {
          console.warn(`[Gemini Fallback] Model ${modelName} transient spike. Waiting 1000ms...`);
          await new Promise((res) => setTimeout(res, 1000));
        }
        continue;
      }

      break;
    }
  }

  console.error('[Gemini Fallback] All fallback attempts exhausted. Real error details:', lastError);

  const userSafeError = new Error('AI is busy, please try again in a minute.');
  userSafeError.status = lastError?.status || (preferredModelNotFound ? 404 : 503);
  throw userSafeError;
};

module.exports = {
  getGeminiClient,
  getGenerativeModel,
  generateWithModelFallback,
  isModelNotFoundError,
};

