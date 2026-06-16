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

    // Checkins des 7 derniers jours
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    const checkinsThisWeek = await prisma.checkin.findMany({
      where: {
        loyaltyCard: { restaurantId },
        createdAt: { gte: sevenDaysAgo }
      },
      orderBy: { createdAt: 'asc' }
    })

    // Grouper par jour
    const dailyData = {}
    for (let i = 6; i >= 0; i--) {
      const date = new Date()
      date.setDate(date.getDate() - i)
      const key = date.toISOString().split('T')[0]
      dailyData[key] = 0
    }
    checkinsThisWeek.forEach(c => {
      const key = c.createdAt.toISOString().split('T')[0]
      if (dailyData[key] !== undefined) dailyData[key]++
    })

    // Top clients
    const topClients = await prisma.loyaltyCard.findMany({
      where: { restaurantId },
      orderBy: { totalChecks: 'desc' },
      take: 5,
      include: { user: true }
    })

    // Checkins récents
    const recentCheckins = await prisma.checkin.findMany({
      where: { loyaltyCard: { restaurantId } },
      orderBy: { createdAt: 'desc' },
      take: 15,
      include: {
        loyaltyCard: { include: { user: true } }
      }
    })

    // Checkins ce mois
    const firstOfMonth = new Date()
    firstOfMonth.setDate(1)
    firstOfMonth.setHours(0, 0, 0, 0)
    const checkinsThisMonth = await prisma.checkin.count({
      where: {
        loyaltyCard: { restaurantId },
        createdAt: { gte: firstOfMonth }
      }
    })

    res.json({
      totalClients,
      totalCheckins,
      totalRewards,
      checkinsThisMonth,
      dailyData,
      topClients,
      recentCheckins
    })
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur', detail: err.message })
  }
}

module.exports = { getStats }