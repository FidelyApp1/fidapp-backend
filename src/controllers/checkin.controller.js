const prisma = require('../lib/prisma')
const jwt = require('jsonwebtoken')

const checkin = async (req, res) => {
  const { phone, qrCode } = req.body

  try {
    // Vérifier le QR token JWT
    let decoded
    try {
      decoded = jwt.verify(qrCode, process.env.JWT_SECRET)
    } catch (err) {
      return res.status(401).json({
        error: 'qr_expired',
        message: 'QR code expiré — demandez au restaurant d\'afficher le nouveau QR code'
      })
    }

    if (decoded.type !== 'qr_checkin') {
      return res.status(401).json({ error: 'QR code invalide' })
    }

    const restaurantId = decoded.restaurantId

    const restaurant = await prisma.restaurant.findUnique({
      where: { id: restaurantId }
    })

    if (!restaurant) {
      return res.status(404).json({ error: 'Restaurant introuvable' })
    }

    if (restaurant.suspended) {
      return res.status(403).json({ error: 'Ce restaurant est suspendu' })
    }

    let user = await prisma.user.findUnique({ where: { phone } })
    if (!user) {
      user = await prisma.user.create({ data: { phone } })
    }

    let card = await prisma.loyaltyCard.findUnique({
      where: { userId_restaurantId: { userId: user.id, restaurantId } }
    })

    if (!card) {
      card = await prisma.loyaltyCard.create({
        data: { userId: user.id, restaurantId }
      })
    }

    // Anti-fraude 4h
    const fourHoursAgo = new Date(Date.now() - 4 * 60 * 60 * 1000)
    const recentCheckin = await prisma.checkin.findFirst({
      where: {
        loyaltyCardId: card.id,
        createdAt: { gte: fourHoursAgo }
      }
    })

    if (recentCheckin) {
      const nextCheckin = new Date(recentCheckin.createdAt.getTime() + 4 * 60 * 60 * 1000)
      const diff = Math.ceil((nextCheckin - Date.now()) / (1000 * 60))
      const heures = Math.floor(diff / 60)
      const minutes = diff % 60
      return res.status(429).json({
        error: 'anti_fraud',
        message: `Prochain check-in disponible dans ${heures > 0 ? heures + 'h' : ''}${minutes}min`
      })
    }

    await prisma.checkin.create({ data: { loyaltyCardId: card.id } })

    const updatedCard = await prisma.loyaltyCard.update({
      where: { id: card.id },
      data: {
        checkCount: { increment: 1 },
        totalChecks: { increment: 1 }
      }
    })

    let reward = null
    if (updatedCard.checkCount >= restaurant.checksRequired) {
      reward = await prisma.reward.create({
        data: {
          loyaltyCardId: card.id,
          type: 'FREE_MEAL',
          description: 'Repas gratuit gagné !'
        }
      })
      await prisma.loyaltyCard.update({
        where: { id: card.id },
        data: { checkCount: 0 }
      })
    }

    res.json({
      success: true,
      restaurant: restaurant.name,
      checkCount: reward ? 0 : updatedCard.checkCount,
      checksRequired: restaurant.checksRequired,
      reward: reward ? reward.description : null,
      message: reward
        ? '🎉 Félicitations ! Vous avez gagné un repas gratuit !'
        : `Check-in #${updatedCard.checkCount}/${restaurant.checksRequired}`
    })
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur', detail: err.message })
  }
}

module.exports = { checkin }