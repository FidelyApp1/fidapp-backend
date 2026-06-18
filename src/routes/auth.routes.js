const express = require('express')
const { register, login, getMe, updateSettings } = require('../controllers/auth.controller')

const authMiddleware = require('../middleware/auth.middleware')

const router = express.Router()
router.get('/me', authMiddleware, getMe)
router.post('/register', register)
router.post('/login', login)
router.put('/settings', authMiddleware, updateSettings)
module.exports = router