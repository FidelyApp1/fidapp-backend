const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const prisma = require('../lib/prisma')

const adminLogin = async (req, res) => {
  const { email, password } = req.body
  try {
    const admin = await prisma.admin.findUnique({ where: { email } })
    if (!admin) return res.status(404).json({ error: 'Admin introuvable' })
    const valid = await bcrypt.compare(password, admin.password)
    if (!valid) return res.status(401).json({ error: 'Mot de passe incorrect' })
    const token = jwt.sign({ adminId: admin.id, isAdmin: true }, process.env.JWT_SECRET, { expiresIn: '7d' })
    res.json({ token, admin: { id: admin.id, email: admin.email } })
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur', detail: err.message })
  }
}

const getGlobalStats = async (req, res) => {
  try {
    const totalRestaurants = await prisma.restaurant.count()
    const totalClients = await prisma.user.count()
    const totalCheckins = await prisma.checkin.count()
    const totalRewards = await prisma.reward.count()

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    const checkinsThisWeek = await prisma.checkin.findMany({
      where: { createdAt: { gte: sevenDaysAgo } },
      orderBy: { createdAt: 'asc' }
    })

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

    const activeRestaurants = await prisma.restaurant.count({ where: { suspended: false } })
    const suspendedRestaurants = await prisma.restaurant.count({ where: { suspended: true } })

    const firstOfMonth = new Date()
    firstOfMonth.setDate(1)
    firstOfMonth.setHours(0, 0, 0, 0)
    const checkinsThisMonth = await prisma.checkin.count({
      where: { createdAt: { gte: firstOfMonth } }
    })

    const newClientsThisMonth = await prisma.user.count({
      where: { createdAt: { gte: firstOfMonth } }
    })

    res.json({
      totalRestaurants,
      totalClients,
      totalCheckins,
      totalRewards,
      activeRestaurants,
      suspendedRestaurants,
      checkinsThisMonth,
      newClientsThisMonth,
      dailyData
    })
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur', detail: err.message })
  }
}

const getRestaurants = async (req, res) => {
  try {
    const restaurants = await prisma.restaurant.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { loyaltyCards: true, qrCodes: true } }
      }
    })
    res.json({ restaurants })
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur', detail: err.message })
  }
}

const createRestaurant = async (req, res) => {
  const { name, email, password, phone, address, checksRequired } = req.body
  try {
    const existing = await prisma.restaurant.findUnique({ where: { email } })
    if (existing) return res.status(400).json({ error: 'Email déjà utilisé' })
    const hashedPassword = await bcrypt.hash(password, 10)
    const restaurant = await prisma.restaurant.create({
      data: { name, email, password: hashedPassword, phone, address, checksRequired: checksRequired || 10 }
    })
    res.status(201).json({ restaurant })
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur', detail: err.message })
  }
}

const updateRestaurant = async (req, res) => {
  const { id } = req.params
  const { name, phone, address, checksRequired, suspended, email } = req.body
  try {
    const restaurant = await prisma.restaurant.update({
      where: { id },
      data: { name, phone, address, checksRequired, suspended, email }
    })
    res.json({ restaurant })
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur', detail: err.message })
  }
}

const resetPassword = async (req, res) => {
  const { id } = req.params
  const { newPassword } = req.body
  try {
    const hashedPassword = await bcrypt.hash(newPassword, 10)
    await prisma.restaurant.update({
      where: { id },
      data: { password: hashedPassword }
    })
    res.json({ success: true, message: 'Mot de passe réinitialisé' })
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur', detail: err.message })
  }
}

const deleteRestaurant = async (req, res) => {
  const { id } = req.params
  try {
    await prisma.restaurant.delete({ where: { id } })
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur', detail: err.message })
  }
}

const getRestaurantStats = async (req, res) => {
  const { id } = req.params
  try {
    const restaurant = await prisma.restaurant.findUnique({
      where: { id },
      include: { _count: { select: { loyaltyCards: true, qrCodes: true } } }
    })
    const totalCheckins = await prisma.checkin.count({ where: { loyaltyCard: { restaurantId: id } } })
    const totalRewards = await prisma.reward.count({ where: { loyaltyCard: { restaurantId: id } } })
    const recentCheckins = await prisma.checkin.findMany({
      where: { loyaltyCard: { restaurantId: id } },
      orderBy: { createdAt: 'desc' },
      take: 20,
      include: { loyaltyCard: { include: { user: true } } }
    })
    res.json({ restaurant, totalCheckins, totalRewards, recentCheckins })
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur', detail: err.message })
  }
}

const getAllClients = async (req, res) => {
  try {
    const clients = await prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { loyaltyCards: true } },
        loyaltyCards: {
          include: { restaurant: true }
        }
      }
    })
    res.json({ clients })
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur', detail: err.message })
  }
}

const getAllCheckins = async (req, res) => {
  try {
    const checkins = await prisma.checkin.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        loyaltyCard: {
          include: {
            user: true,
            restaurant: true
          }
        }
      }
    })
    res.json({ checkins })
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur', detail: err.message })
  }
}

const getAllRewards = async (req, res) => {
  try {
    const rewards = await prisma.reward.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        loyaltyCard: {
          include: {
            user: true,
            restaurant: true
          }
        }
      }
    })
    res.json({ rewards })
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur', detail: err.message })
  }
}

const updateAdminPassword = async (req, res) => {
  const { adminId } = req
  const { currentPassword, newPassword } = req.body
  try {
    const admin = await prisma.admin.findUnique({ where: { id: adminId } })
    const valid = await bcrypt.compare(currentPassword, admin.password)
    if (!valid) return res.status(401).json({ error: 'Mot de passe actuel incorrect' })
    const hashed = await bcrypt.hash(newPassword, 10)
    await prisma.admin.update({ where: { id: adminId }, data: { password: hashed } })
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur', detail: err.message })
  }
}

module.exports = {
  adminLogin, getGlobalStats, getRestaurants, createRestaurant,
  updateRestaurant, resetPassword, deleteRestaurant, getRestaurantStats,
  getAllClients, getAllCheckins, getAllRewards, updateAdminPassword
}