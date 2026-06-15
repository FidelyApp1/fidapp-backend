const express = require('express')
const { checkin } = require('../controllers/checkin.controller')

const router = express.Router()

router.post('/', checkin)

module.exports = router