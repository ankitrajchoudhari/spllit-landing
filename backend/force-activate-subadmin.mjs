import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function activateSubadmin() {
  try {
    const subadmin = await prisma.user.findUnique({
      where: { email: 'sauravkumar@spllit.app' }
    });

    if (!subadmin) {
      console.error('❌ Subadmin not found!');
      process.exit(1);
    }

    console.log('📊 Current status:', {
      email: subadmin.email,
      adminStatus: subadmin.adminStatus,
      isActive: subadmin.isActive,
      role: subadmin.role,
      isAdmin: subadmin.isAdmin
    });

    const updated = await prisma.user.update({
      where: { email: 'sauravkumar@spllit.app' },
      data: {
        adminStatus: 'active',
        isActive: true,
        role: 'subadmin',
        isAdmin: true
      }
    });

    console.log('\n✅ Subadmin activated successfully!');
    console.log('📊 New status:', {
      email: updated.email,
      adminStatus: updated.adminStatus,
      isActive: updated.isActive,
      role: updated.role,
      isAdmin: updated.isAdmin
    });

    await prisma.$disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

activateSubadmin();
