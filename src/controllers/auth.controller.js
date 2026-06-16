const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const prisma = require('../lib/prisma')

const register = async (req, res) => {
  const { name, email, password, phone, address } = req.body

  try {
    const existing = await prisma.restaurant.findUnique({ where: { email } })
    if (existing) {
      return res.status(400).json({ error: 'Email déjà utilisé' })
    }

    const hashedPassword = await bcrypt.hash(password, 10)

    const restaurant = await prisma.restaurant.create({
      data: { name, email, password: hashedPassword, phone, address }
    })

    const token = jwt.sign(
      { restaurantId: restaurant.id },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    )

    res.status(201).json({ token, restaurant: { id: restaurant.id, name: restaurant.name, email: restaurant.email } })
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur', detail: err.message })
  }
}
const getMe = async (req, res) => {
  try {
    const restaurant = await prisma.restaurant.findUnique({
      where: { id: req.restaurantId },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        address: true,
        checksRequired: true,
        suspended: true,
        createdAt: true
      }
    })
    if (!restaurant) return res.status(404).json({ error: 'Restaurant introuvable' })
    res.json({ restaurant })
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur', detail: err.message })
  }
}

module.exports = { register, login, getMe }
const login = async (req, res) => {
  const { email, password } = req.body

  try {
    const restaurant = await prisma.restaurant.findUnique({ where: { email } })
    if (!restaurant) {
      return res.status(404).json({ error: 'Restaurant introuvable' })
    }

    const valid = await bcrypt.compare(password, restaurant.password)
    if (!valid) {
      return res.status(401).json({ error: 'Mot de passe incorrect' })
    }

    const token = jwt.sign(
      { restaurantId: restaurant.id },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    )

    res.json({ token, restaurant: { id: restaurant.id, name: restaurant.name, email: restaurant.email } })
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur', detail: err.message })
  }
}

module.exports = { register, login }