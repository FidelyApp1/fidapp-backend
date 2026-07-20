const express = require('express')
const cors = require('cors')
const { strictLimiter, generalLimiter } = require('./lib/rateLimiters')
const config = require('./lib/config')
require('dotenv').config()

const authRoutes = require('./routes/auth.routes')
const checkinRoutes = require('./routes/checkin.routes')
const qrcodeRoutes = require('./routes/qrcode.routes')
const statsRoutes = require('./routes/stats.routes')
const adminRoutes = require('./routes/admin.routes')
const clientRoutes = require('./routes/client.routes')
const rewardRoutes = require('./routes/reward.routes')

const app = express()

app.set('trust proxy', 1)

app.use(cors({
  origin: config.corsOrigins,
  credentials: true
}))
app.use(express.json({ limit: '100kb' }))

app.get('/', (req, res) => {
  res.json({ message: 'FidApp API is running 🚀' })
})

app.use('/api/client', strictLimiter, clientRoutes)
app.use('/api/auth', strictLimiter, authRoutes)
app.use('/api/checkin', strictLimiter, checkinRoutes)
app.use('/api/qrcode', generalLimiter, qrcodeRoutes)
app.use('/api/stats', generalLimiter, statsRoutes)
app.use('/api/rewards', generalLimiter, rewardRoutes)
app.use('/api/admin', generalLimiter, adminRoutes)

const PORT = process.env.PORT || 3000
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})
