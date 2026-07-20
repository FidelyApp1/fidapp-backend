const express = require('express')
const { getPendingRewards, redeemReward } = require('../controllers/reward.controller')
const authMiddleware = require('../middleware/auth.middleware')

const router = express.Router()

router.get('/pending', authMiddleware, getPendingRewards)
router.post('/:id/redeem', authMiddleware, redeemReward)

module.exports = router
