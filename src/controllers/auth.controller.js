const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const prisma = require('../lib/prisma')
const config = require('../lib/config')
const { RESTAURANT_PUBLIC_SELECT } = require('../lib/restaurantSelect')

// 1️⃣ Inscription d'un nouveau restaurant (désactivée par défaut)
const register = async (req, res) => {
  if (!config.allowPublicRegister) {
    return res.status(403).json({
      error: 'register_closed',
      message: 'Inscription fermée — contactez FidApp pour créer votre compte.'
    })
  }

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

    res.status(201).json({ 
      token, 
      restaurant: { id: restaurant.id, name: restaurant.name, email: restaurant.email } 
    })
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur', detail: err.message })
  }
}

// 2️⃣ Connexion d'un restaurant
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

    if (restaurant.suspended) {
      return res.status(403).json({ error: 'Compte suspendu — contactez FidApp.' })
    }

    const token = jwt.sign(
      { restaurantId: restaurant.id },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    )

    res.json({ 
      token, 
      restaurant: { id: restaurant.id, name: restaurant.name, email: restaurant.email } 
    })
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur', detail: err.message })
  }
}

// 3️⃣ Récupération du profil connecté (avec statut de suspension et configuration locale)
const getMe = async (req, res) => {
  try {
    const restaurant = await prisma.restaurant.findUnique({
      where: { id: req.restaurantId },
      select: RESTAURANT_PUBLIC_SELECT
    })
    if (!restaurant) return res.status(404).json({ error: 'Restaurant introuvable' })
    res.json({ restaurant })
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur', detail: err.message })
  }
}

// 4️⃣ Mise à jour des paramètres du restaurant
const updateSettings = async (req, res) => {
  const { name, phone, address, sector, checksRequired, scanDelayHours, rewardTitle, rewardDesc, rewardEmoji } = req.body
  
  try {
    const restaurant = await prisma.restaurant.update({
      where: { id: req.restaurantId },
      data: {
        name, 
        phone, 
        address, 
        sector,
        checksRequired,
        scanDelayHours,
        rewardTitle, 
        rewardDesc, 
        rewardEmoji
      },
      select: RESTAURANT_PUBLIC_SELECT
    })
    res.json({ restaurant })
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur', detail: err.message })
  }
}

// Un seul export propre pour tout le module 🚀
module.exports = { 
  register, 
  login, 
  getMe, 
  updateSettings 
}