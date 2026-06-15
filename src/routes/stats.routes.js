const express = require('express')
const { getStats } = require('../controllers/stats.controller')
const authMiddleware = require('../middleware/auth.middleware')

const router = express.Router()

router.get('/', authMiddleware, getStats)

module.exports = router