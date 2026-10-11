/**
 * StudyMate Cloudflare Image Generation Utility
 * Uses Cloudflare Workers AI REST API with @cf/black-forest-labs/flux-1-schnell
 */

const { ImageGenError } = require('./geminiImage');

/**
 * Wraps user input into an educational illustration prompt
 */
const buildEducationalPrompt = (studentPrompt) => {
  return `Create a clean educational illustration to explain the following concept: "${studentPrompt.trim()}". Requirements: Clear visual explanation, labelled where useful, no text-heavy output, strictly safe educational content.`;
};

/**
 * Invokes Cloudflare Workers AI flux-1-schnell model via REST API
 * @param {string} prompt - Raw student prompt
 * @param {object} options - Optional overrides (e.g. timeoutMs)
 * @returns {Promise<{ image: { mimeType: string, data: string }, caption: string }>}
 */
const generateCloudflareImage = async (prompt, options = {}) => {
  const accountId = process.env.CF_ACCOUNT_ID;
  const apiToken = process.env.CF_API_TOKEN;

  if (!accountId || !accountId.trim() || !apiToken || !apiToken.trim()) {
    throw new ImageGenError('Image generation is not configured', 'not_configured', 503);
  }

  const timeoutMs = options.timeoutMs || 60000;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  const modelId = '@cf/black-forest-labs/flux-1-schnell';
  const url = `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(
    accountId.trim()
  )}/ai/run/${modelId}`;

  const educationalPrompt = buildEducationalPrompt(prompt);

  const requestBody = {
    prompt: educationalPrompt,
    num_steps: 4,
  };

  let response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiToken.trim()}`,
        'Content-Type': 'application/json',
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

  if (!response.ok) {
    let errorData = {};
    try {
      errorData = await response.json();
    } catch (_) {
      errorData = {};
    }

    const status = response.status;
    const errors = errorData.errors || [];
    const firstMsg = (errors[0]?.message || '').toLowerCase();

    if (status === 429 || firstMsg.includes('quota') || firstMsg.includes('rate limit')) {
      throw new ImageGenError('Image generation quota exceeded. Please try again later.', 'quota', 429);
    }

    if (status === 400 && (firstMsg.includes('safety') || firstMsg.includes('harm') || firstMsg.includes('blocked'))) {
      throw new ImageGenError(
        'Image generation was blocked by safety filters. Only safe educational illustrations are allowed.',
        'safety',
        400
      );
    }

    if (status === 401 || status === 403) {
      throw new ImageGenError(
        'Image generation service is currently unavailable or requires billing permissions.',
        'not_allowed',
        503
      );
    }

    throw new ImageGenError(
      'Image generation service returned an upstream error. Please try again later.',
      'upstream',
      503
    );
  }

  const contentType = response.headers.get('content-type') || '';
  let base64Data = '';
  let mimeType = 'image/jpeg';

  if (contentType.includes('application/json')) {
    const data = await response.json();
    if (data.result && data.result.image) {
      base64Data = data.result.image;
    } else {
      throw new ImageGenError('Image generation failed: model did not return an image.', 'no_image', 502);
    }
  } else {
    const arrayBuffer = await response.arrayBuffer();
    if (!arrayBuffer || arrayBuffer.byteLength === 0) {
      throw new ImageGenError('Image generation failed: model did not return an image.', 'no_image', 502);
    }
    base64Data = Buffer.from(arrayBuffer).toString('base64');
    if (contentType.includes('image/png')) {
      mimeType = 'image/png';
    } else if (contentType.includes('image/webp')) {
      mimeType = 'image/webp';
    }
  }

  const caption = `Educational illustration for: ${prompt.trim()}`.slice(0, 300);

  return {
    image: {
      mimeType,
      data: base64Data,
    },
    caption,
  };
};

module.exports = {
  generateCloudflareImage,
  buildEducationalPrompt,
};
