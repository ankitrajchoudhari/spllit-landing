import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function checkAllSubadmins() {
  try {
    console.log('\n=== CHECKING ALL SUBADMINS IN DATABASE ===\n');
    
    const subadmins = await prisma.user.findMany({
      where: {
        OR: [
          { role: 'subadmin' },
          { isAdmin: true }
        ]
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isAdmin: true,
        adminStatus: true,
        isActive: true,
        createdAt: true
      }
    });

    console.log(`Found ${subadmins.length} subadmin(s):\n`);
    
    subadmins.forEach((admin, index) => {
      console.log(`${index + 1}. ${admin.name}`);
      console.log(`   Email: ${admin.email}`);
      console.log(`   Role: ${admin.role}`);
      console.log(`   isAdmin: ${admin.isAdmin}`);
      console.log(`   adminStatus: ${admin.adminStatus}`);
      console.log(`   isActive: ${admin.isActive}`);
      console.log(`   Created: ${admin.createdAt}`);
      console.log(`   ✅ Can Login: ${admin.adminStatus === 'active' && admin.isActive ? 'YES' : 'NO'}\n`);
    });

    // Now activate ALL subadmins
    console.log('=== ACTIVATING ALL SUBADMINS ===\n');
    
    for (const admin of subadmins) {
      if (admin.adminStatus !== 'active' || !admin.isActive) {
        await prisma.user.update({
          where: { id: admin.id },
          data: {
            adminStatus: 'active',
            isActive: true,
            role: 'subadmin',
            isAdmin: true
          }
        });
        console.log(`✅ Activated: ${admin.name} (${admin.email})`);
      } else {
        console.log(`✓ Already active: ${admin.name} (${admin.email})`);
      }
    }

    console.log('\n=== ALL SUBADMINS ARE NOW ACTIVE ===\n');
    
    await prisma.$disconnect();
  } catch (error) {
    console.error('❌ Error:', error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

checkAllSubadmins();
