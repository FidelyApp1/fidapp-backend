const prisma = require('../lib/prisma')

const getPendingRewards = async (req, res) => {
  try {
    const rewards = await prisma.reward.findMany({
      where: {
        loyaltyCard: { restaurantId: req.restaurantId },
        redeemedAt: null
      },
      orderBy: { createdAt: 'desc' },
      include: {
        loyaltyCard: {
          include: { user: true }
        }
      }
    })

    res.json({ rewards })
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' })
  }
}

const redeemReward = async (req, res) => {
  const { id } = req.params

  try {
    const reward = await prisma.reward.findFirst({
      where: {
        id,
        loyaltyCard: { restaurantId: req.restaurantId }
      }
    })

    if (!reward) {
      return res.status(404).json({ error: 'Récompense introuvable' })
    }

    if (reward.redeemedAt) {
      return res.status(400).json({ error: 'Récompense déjà utilisée' })
    }

    const updated = await prisma.reward.update({
      where: { id },
      data: { redeemedAt: new Date() },
      include: {
        loyaltyCard: {
          include: { user: true }
        }
      }
    })

    res.json({ reward: updated, message: 'Récompense marquée comme utilisée' })
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' })
  }
}

module.exports = { getPendingRewards, redeemReward }
