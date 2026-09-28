// Autentikasi sederhana: aktif hanya jika APP_API_KEY diisi di .env.
module.exports = function authMiddleware(req, res, next) {
  const expected = process.env.APP_API_KEY;
  if (!expected) return next();
  const header = req.get('x-api-key') || (req.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (header === expected) return next();
  return res.status(401).json({ error: 'API key tidak valid atau belum dikirim (header x-api-key).' });
};
