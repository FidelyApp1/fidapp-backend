const express = require('express')
const {
  adminLogin, getGlobalStats, getRestaurants, createRestaurant,
  updateRestaurant, resetPassword, deleteRestaurant, getRestaurantStats,
  getAllClients, getAllCheckins, getAllRewards, updateAdminPassword
} = require('../controllers/admin.controller')
const adminMiddleware = require('../middleware/admin.middleware')

const router = express.Router()

router.post('/login', adminLogin)
router.get('/stats', adminMiddleware, getGlobalStats)
router.get('/restaurants', adminMiddleware, getRestaurants)
router.post('/restaurants', adminMiddleware, createRestaurant)
router.put('/restaurants/:id', adminMiddleware, updateRestaurant)
router.post('/restaurants/:id/reset-password', adminMiddleware, resetPassword)
router.delete('/restaurants/:id', adminMiddleware, deleteRestaurant)
router.get('/restaurants/:id/stats', adminMiddleware, getRestaurantStats)
router.get('/clients', adminMiddleware, getAllClients)
router.get('/checkins', adminMiddleware, getAllCheckins)
router.get('/rewards', adminMiddleware, getAllRewards)
router.put('/me/password', adminMiddleware, updateAdminPassword)

module.exports = router