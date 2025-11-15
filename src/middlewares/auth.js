import { responseHelper } from '../utils/immudbUtils.js';

export default function (req, res, next) {
  const apikey = req.headers['x-api-key'];
  if (!apikey || apikey !== process.env.API_KEY_SECRET) {
    return responseHelper(res, 401, 'Unauthorized');
  }
  req.user = { email: req.header('x-user-email') || 'unknown' };
  next();
}