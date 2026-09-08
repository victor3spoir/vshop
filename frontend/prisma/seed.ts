// Seeds a default admin user through better-auth so the password hash and
// account rows match what the auth runtime expects.
import { auth } from '../src/lib/auth'
import { prisma } from '../src/lib/prisma'

const ADMIN_EMAIL = 'admin@vshop.local'
const ADMIN_PASSWORD = 'admin1234'

async function main() {
  console.log('Seeding admin user...')

  const existing = await prisma.user.findUnique({
    where: { email: ADMIN_EMAIL },
  })

  if (!existing) {
    await auth.api.createUser({
      body: {
        email: ADMIN_EMAIL,
        password: ADMIN_PASSWORD,
        name: 'Admin',
        role: 'admin',
      },
    })
    console.log(`Created admin ${ADMIN_EMAIL} (password: ${ADMIN_PASSWORD})`)
  } else {
    await prisma.user.update({
      where: { email: ADMIN_EMAIL },
      data: { role: 'admin' },
    })
    console.log(`Admin ${ADMIN_EMAIL} already exists; role ensured.`)
  }
}

main()
  .catch((e) => {
    console.error('Seed failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
