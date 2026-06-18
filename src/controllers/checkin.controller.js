const prisma = require('../lib/prisma')
const jwt = require('jsonwebtoken')

const checkin = async (req, res) => {
  // 📥 Récupération du numéro, du token QR et du prénom depuis le body
  const { phone, qrCode, name } = req.body

  try {
    // 1️⃣ Vérifier le QR token JWT
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
    const qrCodeId = decoded.qrCodeId // ⚡ Récupération de l'ID unique de la ligne Prisma

    // 2️⃣ 🛡️ LOCK ANTI-FRAUDE GLOBAL (Screenshot / Partage WhatsApp)
    // On va chercher le QR code généré en base de données pour vérifier son état
    const qrRecord = await prisma.qrCode.findUnique({
      where: { id: qrCodeId }
    })

    // S'il n'existe pas ou s'il a DÉJÀ été scanné par quelqu'un d'autre -> REJET IMMÉDIAT
    if (!qrRecord || qrRecord.isUsed) {
      return res.status(410).json({
        error: 'qr_already_used',
        message: "Ce QR code a déjà été validé ou est obsolète. Veuillez scanner le nouveau QR code sur l'écran du restaurant."
      })
    }

    // 3️⃣ 🔒 INVALIDATION IMMÉDIATE : On marque le QR code comme consommé tout de suite
    // pour bloquer les requêtes simultanées ou ultra-rapides.
    await prisma.qrCode.update({
      where: { id: qrCodeId },
      data: { isUsed: true }
    })

    // 4️⃣ Vérifications du restaurant
    const restaurant = await prisma.restaurant.findUnique({
      where: { id: restaurantId }
    })

    if (!restaurant) {
      return res.status(404).json({ error: 'Restaurant introuvable' })
    }

    if (restaurant.suspended) {
      return res.status(403).json({ error: 'Ce restaurant est suspendu' })
    }

    // 5️⃣ 👤 Gestion de l'utilisateur avec prise en compte du prénom (name)
    let user = await prisma.user.findUnique({ where: { phone } })
    
    if (!user) {
      // Inscription
      user = await prisma.user.create({ data: { phone, name: name || null } })
    } else if (name && !user.name) {
      // Remplissage si le prénom manquait
      user = await prisma.user.update({ where: { phone }, data: { name } })
    }

    // 6️⃣ Gestion ou création de la carte de fidélité
    let card = await prisma.loyaltyCard.findUnique({
      where: { userId_restaurantId: { userId: user.id, restaurantId } }
    })

    if (!card) {
      card = await prisma.loyaltyCard.create({
        data: { userId: user.id, restaurantId }
      })
    }

    // ⏱️ 7️⃣ LOCK ANTI-SPAM PAR CLIENT : Limite à 1 scan toutes les 6 heures
    const LIMIT_TIME_AGO = new Date(Date.now() - 6 * 60 * 60 * 1000) // Change le 6 par le nombre d'heures souhaité

    const recentCheckin = await prisma.checkin.findFirst({
      where: {
        loyaltyCardId: card.id,
        createdAt: {
          gte: LIMIT_TIME_AGO // Cherche si un scan existe déjà dans cet intervalle de temps
        }
      }
    })

    if (recentCheckin) {
      return res.status(429).json({
        error: 'limit_reached',
        message: "Vous avez déjà validé une visite récemment dans cet établissement. Revenez lors de votre prochain repas !"
      })
    }

    // 8️⃣ 🛒 Création du check-in historique (Si non spammé)
    await prisma.checkin.create({
      data: { 
        loyaltyCardId: card.id,
        qrToken: qrCode
      }
    })

    // Incrémentation des compteurs de la carte de fidélité
    const updatedCard = await prisma.loyaltyCard.update({
      where: { id: card.id },
      data: {
        checkCount: { increment: 1 },
        totalChecks: { increment: 1 }
      }
    })

    // 9️⃣ 🎁 Gestion de la récompense personnalisée (Custom Reward)
    let reward = null
    if (updatedCard.checkCount >= restaurant.checksRequired) {
      reward = await prisma.reward.create({
        data: {
          loyaltyCardId: card.id,
          type: 'CUSTOM',
          description: restaurant.rewardTitle
        }
      })
      
      // Réinitialisation du compteur de la carte pour le prochain cycle
      await prisma.loyaltyCard.update({
        where: { id: card.id },
        data: { checkCount: 0 }
      })
    }

    // 🔟 🚀 Réponse HTTP propre
    res.json({
      success: true,
      restaurant: restaurant.name,
      rewardEmoji: restaurant.rewardEmoji,
      rewardTitle: restaurant.rewardTitle,
      rewardDesc: restaurant.rewardDesc,
      checkCount: reward ? 0 : updatedCard.checkCount,
      checksRequired: restaurant.checksRequired,
      reward: reward ? restaurant.rewardTitle : null,
      message: reward
        ? `${restaurant.rewardEmoji || '🎉'} ${restaurant.rewardTitle} !`
        : `Check-in #${updatedCard.checkCount}/${restaurant.checksRequired}`
    })
    
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur', detail: err.message })
  }
}

module.exports = { checkin }