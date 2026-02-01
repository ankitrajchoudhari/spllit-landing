import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function setupAdmin() {
    try {
        console.log('Setting up master admin...');
        
        // Update ankit@spllit.app to be master admin
        const admin = await prisma.user.update({
            where: { email: 'ankit@spllit.app' },
            data: {
                role: 'admin',
                isAdmin: true,
                adminStatus: 'active'
            }
        });

        console.log('✅ Master admin setup complete!');
        console.log('Admin:', admin.name, '-', admin.email);
        console.log('Role:', admin.role);
        console.log('Is Admin:', admin.isAdmin);
        console.log('Status:', admin.adminStatus);

    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        await prisma.$disconnect();
    }
}

setupAdmin();
