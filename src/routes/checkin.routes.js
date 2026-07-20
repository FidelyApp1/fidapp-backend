const express = require('express')
const { checkin } = require('../controllers/checkin.controller')
const validate = require('../middleware/validate.middleware')
const { checkinSchema } = require('../lib/validators')

const router = express.Router()

router.post('/', validate(checkinSchema), checkin)

module.exports = router
