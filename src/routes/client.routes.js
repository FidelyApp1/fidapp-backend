const express = require('express')
const { getClientProfile } = require('../controllers/client.controller')

const router = express.Router()

router.get('/profile/:phone', getClientProfile)

module.exports = router