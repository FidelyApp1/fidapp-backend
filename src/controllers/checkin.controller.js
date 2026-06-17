const prisma = require('../lib/prisma')
const jwt = require('jsonwebtoken')

const checkin = async (req, res) => {
  // 📥 Récupération du prénom aux côtés des autres données du body
  const { phone, qrCode, name } = req.body

  try {
    // Vérifier le QR token JWT
    let decoded
    try {
      decoded = jwt.verify(qrCode, process.env.JWT_SECRET)
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

    const restaurant = await prisma.restaurant.findUnique({
      where: { id: restaurantId }
    })

    if (!restaurant) {
      return res.status(404).json({ error: 'Restaurant introuvable' })
    }

    if (restaurant.suspended) {
      return res.status(403).json({ error: 'Ce restaurant est suspendu' })
    }

    // 👤 Gestion de l'utilisateur avec prise en compte du prénom (name)
    let user = await prisma.user.findUnique({ where: { phone } })
    
    if (!user) {
      // Inscription : s'il n'existe pas, on l'enregistre avec son prénom s'il est fourni
      user = await prisma.user.create({ data: { phone, name: name || null } })
    } else if (name && !user.name) {
      // Remplissage : s'il existait déjà mais sans prénom enregistré, on met à jour
      user = await prisma.user.update({ where: { phone }, data: { name } })
    }

    let card = await prisma.loyaltyCard.findUnique({
      where: { userId_restaurantId: { userId: user.id, restaurantId } }
    })

    if (!card) {
      card = await prisma.loyaltyCard.create({
        data: { userId: user.id, restaurantId }
      })
    }

    // 🔒 Anti-fraude — 1 check-in par token QR unique pour ce client
    const existingCheckin = await prisma.checkin.findFirst({
      where: {
        loyaltyCardId: card.id,
        qrToken: qrCode
      }
    })

    if (existingCheckin) {
      return res.status(429).json({
        error: 'anti_fraud',
        message: 'Vous avez déjà scanné ce QR code. Attendez le prochain QR pour valider une nouvelle visite.'
      })
    }

    // 🛒 Création du check-in avec enregistrement du jeton utilisé
    await prisma.checkin.create({
      data: { 
        loyaltyCardId: card.id,
        qrToken: qrCode
      }
    })

    // Incrémentation de la carte de fidélité
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
        ? `🎉 Félicitations ${user.name || ''} ! Vous avez gagné un repas gratuit !`
        : `Check-in #${updatedCard.checkCount}/${restaurant.checksRequired}`
    })
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur', detail: err.message })
  }
}

module.exports = { checkin }