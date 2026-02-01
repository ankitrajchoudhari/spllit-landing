import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function checkAdminTable() {
  try {
    console.log('\n=== CHECKING ADMIN TABLE ===\n');
    
    const admins = await prisma.admin.findMany();
    
    console.log(`Found ${admins.length} admin(s) in ADMIN table:\n`);
    
    admins.forEach((admin, index) => {
      console.log(`${index + 1}. ${admin.name}`);
      console.log(`   ID: ${admin.id}`);
      console.log(`   Email: ${admin.email}`);
      console.log(`   Role: ${admin.role}`);
      console.log(`   isActive: ${admin.isActive}`);
      console.log(`   Last Login: ${admin.lastLogin}`);
      console.log('');
    });
    
    // Check if saurav exists in admin table
    const sauravAdmin = await prisma.admin.findUnique({
      where: { email: 'saurav@spllit.app' }
    });
    
    if (sauravAdmin) {
      console.log('⚠️ FOUND saurav@spllit.app IN ADMIN TABLE!');
      console.log('This is blocking login! Deleting...');
      
      await prisma.admin.delete({
        where: { email: 'saurav@spllit.app' }
      });
      console.log('✅ Deleted saurav from admin table');
    }
    
    // Check co-founder
    const rounakAdmin = await prisma.admin.findUnique({
      where: { email: 'co-founder@spllit.app' }
    });
    
    if (rounakAdmin) {
      console.log('⚠️ FOUND co-founder@spllit.app IN ADMIN TABLE!');
      console.log('This is blocking login! Deleting...');
      
      await prisma.admin.delete({
        where: { email: 'co-founder@spllit.app' }
      });
      console.log('✅ Deleted co-founder from admin table');
    }
    
    await prisma.$disconnect();
  } catch (error) {
    console.error('Error:', error);
    await prisma.$disconnect();
  }
}

checkAdminTable();
