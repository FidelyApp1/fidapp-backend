const express = require('express')
const {
  adminLogin,
  getRestaurants,
  createRestaurant,
  updateRestaurant,
  deleteRestaurant,
  getRestaurantStats
} = require('../controllers/admin.controller')
const adminMiddleware = require('../middleware/admin.middleware')

const router = express.Router()

router.post('/login', adminLogin)
router.get('/restaurants', adminMiddleware, getRestaurants)
router.post('/restaurants', adminMiddleware, createRestaurant)
router.put('/restaurants/:id', adminMiddleware, updateRestaurant)
router.delete('/restaurants/:id', adminMiddleware, deleteRestaurant)
router.get('/restaurants/:id/stats', adminMiddleware, getRestaurantStats)

module.exports = router