/**
 * StudyMate Gemini Image Generation Utility
 * Uses direct fetch to the Gemini generateContent API with responseModalities: ["TEXT", "IMAGE"].
 */

class ImageGenError extends Error {
  constructor(message, code, status = 503) {
    super(message);
    this.name = 'ImageGenError';
    this.code = code;
    this.status = status;
  }
}

/**
 * Wraps user input into an educational illustration prompt
 */
const buildEducationalPrompt = (studentPrompt) => {
  return `Create a clean educational illustration to explain the following concept: "${studentPrompt.trim()}". Requirements: Clear visual explanation, labelled where useful, no text-heavy output, no real people, strictly safe educational content.`;
};

/**
 * Invokes Gemini image model using plain fetch
 * @param {string} prompt - Raw student prompt
 * @param {object} options - Optional overrides (e.g. timeoutMs)
 * @returns {Promise<{ image: { mimeType: string, data: string }, caption: string }>}
 */
const generateGeminiImage = async (prompt, options = {}) => {
  // 1. Model name validation - read ONLY from GEMINI_IMAGE_MODEL
  const model = process.env.GEMINI_IMAGE_MODEL;
  if (!model || !model.trim()) {
    throw new ImageGenError('Image generation is not configured', 'not_configured', 503);
  }

  // 2. API Key validation
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'your_gemini_api_key_here') {
    throw new ImageGenError(
      'Ask AI service is unavailable: GEMINI_API_KEY is not configured in server/.env.',
      'no_key',
      503
    );
  }

  const timeoutMs = options.timeoutMs || 60000;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    model.trim()
  )}:generateContent`;

  const educationalPrompt = buildEducationalPrompt(prompt);

  const requestBody = {
    contents: [
      {
        parts: [{ text: educationalPrompt }],
      },
    ],
    generationConfig: {
      responseModalities: ['TEXT', 'IMAGE'],
    },
  };

  let response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError' || controller.signal.aborted) {
      throw new ImageGenError('Image generation timed out after 60 seconds.', 'timeout', 503);
    }
    throw new ImageGenError(
      'Image generation service is temporarily unavailable due to a network error.',
      'network',
      503
    );
  } finally {
    clearTimeout(timeoutId);
  }

  // Parse response
  let data;
  try {
    data = await response.json();
  } catch (_parseErr) {
    data = {};
  }

  // Handle HTTP error statuses
  if (!response.ok) {
    const errorDetails = data.error || {};
    const rawMsg = (errorDetails.message || '').toLowerCase();
    const status = response.status;

    if (status === 404 || rawMsg.includes('not found')) {
      throw new ImageGenError(
        'The configured image generation model is not available. Please verify GEMINI_IMAGE_MODEL.',
        'model',
        503
      );
    }

    if (status === 429 || rawMsg.includes('quota') || rawMsg.includes('resource_exhausted')) {
      throw new ImageGenError(
        'Image generation quota exceeded. Please try again later.',
        'quota',
        429
      );
    }

    if (
      status === 403 ||
      rawMsg.includes('permission') ||
      rawMsg.includes('billing') ||
      rawMsg.includes('billable') ||
      rawMsg.includes('not supported')
    ) {
      throw new ImageGenError(
        'Image generation is not available on this API key or requires billing permissions.',
        'not_allowed',
        503
      );
    }

    if (
      rawMsg.includes('safety') ||
      rawMsg.includes('blocked') ||
      rawMsg.includes('harm') ||
      rawMsg.includes('violat')
    ) {
      throw new ImageGenError(
        'Image generation was blocked by safety filters. Only safe educational illustrations are allowed.',
        'safety',
        400
      );
    }

    throw new ImageGenError(
      'Image generation service returned an upstream error. Please try again later.',
      'upstream',
      503
    );
  }

  // Check prompt-level safety block
  if (data.promptFeedback && data.promptFeedback.blockReason) {
    throw new ImageGenError(
      'Image generation was blocked by safety filters. Only safe educational illustrations are allowed.',
      'safety',
      400
    );
  }

  const candidate = data.candidates && data.candidates[0];
  if (!candidate) {
    throw new ImageGenError('Image generation failed: model did not return an image.', 'no_image', 502);
  }

  // Check candidate-level finish reason
  if (candidate.finishReason === 'SAFETY') {
    throw new ImageGenError(
      'Image generation was blocked by safety filters. Only safe educational illustrations are allowed.',
      'safety',
      400
    );
  }

  const parts = candidate.content && candidate.content.parts ? candidate.content.parts : [];

  // Find first part with inlineData ({ mimeType, data })
  const imagePart = parts.find((p) => p.inlineData && p.inlineData.data);
  if (!imagePart) {
    throw new ImageGenError('Image generation failed: model did not return an image.', 'no_image', 502);
  }

  // Extract caption from joined text parts (max 300 chars)
  const textParts = parts
    .filter((p) => typeof p.text === 'string' && p.text.trim())
    .map((p) => p.text.trim())
    .join(' ');

  const caption = (textParts || `Educational illustration for: ${prompt.trim()}`).slice(0, 300);

  return {
    image: {
      mimeType: imagePart.inlineData.mimeType || 'image/png',
      data: imagePart.inlineData.data,
    },
    caption,
  };
};

module.exports = {
  generateGeminiImage,
  ImageGenError,
  buildEducationalPrompt,
};
