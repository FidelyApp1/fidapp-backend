const rateLimit = require('express-rate-limit')

const strictLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Trop de requêtes, merci de réessayer dans une minute.' }
})

const generalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Trop de requêtes, merci de réessayer dans une minute.' }
})

module.exports = { strictLimiter, generalLimiter }
