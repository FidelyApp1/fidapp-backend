const prisma = require('../lib/prisma')
const jwt = require('jsonwebtoken')

const checkin = async (req, res) => {
  // 📥 Récupération des données envoyées par le smartphone du client
  const { phone, qrCode, name } = req.body

  try {
    // 1️⃣ Décoder et vérifier la validité du token JWT
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
    const qrCodeId = decoded.qrCodeId 

    // 2️⃣ et 3️⃣ 🛡️ OPÉRATION ATOMIQUE ANTI-FRAUDE (Screenshot & Double Validation simultanée)
    const updatedQr = await prisma.qrCode.updateMany({
      where: {
        id: qrCodeId,
        isUsed: false
      },
      data: {
        isUsed: true
      }
    })

    if (updatedQr.count === 0) {
      return res.status(410).json({
        error: 'qr_already_used',
        message: "Ce QR code a déjà été validé ou est obsolète. Veuillez scanner le nouveau QR code sur l'écran du restaurant."
      })
    }

    // 4️⃣ Vérifications de l'état du restaurant & Récupération de son délai personnalisé
    const restaurant = await prisma.restaurant.findUnique({
      where: { id: restaurantId }
    })

    if (!restaurant) {
      return res.status(404).json({ error: 'Restaurant introuvable' })
    }

    if (restaurant.suspended) {
      return res.status(403).json({ error: 'Ce restaurant est suspendu' })
    }

    // 👤 Récupération ou création de l'utilisateur pour vérifier l'anti-spam au plus tôt
    let user = await prisma.user.findUnique({ where: { phone } })
    
    if (!user) {
      user = await prisma.user.create({ data: { phone, name: name || null } })
    } else if (name && !user.name) {
      user = await prisma.user.update({ where: { phone }, data: { name } })
    }

    // ⏱️ 5️⃣ LOCK ANTI-SPAM DYNAMIQUE : Récupération du délai paramétré par le restaurant
    // Utilise la valeur du dashboard, ou 6 heures par défaut si non définie
    const delayHours = restaurant.scanDelayHours !== undefined ? restaurant.scanDelayHours : 6
    const LIMIT_TIME_AGO = new Date(Date.now() - delayHours * 60 * 60 * 1000)

    // Vérification de l'existence d'un scan récent pour cet utilisateur dans CE restaurant
    const recentCheckin = await prisma.checkin.findFirst({
      where: {
        loyaltyCard: {
          userId: user.id,
          restaurantId: restaurantId
        },
        createdAt: {
          gte: LIMIT_TIME_AGO
        }
      }
    })

    if (recentCheckin) {
      return res.status(429).json({
        error: 'limit_reached',
        message: `Vous avez déjà validé une visite récemment dans cet établissement. Veuillez attendre ${delayHours}h entre chaque repas !`
      })
    }

    // 6️⃣ Récupération ou création de la carte de fidélité pour ce restaurant
    let card = await prisma.loyaltyCard.findUnique({
      where: { userId_restaurantId: { userId: user.id, restaurantId } }
    })

    if (!card) {
      card = await prisma.loyaltyCard.create({
        data: { userId: user.id, restaurantId }
      })
    }

    // 7️⃣ 🛒 Validation finale : Création de la ligne d'historique (Checkin)
    await prisma.checkin.create({
      data: { 
        loyaltyCardId: card.id,
        qrToken: qrCode
      }
    })

    // Incrémentation des points sur la carte de fidélité
    const updatedCard = await prisma.loyaltyCard.update({
      where: { id: card.id },
      data: {
        checkCount: { increment: 1 },
        totalChecks: { increment: 1 }
      }
    })

    // 8️⃣ 🎁 Calcul et attribution de la récompense personnalisée si le palier est atteint
    let reward = null
    if (updatedCard.checkCount >= restaurant.checksRequired) {
      reward = await prisma.reward.create({
        data: {
          loyaltyCardId: card.id,
          type: 'CUSTOM',
          description: restaurant.rewardTitle
        }
      })
      
      // Réinitialisation du compteur pour le prochain cycle de fidélité
      await prisma.loyaltyCard.update({
        where: { id: card.id },
        data: { checkCount: 0 }
      })
    }

    // 9️⃣ 🚀 Réponse HTTP renvoyée au smartphone du client
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