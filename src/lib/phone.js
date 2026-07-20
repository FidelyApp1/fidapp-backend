const normalizePhone = (phone) => {
  if (!phone) return null

  const digits = String(phone).replace(/\D/g, '')

  if (digits.length < 9 || digits.length > 13) return null

  if (digits.startsWith('212') && digits.length >= 12) {
    return `0${digits.slice(3)}`
  }

  if (digits.startsWith('0')) {
    return digits
  }

  return `0${digits}`
}

module.exports = { normalizePhone }
