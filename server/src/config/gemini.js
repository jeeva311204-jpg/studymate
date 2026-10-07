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
    throw new Error('GEMINI_API_KEY is not configured in server/.env. Please provide a valid key.');
  }

  const modelName = process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite';
  return client.getGenerativeModel({
    model: modelName,
    ...options,
  });
};

/**
 * Executes content generation with automatic multi-model failover on 503 (demand spike) or 429
 * @param {string} prompt - Prompt to send
 * @param {object} options - Generation options (e.g. responseMimeType)
 * @returns {Promise<string>} Text response
 */
const generateWithModelFallback = async (prompt, options = {}) => {
  const client = getGeminiClient();
  if (!client) {
    throw new Error('GEMINI_API_KEY is not configured in server/.env.');
  }

  const preferredModel = process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite';
  const models = [preferredModel, ...CANDIDATE_MODELS.filter((m) => m !== preferredModel)];

  const triedModels = [];

  for (const modelName of models) {
    triedModels.push(modelName);

    // Retry transient spikes before switching models
    for (let attempt = 1; attempt <= 2; attempt++) {
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

        if (isModelNotFoundError(err)) {
          const triedList = triedModels.join(', ');
          const notFoundError = new Error(
            `Gemini model error: The requested model "${preferredModel}" was not found or is unsupported. Attempted models: [${triedList}]. Please verify GEMINI_MODEL in server/.env.`
          );
          notFoundError.status = 404;
          throw notFoundError;
        }

        const isTransient =
          err.message?.includes('503') ||
          err.message?.includes('429') ||
          err.message?.includes('high demand') ||
          err.message?.includes('Service Unavailable') ||
          err.message?.includes('temporarily') ||
          err.message?.includes('quota');

        if (isTransient) {
          const waitMs = attempt * 1500;
          console.warn(`[Gemini Fallback] Model ${modelName} encountered 503 transient spike (attempt ${attempt}/2). Waiting ${waitMs}ms...`);
          await new Promise((res) => setTimeout(res, waitMs));
          continue;
        }

        throw err;
      }
    }
  }

  const triedList = triedModels.join(', ');

  // If preferred model was not found or all candidates were not found, return clean error listing tried models
  if (preferredModelNotFound || isModelNotFoundError(lastError)) {
    const notFoundError = new Error(
      `Gemini model error: The requested model "${preferredModel}" was not found or is unsupported. Attempted models: [${triedList}]. Please verify GEMINI_MODEL in server/.env.`
    );
    notFoundError.status = 404;
    throw notFoundError;
  }

  if (lastError && (lastError.message?.includes('503') || lastError.message?.includes('high demand'))) {
    const busyError = new Error(
      `Gemini AI servers are currently experiencing temporary high demand. Attempted models: [${triedList}]. Please try again in a few moments.`
    );
    busyError.status = 503;
    throw busyError;
  }

  const cleanError = new Error(
    `Gemini AI generation failed. Attempted models: [${triedList}]. Please verify GEMINI_MODEL in server/.env.`
  );
  cleanError.status = lastError?.status || 500;
  throw cleanError;
};

module.exports = {
  getGeminiClient,
  getGenerativeModel,
  generateWithModelFallback,
  isModelNotFoundError,
};

