const prisma = require('../lib/prisma')
const { v4: uuidv4 } = require('uuid')
const QRCode = require('qrcode')

const generateQrCode = async (req, res) => {
  const restaurantId = req.restaurantId

  try {
    const qrCode = await prisma.qrCode.create({
      data: { restaurantId, code: uuidv4() }
    })

    // URL mise à jour pour la production Vercel
    const scanUrl = `https://fidapp-client.vercel.app/scan/${qrCode.code}`
    const qrImageBase64 = await QRCode.toDataURL(scanUrl, {
      width: 400,
      margin: 2,
      color: { dark: '#1a1a1a', light: '#ffffff' }
    })

    res.json({
      success: true,
      qrCode: qrCode.code,
      scanUrl,
      qrImage: qrImageBase64
    })
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur', detail: err.message })
  }
}

const getMyQrCodes = async (req, res) => {
  const restaurantId = req.restaurantId

  try {
    const qrCodes = await prisma.qrCode.findMany({
      where: { restaurantId },
      orderBy: { createdAt: 'desc' }
    })

    const qrCodesWithImages = await Promise.all(
      qrCodes.map(async (qr) => {
        // URL mise à jour également ici pour l'historique des codes
        const scanUrl = `https://fidapp-client.vercel.app/scan/${qr.code}`
        const qrImage = await QRCode.toDataURL(scanUrl, {
          width: 400,
          margin: 2,
          color: { dark: '#1a1a1a', light: '#ffffff' }
        })
        return { ...qr, scanUrl, qrImage }
      })
    )

    res.json({ qrCodes: qrCodesWithImages })
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur', detail: err.message })
  }
}

module.exports = { generateQrCode, getMyQrCodes }