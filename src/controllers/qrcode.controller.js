const prisma = require('../lib/prisma')
const QRCode = require('qrcode')
const jwt = require('jsonwebtoken')
const config = require('../lib/config')

const generateQrToken = (restaurantId, qrCodeId) => {
  return jwt.sign(
    { restaurantId, qrCodeId, type: 'qr_checkin' },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  )
}

const buildScanUrl = (token) => `${config.clientAppUrl}/scan/${token}`

const generateQrImage = async (token) => {
  const scanUrl = buildScanUrl(token)
  return await QRCode.toDataURL(scanUrl, {
    width: 400,
    margin: 2,
    color: { dark: '#1a1a1a', light: '#ffffff' }
  })
}

const generateQrCode = async (req, res) => {
  const restaurantId = req.restaurantId

  try {
    const newQrRecord = await prisma.qrCode.create({
      data: { 
        restaurantId, 
        isRotating: true,
        isUsed: false 
      }
    })

    const token = generateQrToken(restaurantId, newQrRecord.id)
    const qrImage = await generateQrImage(token)
    const scanUrl = buildScanUrl(token)

    await prisma.qrCode.update({
      where: { id: newQrRecord.id },
      data: { code: token }
    })

    res.json({ success: true, token, scanUrl, qrImage })
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' })
  }
}

const getMyQrCodes = async (req, res) => {
  const restaurantId = req.restaurantId

  try {
    let activeQr = await prisma.qrCode.findFirst({
      where: {
        restaurantId,
        isRotating: true,
        isUsed: false,
        createdAt: {
          gte: new Date(Date.now() - 55 * 60 * 1000)
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    if (!activeQr) {
      activeQr = await prisma.qrCode.create({
        data: { 
          restaurantId, 
          isRotating: true, 
          isUsed: false 
        }
      })
    }

    const token = generateQrToken(restaurantId, activeQr.id)
    const qrImage = await generateQrImage(token)

    res.json({
      qrCodes: [{
        id: activeQr.id,
        code: token,
        isRotating: true,
        qrImage,
        scanUrl: buildScanUrl(token),
        createdAt: activeQr.createdAt,
        expiresAt: new Date(activeQr.createdAt.getTime() + 60 * 60 * 1000)
      }]
    })
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' })
  }
}

module.exports = { generateQrCode, getMyQrCodes }
