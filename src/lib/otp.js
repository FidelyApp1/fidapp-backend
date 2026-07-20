const crypto = require('crypto')
const bcrypt = require('bcryptjs')
const config = require('./config')

const generateOtpCode = () => crypto.randomInt(100000, 999999).toString()

const hashOtpCode = (code) => bcrypt.hash(code, 10)

const verifyOtpCode = (code, hash) => bcrypt.compare(code, hash)

async function sendOtpSms(phone, code) {
  const message = `Votre code FidApp : ${code}. Valide 5 minutes.`

  if (config.smsConfigured) {
    const accountSid = process.env.TWILIO_ACCOUNT_SID
    const authToken = process.env.TWILIO_AUTH_TOKEN
    const from = process.env.TWILIO_PHONE_NUMBER
    const to = phone.startsWith('+') ? phone : `+212${phone.replace(/^0/, '')}`

    const params = new URLSearchParams({
      To: to,
      From: from,
      Body: message
    })

    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: params
      }
    )

    if (!response.ok) {
      throw new Error('SMS delivery failed')
    }

    return { sent: true }
  }

  if (!config.isProduction) {
    console.log(`[DEV OTP] ${phone} → ${code}`)
    return { sent: true, devOtp: code }
  }

  throw new Error('SMS provider not configured')
}

module.exports = {
  generateOtpCode,
  hashOtpCode,
  verifyOtpCode,
  sendOtpSms
}
