const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')

const prisma = new PrismaClient()

async function main() {
  const hash = await bcrypt.hash('FidAdmin2024!', 10)
  const admin = await prisma.admin.create({
    data: {
      email: 'admin@fidapp.ma',
      password: hash
    }
  })
  console.log('Admin créé:', admin.email)
  await prisma.$disconnect()
}

main()