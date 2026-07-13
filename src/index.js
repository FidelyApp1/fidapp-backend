const express = require('express')
const cors = require('cors')
const rateLimit = require('express-rate-limit')
require('dotenv').config()

const authRoutes = require('./routes/auth.routes')
const checkinRoutes = require('./routes/checkin.routes')
const qrcodeRoutes = require('./routes/qrcode.routes')
const statsRoutes = require('./routes/stats.routes')
const adminRoutes = require('./routes/admin.routes')
const clientRoutes = require('./routes/client.routes')

const app = express()

app.use(cors({
  origin: [
    'http://localhost:5173',
    'http://localhost:5174',
    'https://fidapp-client.vercel.app',
    'https://fidapp-dashboard.vercel.app',
    'https://fidapp-admin.vercel.app'
  ],
  credentials: true
}))
app.use(express.json())

// 🛡️ Rate limiter for sensitive/abusable routes (login, check-in)
// Allows 20 requests per minute per IP — generous for real users, blocks scripted spam
const strictLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Trop de requêtes, merci de réessayer dans une minute.' }
})

// 🛡️ Looser limiter for general API traffic
const generalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Trop de requêtes, merci de réessayer dans une minute.' }
})

app.get('/', (req, res) => {
  res.json({ message: 'FidApp API is running 🚀' })
})

app.use('/api/client', clientRoutes)
app.use('/api/auth', strictLimiter, authRoutes)
app.use('/api/checkin', strictLimiter, checkinRoutes)
app.use('/api/qrcode', generalLimiter, qrcodeRoutes)
app.use('/api/stats', generalLimiter, statsRoutes)
app.use('/api/admin', generalLimiter, adminRoutes)

const PORT = process.env.PORT || 3000
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})