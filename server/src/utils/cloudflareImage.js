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
    steps: 4,
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
    const isTimeout = err.name === 'AbortError' || controller.signal.aborted;
    const errorDetails = [{ code: isTimeout ? 'timeout' : 'network_error', message: err.message }];
    console.error('[ImageGen] cloudflare failed', isTimeout ? 504 : 503, errorDetails);
    if (isTimeout) {
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
    const rawErrors = Array.isArray(errorData?.errors) ? errorData.errors : [];
    const errors =
      rawErrors.length > 0
        ? rawErrors.map((e) => ({
            code: e.code,
            message: typeof e.message === 'string' ? e.message : String(e.message || ''),
          }))
        : [{ code: status, message: response.statusText || 'Unknown error' }];

    console.error('[ImageGen] cloudflare failed', status, errors);

    const firstMsg = (errors[0]?.message || '').toLowerCase();

    if (status === 429 || firstMsg.includes('quota') || firstMsg.includes('rate limit')) {
      throw new ImageGenError('Image generation quota exceeded. Please try again later.', 'quota', 429);
    }

    if (status === 400) {
      if (firstMsg.includes('safety') || firstMsg.includes('harm') || firstMsg.includes('blocked')) {
        throw new ImageGenError(
          'Image generation was blocked by safety filters. Only safe educational illustrations are allowed.',
          'safety',
          400
        );
      }
      throw new ImageGenError(
        'Image generation request was invalid. Please try a different prompt.',
        'bad_request',
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

    if (status === 404 || firstMsg.includes('not found')) {
      throw new ImageGenError(
        'The configured image generation model is not available.',
        'model',
        503
      );
    }

    throw new ImageGenError(
      'Image generation service returned an upstream error. Please try again later.',
      'upstream',
      503
    );
  }

  let data;
  try {
    data = await response.json();
  } catch (parseErr) {
    console.error('[ImageGen] cloudflare failed', response.status, [
      { code: 'json_parse_error', message: parseErr.message },
    ]);
    throw new ImageGenError('Image generation failed: model did not return a valid response.', 'upstream', 502);
  }

  const base64Image = data?.result?.image;
  if (!base64Image || typeof base64Image !== 'string' || !base64Image.trim()) {
    console.error('[ImageGen] cloudflare failed', response.status, [
      { code: 'empty_image', message: 'Result image is empty or missing' },
    ]);
    throw new ImageGenError('Image generation failed: model did not return an image.', 'no_image', 502);
  }

  const imageBuffer = Buffer.from(base64Image.trim(), 'base64');
  let mimeType = 'image/jpeg';

  if (
    imageBuffer.length >= 4 &&
    imageBuffer[0] === 0x89 &&
    imageBuffer[1] === 0x50 &&
    imageBuffer[2] === 0x4e &&
    imageBuffer[3] === 0x47
  ) {
    mimeType = 'image/png';
  } else if (
    imageBuffer.length >= 3 &&
    imageBuffer[0] === 0xff &&
    imageBuffer[1] === 0xd8 &&
    imageBuffer[2] === 0xff
  ) {
    mimeType = 'image/jpeg';
  }

  const caption = `Educational illustration for: ${prompt.trim()}`.slice(0, 300);

  return {
    image: {
      mimeType,
      data: base64Image.trim(),
    },
    caption,
  };
};

module.exports = {
  generateCloudflareImage,
  buildEducationalPrompt,
};
