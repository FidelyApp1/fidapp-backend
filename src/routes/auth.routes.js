const express = require('express')
const { register, login, getMe, updateSettings } = require('../controllers/auth.controller')
const authMiddleware = require('../middleware/auth.middleware')
const validate = require('../middleware/validate.middleware')
const { loginSchema, registerSchema, updateSettingsSchema } = require('../lib/validators')

const router = express.Router()

router.get('/me', authMiddleware, getMe)
router.post('/register', validate(registerSchema), register)
router.post('/login', validate(loginSchema), login)
router.put('/settings', authMiddleware, validate(updateSettingsSchema), updateSettings)

module.exports = router
