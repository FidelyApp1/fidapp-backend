const prisma = require('../lib/prisma')

const checkin = async (req, res) => {
  const { phone, qrCode } = req.body

  try {
    // Trouver le QR code et le restaurant associé
    const qr = await prisma.qrCode.findUnique({
      where: { code: qrCode },
      include: { restaurant: true }
    })

    if (!qr) {
      return res.status(404).json({ error: 'QR code invalide' })
    }

    // Trouver ou créer l'utilisateur
    let user = await prisma.user.findUnique({ where: { phone } })
    if (!user) {
      user = await prisma.user.create({ data: { phone } })
    }

    // Trouver ou créer la carte de fidélité
    let card = await prisma.loyaltyCard.findUnique({
      where: { userId_restaurantId: { userId: user.id, restaurantId: qr.restaurantId } }
    })

    if (!card) {
      card = await prisma.loyaltyCard.create({
        data: { userId: user.id, restaurantId: qr.restaurantId }
      })
    }

    // 🛡️ Anti-fraude — 1 check-in par tranche de 4h
    const fourHoursAgo = new Date(Date.now() - 4 * 60 * 60 * 1000)
    const recentCheckin = await prisma.checkin.findFirst({
      where: {
        loyaltyCardId: card.id,
        createdAt: { gte: fourHoursAgo }
      }
    })

    if (recentCheckin) {
      const nextCheckin = new Date(recentCheckin.createdAt.getTime() + 4 * 60 * 60 * 1000)
      
      // Sécurité : Math.max(1, ...) pour éviter le "0min" si l'utilisateur tente à la dernière seconde
      const diff = Math.max(1, Math.ceil((nextCheckin - Date.now()) / (1000 * 60)))
      
      const heures = Math.floor(diff / 60)
      const minutes = diff % 60
      
      return res.status(429).json({
        error: 'anti_fraud',
        message: `Prochain check-in disponible dans ${heures > 0 ? heures + 'h' : ''}${minutes}min`
      })
    }

    // Créer le check-in
    await prisma.checkin.create({ data: { loyaltyCardId: card.id } })

    // Incrémenter les compteurs
    const updatedCard = await prisma.loyaltyCard.update({
      where: { id: card.id },
      data: {
        checkCount: { increment: 1 },
        totalChecks: { increment: 1 }
      }
    })

    // Vérifier si reward atteint (10 check-ins)
    let reward = null
    if (updatedCard.checkCount >= 10) {
      reward = await prisma.reward.create({
        data: {
          loyaltyCardId: card.id,
          type: 'FREE_MEAL',
          description: 'Repas gratuit gagné !'
        }
      })

      // Reset le compteur
      await prisma.loyaltyCard.update({
        where: { id: card.id },
        data: { checkCount: 0 }
      })
    }

    res.json({
      success: true,
      restaurant: qr.restaurant.name,
      checkCount: reward ? 0 : updatedCard.checkCount,
      reward: reward ? reward.description : null,
      message: reward ? '🎉 Félicitations ! Vous avez gagné un repas gratuit !' : `Check-in #${updatedCard.checkCount}/10`
    })
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur', detail: err.message })
  }
}

module.exports = { checkin }