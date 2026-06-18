const prisma = require('../lib/prisma')
const QRCode = require('qrcode')
const jwt = require('jsonwebtoken')

// 1️⃣ Le JWT contient maintenant l'ID unique de l'enregistrement QrCode (qrCodeId)
const generateQrToken = (restaurantId, qrCodeId) => {
  return jwt.sign(
    { restaurantId, qrCodeId, type: 'qr_checkin' },
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

// 2️⃣ Force la génération d'un TOUT NOUVEAU flux/code (ex: clic sur rafraîchir)
const generateQrCode = async (req, res) => {
  const restaurantId = req.restaurantId

  try {
    // On crée l'entrée d'abord en BDD pour récupérer son ID unique
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

    // Optionnel : on met à jour le champ 'code' avec le jeton pour le suivi
    await prisma.qrCode.update({
      where: { id: newQrRecord.id },
      data: { code: token }
    })

    res.json({ success: true, token, scanUrl, qrImage })
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur', detail: err.message })
  }
}

// 3️⃣ Récupère le QR code actif actuel ou en génère un si expiré/consommé
const getMyQrCodes = async (req, res) => {
  const restaurantId = req.restaurantId

  try {
    // On cherche un QR code existant pour ce resto qui n'est PAS utilisé et qui a moins de 55 min
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

    // Si aucun QR code n'est dispo (ex: utilisé ou expiré), on en génère un automatiquement
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
        id: activeQr.id, // ID unique indispensable pour le polling Frontend !
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