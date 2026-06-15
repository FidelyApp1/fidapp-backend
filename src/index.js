const express = require('express')
const cors = require('cors')
require('dotenv').config()

const authRoutes = require('./routes/auth.routes')
const checkinRoutes = require('./routes/checkin.routes')
const qrcodeRoutes = require('./routes/qrcode.routes')
const statsRoutes = require('./routes/stats.routes')

const app = express()

app.use(cors({
  origin: [
    'http://localhost:5173',
    'http://localhost:5174',
    'http://192.168.11.111:5173',
    'http://192.168.11.111:5174'
  ],
  credentials: true
}))
app.use(express.json())

app.get('/', (req, res) => {
  res.json({ message: 'FidApp API is running 🚀' })
})

app.use('/api/auth', authRoutes)
app.use('/api/checkin', checkinRoutes)
app.use('/api/qrcode', qrcodeRoutes)
app.use('/api/stats', statsRoutes)
const PORT = process.env.PORT || 3000
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})