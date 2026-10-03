/**
 * Application-wide configuration constants
 */

// Maximum characters of study notes/PDF text sent to Gemini for analysis
// Can be customized via MAX_NOTE_CHARACTERS environment variable (default: 100,000 characters)
const MAX_NOTE_CHARACTERS = parseInt(process.env.MAX_NOTE_CHARACTERS, 10) || 100000;

module.exports = {
  MAX_NOTE_CHARACTERS,
};
