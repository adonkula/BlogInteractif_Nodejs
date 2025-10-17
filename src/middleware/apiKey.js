export function requireAdmin(req, res, next) {
  const headerKey = req.get('x-api-key');
  const expected = process.env.ADMIN_API_KEY;
  if (!expected || headerKey !== expected) {
    return res.status(401).json({ error: 'Unauthorized: invalid or missing x-api-key' });
  }
  next();
}
