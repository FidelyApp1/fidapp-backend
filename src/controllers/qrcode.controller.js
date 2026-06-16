const prisma = require('../lib/prisma')
const { v4: uuidv4 } = require('uuid')
const QRCode = require('qrcode')
const jwt = require('jsonwebtoken')

const generateQrToken = (restaurantId) => {
  return jwt.sign(
    { restaurantId, type: 'qr_checkin' },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  )
}

const generateQrImage = async (token) => {
  const scanUrl = `https://fidapp-client.vercel.app/scan/${token}`
  return await QRCode.toDataURL(scanUrl, {
    width: 400,
    margin: 2,
    color: { dark: '#1a1a1a', light: '#ffffff' }
  })
}

const generateQrCode = async (req, res) => {
  const restaurantId = req.restaurantId

  try {
    const token = generateQrToken(restaurantId)
    const scanUrl = `https://fidapp-client.vercel.app/scan/${token}`
    const qrImage = await QRCode.toDataURL(scanUrl, {
      width: 400,
      margin: 2,
      color: { dark: '#1a1a1a', light: '#ffffff' }
    })

    await prisma.qrCode.create({
      data: { restaurantId, code: uuidv4(), isRotating: true }
    })

    res.json({ success: true, token, scanUrl, qrImage })
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur', detail: err.message })
  }
}

const getMyQrCodes = async (req, res) => {
  const restaurantId = req.restaurantId

  try {
    const token = generateQrToken(restaurantId)
    const qrImage = await generateQrImage(token)

    res.json({
      qrCodes: [{
        id: 'rotating',
        code: token,
        isRotating: true,
        qrImage,
        scanUrl: `https://fidapp-client.vercel.app/scan/${token}`,
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 60 * 60 * 1000)
      }]
    })
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur', detail: err.message })
  }
}

module.exports = { generateQrCode, getMyQrCodes }