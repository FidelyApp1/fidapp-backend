const express = require('express')
const { generateQrCode, getMyQrCodes } = require('../controllers/qrcode.controller')
const authMiddleware = require('../middleware/auth.middleware')

const router = express.Router()

router.post('/generate', authMiddleware, generateQrCode)
router.get('/mine', authMiddleware, getMyQrCodes)

module.exports = router