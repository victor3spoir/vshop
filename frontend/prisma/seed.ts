// Seeds a default admin user through better-auth so the password hash and
// account rows match what the auth runtime expects.
import { auth } from '../src/lib/auth'
import { prisma } from '../src/lib/prisma'



async function main() {
  console.log('Seeding admin user...')


}

main()
  .catch((e) => {
    console.error('Seed failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
