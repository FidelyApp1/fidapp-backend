const prisma = require('../lib/prisma')

const getStats = async (req, res) => {
  const restaurantId = req.restaurantId

  try {
    const totalClients = await prisma.loyaltyCard.count({
      where: { restaurantId }
    })

    const totalCheckins = await prisma.checkin.count({
      where: { loyaltyCard: { restaurantId } }
    })

    const totalRewards = await prisma.reward.count({
      where: { loyaltyCard: { restaurantId } }
    })

    const recentCheckins = await prisma.checkin.findMany({
      where: { loyaltyCard: { restaurantId } },
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: {
        loyaltyCard: {
          include: { user: true }
        }
      }
    })

    res.json({ totalClients, totalCheckins, totalRewards, recentCheckins })
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur', detail: err.message })
  }
}

module.exports = { getStats }