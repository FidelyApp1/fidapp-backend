const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')

const prisma = new PrismaClient()

async function main() {
  const email = process.env.ADMIN_EMAIL || 'admin@fidapp.ma'
  const password = process.env.ADMIN_PASSWORD

  if (!password) {
    console.error('❌ Définissez ADMIN_PASSWORD dans vos variables d\'environnement.')
    process.exit(1)
  }

  const existing = await prisma.admin.findUnique({ where: { email } })
  if (existing) {
    console.log('Admin déjà existant:', email)
    await prisma.$disconnect()
    return
  }

  const hash = await bcrypt.hash(password, 10)
  const admin = await prisma.admin.create({
    data: { email, password: hash }
  })

  console.log('Admin créé:', admin.email)
  await prisma.$disconnect()
}

main()
