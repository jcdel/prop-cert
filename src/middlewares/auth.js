export default function (req, res, next) {
  const apikey = req.headers['x-api-key'];
  if (!apikey || apikey !== process.env.API_KEY_SECRET) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  // Attach user info in env for simplicity/testing
  req.user = { email: req.header('x-user-email') || 'unknown' };
  next();
}