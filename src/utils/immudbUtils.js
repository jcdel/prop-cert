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