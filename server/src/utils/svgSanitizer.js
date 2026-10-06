const sanitizeHtml = require('sanitize-html');

const MAX_SVG_BYTES = 100 * 1024; // 100 KB limit

/**
 * Sanitizes and validates an SVG string.
 *
 * @param {string} rawSvg - The raw SVG input string
 * @returns {{ svg: string|null, isOversized: boolean }}
 */
function sanitizeSvg(rawSvg) {
  if (!rawSvg || typeof rawSvg !== 'string') {
    return { svg: null, isOversized: false };
  }

  // Check 100 KB size limit on raw input
  const byteLength = Buffer.byteLength(rawSvg, 'utf8');
  if (byteLength > MAX_SVG_BYTES) {
    return { svg: null, isOversized: true };
  }

  // Extract <svg ... </svg>
  const svgMatch = rawSvg.match(/<svg[\s\S]*<\/svg>/i);
  if (!svgMatch) {
    return { svg: null, isOversized: false };
  }

  let svgContent = svgMatch[0];

  // Strip <foreignObject> tags and their inner content
  svgContent = svgContent.replace(/<foreignObject[\s\S]*?<\/foreignObject>/gi, '');
  svgContent = svgContent.replace(/<foreignObject[^>]*\/>/gi, '');

  // Strip <iframe> tags and their inner content
  svgContent = svgContent.replace(/<iframe[\s\S]*?<\/iframe>/gi, '');
  svgContent = svgContent.replace(/<iframe[^>]*\/>/gi, '');

  // Remove <style> tags that contain @import, external url(...) references, or javascript:
  svgContent = svgContent.replace(/<style[^>]*>([\s\S]*?)<\/style>/gi, (match, cssBody) => {
    if (
      /@import/i.test(cssBody) ||
      /url\s*\(\s*['"]?(?:https?:|\/\/|javascript:|data:)/i.test(cssBody)
    ) {
      return '';
    }
    return match;
  });

  const sanitized = sanitizeHtml(svgContent, {
    allowedTags: [
      'svg',
      'g',
      'path',
      'rect',
      'circle',
      'ellipse',
      'line',
      'polyline',
      'polygon',
      'text',
      'tspan',
      'defs',
      'marker',
      'linearGradient',
      'radialGradient',
      'stop',
      'pattern',
      'mask',
      'clipPath',
      'title',
      'desc',
      'style',
      'use',
      'a',
    ],
    nonTextTags: ['style', 'script', 'textarea', 'option', 'noscript', 'foreignObject', 'iframe'],
    disallowedTagsMode: 'discard',
    allowVulnerableTags: true,
    allowedAttributes: {
      '*': [
        'id',
        'class',
        'style',
        'viewBox',
        'viewbox',
        'xmlns',
        'xmlns:xlink',
        'version',
        'width',
        'height',
        'x',
        'y',
        'dx',
        'dy',
        'x1',
        'y1',
        'x2',
        'y2',
        'cx',
        'cy',
        'r',
        'rx',
        'ry',
        'd',
        'points',
        'fill',
        'stroke',
        'stroke-width',
        'stroke-linecap',
        'stroke-linejoin',
        'stroke-dasharray',
        'opacity',
        'fill-opacity',
        'stroke-opacity',
        'transform',
        'text-anchor',
        'font-family',
        'font-size',
        'font-weight',
        'dominant-baseline',
        'offset',
        'stop-color',
        'stop-opacity',
        'marker-start',
        'marker-mid',
        'marker-end',
        'markerWidth',
        'markerHeight',
        'refX',
        'refY',
        'orient',
        'gradientUnits',
        'patternUnits',
        'clip-path',
        'mask',
        'href',
        'xlink:href',
      ],
    },
    allowedSchemes: [], // No schemes allowed
    transformTags: {
      '*': (tagName, attribs) => {
        // Strip any event handler attributes (on*)
        for (const attr of Object.keys(attribs)) {
          if (attr.toLowerCase().startsWith('on')) {
            delete attribs[attr];
          }
        }

        // href and xlink:href must be strictly local fragment references starting with '#'
        if (attribs.href) {
          const val = attribs.href.trim();
          if (!val.startsWith('#') || val.toLowerCase().startsWith('javascript:')) {
            delete attribs.href;
          }
        }

        if (attribs['xlink:href']) {
          const val = attribs['xlink:href'].trim();
          if (!val.startsWith('#') || val.toLowerCase().startsWith('javascript:')) {
            delete attribs['xlink:href'];
          }
        }

        return { tagName, attribs };
      },
    },
  });

  // Verify sanitized output is still a valid <svg> block
  const finalMatch = sanitized.match(/<svg[\s\S]*<\/svg>/i);
  if (!finalMatch) {
    return { svg: null, isOversized: false };
  }

  const finalSvg = finalMatch[0].trim();

  // Final check on sanitized byte length
  if (Buffer.byteLength(finalSvg, 'utf8') > MAX_SVG_BYTES) {
    return { svg: null, isOversized: true };
  }

  return { svg: finalSvg, isOversized: false };
}

module.exports = {
  sanitizeSvg,
  MAX_SVG_BYTES,
};
