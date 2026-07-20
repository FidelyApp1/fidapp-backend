const prisma = require('../lib/prisma')

const getClientProfile = async (req, res) => {
  const phone = req.clientPhone

  try {
    const user = await prisma.user.findUnique({
      where: { phone },
      include: {
        loyaltyCards: {
          include: {
            restaurant: {
              select: {
                id: true,
                name: true,
                checksRequired: true,
                rewardTitle: true,
                rewardEmoji: true
              }
            },
            rewards: {
              orderBy: { createdAt: 'desc' }
            },
            checkins: {
              orderBy: { createdAt: 'desc' },
              take: 5
            }
          }
        }
      }
    })

    if (!user) {
      return res.status(404).json({ error: 'Client introuvable' })
    }

    const totalCheckins = await prisma.checkin.count({
      where: { loyaltyCard: { userId: user.id } }
    })

    const totalRewards = await prisma.reward.count({
      where: { loyaltyCard: { userId: user.id } }
    })

    res.json({ user, totalCheckins, totalRewards })
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' })
  }
}

module.exports = { getClientProfile }
