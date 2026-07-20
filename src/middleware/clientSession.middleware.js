const jwt = require('jsonwebtoken')

const clientSessionMiddleware = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1]

  if (!token) {
    return res.status(401).json({
      error: 'session_required',
      message: 'Scannez un QR code pour accéder à votre profil.'
    })
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] })

    if (decoded.type !== 'client_session' || !decoded.phone) {
      return res.status(401).json({ error: 'Session invalide' })
    }

    req.clientPhone = decoded.phone
    next()
  } catch (err) {
    return res.status(401).json({
      error: 'session_expired',
      message: 'Votre session a expiré — scannez à nouveau un QR code.'
    })
  }
}

module.exports = clientSessionMiddleware
