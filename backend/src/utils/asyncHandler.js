/**
 * Wraps async Express route handlers to automatically catch errors
 * and forward them to the global error handler via next().
 */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = asyncHandler;
