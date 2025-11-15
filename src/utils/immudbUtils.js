/**
 * Checks if an error is an ImmuDB "not found" error.
 * @param {Error} err
 * @returns {boolean}
 */
export function isImmuDbNotFoundError(err) {
  return (
    err &&
    typeof err.message === 'string' &&
    err.message.includes('UNKNOWN: tbtree: key not found')
  );
}

/**
 * Helper for sending consistent API responses
 * @param {object} res - Express response object
 * @param {number} status - HTTP status code
 * @param {string} message - Main message
 * @param {object} [data] - Additional fields to include in response
 */
export function responseHelper(res, status = 200, message = 'Success', data = {}) {
  return res.status(status).json({ message, ...data });
}