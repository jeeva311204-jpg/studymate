const pdfParse = require('pdf-parse');

/**
 * Extracts and cleans raw text from an uploaded file buffer or string
 * @param {Buffer} buffer - File buffer
 * @param {string} mimetype - MIME type or extension
 * @returns {Promise<string>} Cleaned extracted text
 */
const extractTextFromFile = async (buffer, mimetype, originalname = '') => {
  const isPdf =
    mimetype === 'application/pdf' ||
    (originalname && originalname.toLowerCase().endsWith('.pdf'));

  let extractedText = '';

  if (isPdf) {
    try {
      const pdfData = await pdfParse(buffer);
      extractedText = pdfData.text || '';
    } catch (err) {
      console.error('[TextExtractor] PDF parse error:', err.message);
      throw new Error(`Failed to extract text from PDF: ${err.message}`);
    }
  } else {
    // Plain text or markdown
    extractedText = buffer.toString('utf-8');
  }

  // Clean and normalize text
  const cleaned = extractedText
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\t/g, ' ')
    .replace(/[ \u00A0]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  if (!cleaned || cleaned.length < 10) {
    if (isPdf) {
      const err = new Error('This PDF looks scanned. Please upload a text-based PDF or paste the text.');
      err.statusCode = 400;
      throw err;
    }
    const err = new Error('The uploaded document appears to be empty or does not contain readable text.');
    err.statusCode = 400;
    throw err;
  }

  return cleaned;
};

module.exports = {
  extractTextFromFile,
};
