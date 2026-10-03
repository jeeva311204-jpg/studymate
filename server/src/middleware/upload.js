const multer = require('multer');

// Store files in memory buffer for instant processing without disk clutter
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  const allowedMimeTypes = [
    'application/pdf',
    'text/plain',
    'text/markdown',
  ];

  const allowedExtensions = ['.pdf', '.txt', '.md'];
  const ext = file.originalname.toLowerCase().slice(file.originalname.lastIndexOf('.'));

  if (allowedMimeTypes.includes(file.mimetype) || allowedExtensions.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file format. Only PDF and TXT files are supported.'), false);
  }
};

const upload = multer({
  storage,
  limits: {
    fileSize: 15 * 1024 * 1024, // 15MB max
  },
  fileFilter,
});

module.exports = upload;
