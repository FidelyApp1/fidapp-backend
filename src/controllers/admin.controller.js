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

    const token = jwt.sign(
      { adminId: admin.id, isAdmin: true },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    )

    res.json({ token, admin: { id: admin.id, email: admin.email } })
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur', detail: err.message })
  }
}

const getRestaurants = async (req, res) => {
  try {
    const restaurants = await prisma.restaurant.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { loyaltyCards: true, qrCodes: true }
        }
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
      data: {
        name,
        email,
        password: hashedPassword,
        phone,
        address,
        checksRequired: checksRequired || 10
      }
    })

    res.status(201).json({ restaurant })
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur', detail: err.message })
  }
}

const updateRestaurant = async (req, res) => {
  const { id } = req.params
  const { name, phone, address, checksRequired, suspended } = req.body
  try {
    const restaurant = await prisma.restaurant.update({
      where: { id },
      data: { name, phone, address, checksRequired, suspended }
    })
    res.json({ restaurant })
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
      include: {
        _count: { select: { loyaltyCards: true, qrCodes: true } }
      }
    })

    const totalCheckins = await prisma.checkin.count({
      where: { loyaltyCard: { restaurantId: id } }
    })

    const totalRewards = await prisma.reward.count({
      where: { loyaltyCard: { restaurantId: id } }
    })

    res.json({ restaurant, totalCheckins, totalRewards })
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur', detail: err.message })
  }
}

module.exports = { adminLogin, getRestaurants, createRestaurant, updateRestaurant, deleteRestaurant, getRestaurantStats }