const prisma = require('../lib/prisma')
const QRCode = require('qrcode')
const jwt = require('jsonwebtoken')

// Génère le token JWT contenant l'ID unique du QR code en BDD
const generateQrToken = (restaurantId, qrCodeId) => {
  return jwt.sign(
    { restaurantId, qrCodeId, type: 'qr_checkin' },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  )
}

// Génère l'image en Base64 du QR Code
const generateQrImage = async (token) => {
  const scanUrl = `https://fidapp-client.vercel.app/scan/${token}`
  return await QRCode.toDataURL(scanUrl, {
    width: 400,
    margin: 2,
    color: { dark: '#1a1a1a', light: '#ffffff' }
  })
}

// Force la génération d'un TOUT NOUVEAU code (ex: clic sur rafraîchir manuellement)
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
    const scanUrl = `https://fidapp-client.vercel.app/scan/${token}`

    await prisma.qrCode.update({
      where: { id: newQrRecord.id },
      data: { code: token }
    })

    res.json({ success: true, token, scanUrl, qrImage })
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur', detail: err.message })
  }
}

// Récupère le QR code actif actuel ou en génère un s'il a été consommé/expiré
const getMyQrCodes = async (req, res) => {
  const restaurantId = req.restaurantId

  try {
    // On cherche un QR code existant qui n'est PAS encore utilisé et qui a moins de 55 min
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

    // Si aucun QR code n'est disponible, on en crée un nouveau automatiquement
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
        id: activeQr.id, // ID unique indispensable pour le suivi et le polling
        code: token,
        isRotating: true,
        qrImage,
        scanUrl: `https://fidapp-client.vercel.app/scan/${token}`,
        createdAt: activeQr.createdAt,
        expiresAt: new Date(activeQr.createdAt.getTime() + 60 * 60 * 1000)
      }]
    })
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur', detail: err.message })
  }
}

module.exports = { generateQrCode, getMyQrCodes }