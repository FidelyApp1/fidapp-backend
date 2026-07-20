const DEFAULT_CORS_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:5175'
]

const config = {
  clientAppUrl: process.env.CLIENT_APP_URL || 'http://localhost:5173',
  allowPublicRegister: process.env.ALLOW_PUBLIC_REGISTER === 'true',
  corsOrigins: process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(',').map((origin) => origin.trim()).filter(Boolean)
    : DEFAULT_CORS_ORIGINS,
  isProduction: process.env.NODE_ENV === 'production',
  smsConfigured: Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_PHONE_NUMBER)
}

module.exports = config
