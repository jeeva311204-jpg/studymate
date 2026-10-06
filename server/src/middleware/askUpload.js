const multer = require('multer');

// Memory storage guarantees that images are kept purely in RAM and never written to disk
const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: {
    fileSize: 4 * 1024 * 1024, // 4 MB limit
  },
});

/**
 * Middleware wrapper for single 'image' upload on POST /api/ask.
 * Supports multipart/form-data as well as JSON payloads.
 * Returns 413 with a clear message when file exceeds 4 MB.
 */
const askImageUpload = (req, res, next) => {
  upload.single('image')(req, res, (err) => {
    if (err) {
      if (req.readable) {
        req.resume();
      }
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({
          error: true,
          message: 'Image size exceeds the 4 MB limit. Please upload an image under 4 MB.',
        });
      }
      return res.status(400).json({
        error: true,
        message: err.message || 'Failed to upload image.',
      });
    }
    next();
  });
};

module.exports = askImageUpload;
