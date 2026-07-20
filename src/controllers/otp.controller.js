const prisma = require('../lib/prisma')
const { normalizePhone } = require('../lib/phone')
const { generateOtpCode, hashOtpCode, sendOtpSms } = require('../lib/otp')

const OTP_EXPIRY_MINUTES = 5
const OTP_RESEND_SECONDS = 60
const MAX_OTP_ATTEMPTS = 5

const sendOtp = async (req, res) => {
  const { phone } = req.body

  try {
    const normalizedPhone = normalizePhone(phone)
    if (!normalizedPhone) {
      return res.status(400).json({
        error: 'invalid_phone',
        message: 'Veuillez entrer un numéro de téléphone marocain valide.'
      })
    }

    const recentOtp = await prisma.otpCode.findFirst({
      where: {
        phone: normalizedPhone,
        createdAt: { gte: new Date(Date.now() - OTP_RESEND_SECONDS * 1000) }
      },
      orderBy: { createdAt: 'desc' }
    })

    if (recentOtp) {
      return res.status(429).json({
        error: 'otp_cooldown',
        message: `Attendez ${OTP_RESEND_SECONDS} secondes avant de demander un nouveau code.`
      })
    }

    const code = generateOtpCode()
    const codeHash = await hashOtpCode(code)

    await prisma.otpCode.deleteMany({ where: { phone: normalizedPhone } })

    await prisma.otpCode.create({
      data: {
        phone: normalizedPhone,
        codeHash,
        expiresAt: new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000)
      }
    })

    const smsResult = await sendOtpSms(normalizedPhone, code)

    const payload = {
      success: true,
      message: 'Code envoyé par SMS.',
      expiresInSeconds: OTP_EXPIRY_MINUTES * 60
    }

    if (smsResult.devOtp) {
      payload.devOtp = smsResult.devOtp
    }

    res.json(payload)
  } catch (err) {
    if (err.message === 'SMS provider not configured') {
      return res.status(503).json({
        error: 'sms_unavailable',
        message: 'Envoi SMS indisponible. Contactez le support FidApp.'
      })
    }

    res.status(500).json({ error: 'Erreur serveur' })
  }
}

const verifyOtpForPhone = async (phone, otpCode) => {
  const otpRecord = await prisma.otpCode.findFirst({
    where: {
      phone,
      expiresAt: { gt: new Date() }
    },
    orderBy: { createdAt: 'desc' }
  })

  if (!otpRecord) {
    return { ok: false, error: 'otp_expired', message: 'Code expiré — demandez un nouveau code.' }
  }

  if (otpRecord.attempts >= MAX_OTP_ATTEMPTS) {
    return { ok: false, error: 'otp_locked', message: 'Trop de tentatives — demandez un nouveau code.' }
  }

  const { verifyOtpCode } = require('../lib/otp')
  const valid = await verifyOtpCode(otpCode, otpRecord.codeHash)

  if (!valid) {
    await prisma.otpCode.update({
      where: { id: otpRecord.id },
      data: { attempts: { increment: 1 } }
    })
    return { ok: false, error: 'otp_invalid', message: 'Code incorrect.' }
  }

  await prisma.otpCode.delete({ where: { id: otpRecord.id } })
  return { ok: true }
}

module.exports = { sendOtp, verifyOtpForPhone, OTP_RESEND_SECONDS }
