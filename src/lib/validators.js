const { z } = require('zod')

const phoneSchema = z.string().min(9).max(20)

const checkinSchema = z.object({
  phone: phoneSchema,
  qrCode: z.string().min(10),
  name: z.string().trim().min(1).max(50),
  otpCode: z.string().length(6).regex(/^\d{6}$/, 'Code OTP invalide')
})

const sendOtpSchema = z.object({
  phone: phoneSchema
})

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6).max(100)
})

const registerSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().email(),
  password: z.string().min(8).max(100),
  phone: z.string().optional(),
  address: z.string().max(200).optional()
})

const updateSettingsSchema = z.object({
  name: z.string().trim().min(2).max(100).optional(),
  phone: z.string().max(20).optional(),
  address: z.string().max(200).optional(),
  sector: z.string().max(50).optional(),
  checksRequired: z.coerce.number().int().min(1).max(50).optional(),
  scanDelayHours: z.coerce.number().int().min(0).max(168).optional(),
  rewardTitle: z.string().max(100).optional(),
  rewardDesc: z.string().max(200).optional(),
  rewardEmoji: z.string().max(4).optional()
})

module.exports = {
  checkinSchema,
  sendOtpSchema,
  loginSchema,
  registerSchema,
  updateSettingsSchema
}
