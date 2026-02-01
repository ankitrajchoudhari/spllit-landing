const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function activateSubadmin() {
  try {
    const subadmin = await prisma.user.findUnique({
      where: { email: 'sauravkumar@spllit.app' }
    });

    if (!subadmin) {
      console.error('Subadmin not found!');
      process.exit(1);
    }

    console.log('Current status:', {
      email: subadmin.email,
      adminStatus: subadmin.adminStatus,
      isActive: subadmin.isActive,
      role: subadmin.role
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

    console.log('✅ Subadmin activated!');
    console.log('New status:', {
      email: updated.email,
      adminStatus: updated.adminStatus,
      isActive: updated.isActive,
      role: updated.role,
      isAdmin: updated.isAdmin
    });

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

activateSubadmin();
