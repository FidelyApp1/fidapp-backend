const jwt = require('jsonwebtoken')

const adminMiddleware = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1]
  if (!token) return res.status(401).json({ error: 'Token manquant' })

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    if (!decoded.isAdmin) return res.status(403).json({ error: 'Accès refusé' })
    req.adminId = decoded.adminId
    next()
  } catch {
    return res.status(401).json({ error: 'Token invalide' })
  }
}

module.exports = adminMiddleware