import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function test() {
  // Check admin table for EXACT email
  const adminSaurav = await prisma.admin.findUnique({
    where: { email: 'saurav@spllit.app' }
  });
  
  console.log('Admin table - saurav@spllit.app:', adminSaurav ? 'FOUND' : 'NOT FOUND');
  if (adminSaurav) {
    console.log('  isActive:', adminSaurav.isActive);
  }
  
  // Check users table for EXACT email
  const userSaurav = await prisma.user.findUnique({
    where: { email: 'saurav@spllit.app' }
  });
  
  console.log('Users table - saurav@spllit.app:', userSaurav ? 'FOUND' : 'NOT FOUND');
  if (userSaurav) {
    console.log('  role:', userSaurav.role);
    console.log('  isAdmin:', userSaurav.isAdmin);
    console.log('  adminStatus:', userSaurav.adminStatus);
    console.log('  isActive:', userSaurav.isActive);
  }

  await prisma.$disconnect();
}

test();
