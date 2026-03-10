const { validationResult } = require('express-validator');

function handleValidationErrors(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    // Format errors into a single message string for frontend compatibility
    const message = errors.array().map(err => err.msg).join(', ');
    return res.status(400).json({ message });
  }
  next();
}

module.exports = handleValidationErrors;

