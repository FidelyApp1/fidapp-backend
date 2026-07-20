const prisma = require('../lib/prisma')
const jwt = require('jsonwebtoken')
const { normalizePhone } = require('../lib/phone')
const { verifyOtpForPhone } = require('../controllers/otp.controller')

const checkin = async (req, res) => {
  const { phone, qrCode, name, otpCode } = req.body

  try {
    const normalizedPhone = normalizePhone(phone)
    if (!normalizedPhone) {
      return res.status(400).json({
        error: 'invalid_phone',
        message: 'Veuillez entrer un numéro de téléphone marocain valide.'
      })
    }

    const otpResult = await verifyOtpForPhone(normalizedPhone, otpCode)
    if (!otpResult.ok) {
      return res.status(401).json({
        error: otpResult.error,
        message: otpResult.message
      })
    }

    let decoded
    try {
      decoded = jwt.verify(qrCode, process.env.JWT_SECRET, { algorithms: ['HS256'] })
    } catch (err) {
      return res.status(401).json({
        error: 'qr_expired',
        message: "QR code expiré — demandez au restaurant d'afficher le nouveau QR code"
      })
    }

    if (decoded.type !== 'qr_checkin') {
      return res.status(401).json({ error: 'QR code invalide' })
    }

    const restaurantId = decoded.restaurantId
    const qrCodeId = decoded.qrCodeId

    const restaurant = await prisma.restaurant.findUnique({
      where: { id: restaurantId }
    })

    if (!restaurant) {
      return res.status(404).json({ error: 'Restaurant introuvable' })
    }

    if (restaurant.suspended) {
      return res.status(403).json({ error: 'Ce restaurant est suspendu' })
    }

    let user = await prisma.user.findUnique({ where: { phone: normalizedPhone } })

    if (!user) {
      user = await prisma.user.create({
        data: { phone: normalizedPhone, name: name?.trim() || null }
      })
    } else if (name?.trim() && !user.name) {
      user = await prisma.user.update({
        where: { phone: normalizedPhone },
        data: { name: name.trim() }
      })
    }

    const delayHours = restaurant.scanDelayHours ?? 6
    const limitTimeAgo = new Date(Date.now() - delayHours * 60 * 60 * 1000)

    const recentCheckin = await prisma.checkin.findFirst({
      where: {
        loyaltyCard: {
          userId: user.id,
          restaurantId
        },
        createdAt: { gte: limitTimeAgo }
      }
    })

    if (recentCheckin) {
      return res.status(429).json({
        error: 'limit_reached',
        message: `Vous avez déjà validé une visite récemment dans cet établissement. Veuillez attendre ${delayHours}h entre chaque repas !`
      })
    }

    const activeQr = await prisma.qrCode.findFirst({
      where: { id: qrCodeId, restaurantId, isUsed: false }
    })

    if (!activeQr) {
      return res.status(410).json({
        error: 'qr_already_used',
        message: "Ce QR code a déjà été validé ou est obsolète. Veuillez scanner le nouveau QR code sur l'écran du restaurant."
      })
    }

    const result = await prisma.$transaction(async (tx) => {
      const updatedQr = await tx.qrCode.updateMany({
        where: { id: qrCodeId, isUsed: false },
        data: { isUsed: true }
      })

      if (updatedQr.count === 0) {
        const err = new Error('QR_ALREADY_USED')
        err.code = 'QR_ALREADY_USED'
        throw err
      }

      let card = await tx.loyaltyCard.findUnique({
        where: { userId_restaurantId: { userId: user.id, restaurantId } }
      })

      if (!card) {
        card = await tx.loyaltyCard.create({
          data: { userId: user.id, restaurantId }
        })
      }

      await tx.checkin.create({
        data: {
          loyaltyCardId: card.id,
          qrToken: qrCodeId
        }
      })

      const updatedCard = await tx.loyaltyCard.update({
        where: { id: card.id },
        data: {
          checkCount: { increment: 1 },
          totalChecks: { increment: 1 }
        }
      })

      let reward = null
      let finalCheckCount = updatedCard.checkCount

      if (updatedCard.checkCount >= restaurant.checksRequired) {
        reward = await tx.reward.create({
          data: {
            loyaltyCardId: card.id,
            type: 'CUSTOM',
            description: restaurant.rewardTitle
          }
        })

        await tx.loyaltyCard.update({
          where: { id: card.id },
          data: { checkCount: 0 }
        })

        finalCheckCount = 0
      }

      return { reward, finalCheckCount, previousCheckCount: updatedCard.checkCount }
    })

    const clientToken = jwt.sign(
      { phone: user.phone, type: 'client_session' },
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    )

    res.json({
      success: true,
      clientToken,
      restaurant: restaurant.name,
      rewardEmoji: restaurant.rewardEmoji,
      rewardTitle: restaurant.rewardTitle,
      rewardDesc: restaurant.rewardDesc,
      checkCount: result.finalCheckCount,
      checksRequired: restaurant.checksRequired,
      reward: result.reward ? restaurant.rewardTitle : null,
      message: result.reward
        ? `${restaurant.rewardEmoji || '🎉'} ${restaurant.rewardTitle} !`
        : `Check-in #${result.previousCheckCount}/${restaurant.checksRequired}`
    })
  } catch (err) {
    if (err.code === 'QR_ALREADY_USED') {
      return res.status(410).json({
        error: 'qr_already_used',
        message: "Ce QR code a déjà été validé ou est obsolète. Veuillez scanner le nouveau QR code sur l'écran du restaurant."
      })
    }

    res.status(500).json({ error: 'Erreur serveur' })
  }
}

module.exports = { checkin }
