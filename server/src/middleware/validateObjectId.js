const mongoose = require('mongoose');

/**
 * Middleware to validate MongoDB ObjectId parameters (:id and :noteId).
 * Returns 400 with { message: 'Invalid id' } if any present param is invalid.
 */
const validateObjectId = (req, res, next) => {
  const { id, noteId } = req.params;

  if (id !== undefined && !mongoose.isValidObjectId(id)) {
    return res.status(400).json({ message: 'Invalid id' });
  }

  if (noteId !== undefined && !mongoose.isValidObjectId(noteId)) {
    return res.status(400).json({ message: 'Invalid id' });
  }

  next();
};

module.exports = validateObjectId;
