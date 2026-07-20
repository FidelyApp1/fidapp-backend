const express = require('express')
const { getClientProfile } = require('../controllers/client.controller')
const { sendOtp } = require('../controllers/otp.controller')
const clientSessionMiddleware = require('../middleware/clientSession.middleware')
const validate = require('../middleware/validate.middleware')
const { sendOtpSchema } = require('../lib/validators')

const router = express.Router()

router.post('/otp/send', validate(sendOtpSchema), sendOtp)
router.get('/me', clientSessionMiddleware, getClientProfile)

module.exports = router
