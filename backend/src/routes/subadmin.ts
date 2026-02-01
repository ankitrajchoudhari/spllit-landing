import express, { Request, Response } from 'express';
import prisma from '../utils/prisma.js';
import bcrypt from 'bcrypt';
import { authenticate, AuthRequest } from '../middleware/auth.js';

const router = express.Router();

// Allowed email domains for security
const ALLOWED_EMAIL_DOMAINS = [
    'gmail.com',
    'yahoo.com',
    'outlook.com',
    'hotmail.com',
    'zoho.com',
    'protonmail.com',
    'icloud.com',
    'aol.com',
    'mail.com',
    // Educational domains
    'edu',
    'ac.in',
    'iitm.ac.in'
];

/**
 * Validate email domain
 */
const isValidEmailDomain = (email: string): boolean => {
    const domain = email.split('@')[1]?.toLowerCase();
    if (!domain) return false;
    
    // Check if domain matches allowed domains or ends with allowed educational TLDs
    return ALLOWED_EMAIL_DOMAINS.some(allowed => 
        domain === allowed || domain.endsWith(`.${allowed}`)
    );
};

/**
 * Check if user is master admin
 */
const isMasterAdmin = async (userId: string): Promise<boolean> => {
    const user = await prisma.user.findUnique({
        where: { id: userId }
    });
    return user?.role === 'admin' && user.isAdmin === true;
};

/**
 * POST /api/subadmin/create
 * Master admin creates a subadmin
 */
router.post('/create', authenticate, async (req: AuthRequest, res: Response) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        // Check if requester is master admin
        const isMaster = await isMasterAdmin(req.user.userId);
        if (!isMaster) {
            return res.status(403).json({ error: 'Only master admin can create subadmins' });
        }

        const { name, email, password, college, gender, phone } = req.body;

        // Validate required fields
        if (!name || !email || !password) {
            return res.status(400).json({ error: 'Name, email, and password are required' });
        }

        // Validate email domain
        if (!isValidEmailDomain(email)) {
            return res.status(400).json({ 
                error: 'Email must be from a verified provider (Gmail, Yahoo, Outlook, Zoho, etc.)' 
            });
        }

        // Check if email already exists (including deleted admins)
        const existingUser = await prisma.user.findUnique({
            where: { email: email.toLowerCase() }
        });

        if (existingUser) {
            // If admin is deleted, allow recreation
            if (existingUser.adminStatus === 'deleted') {
                // Reactivate the deleted admin
                const reactivatedAdmin = await prisma.user.update({
                    where: { id: existingUser.id },
                    data: {
                        name,
                        password: await bcrypt.hash(password, 10),
                        college: college || existingUser.college,
                        gender: gender || existingUser.gender,
                        phone: phone || existingUser.phone,
                        role: 'subadmin',
                        isAdmin: true,
                        adminStatus: 'active',
                        isActive: true,
                        createdBy: req.user.userId,
                        updatedAt: new Date()
                    },
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        college: true,
                        role: true,
                        adminStatus: true,
                        createdAt: true
                    }
                });

                return res.status(200).json({
                    message: 'Subadmin reactivated successfully',
                    subadmin: reactivatedAdmin
                });
            } else {
                return res.status(400).json({ 
                    error: 'Admin with this email already exists' 
                });
            }
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);
        
        // Create phone hash (simple hash for now)
        const phoneHash = phone ? await bcrypt.hash(phone, 10) : await bcrypt.hash(email, 10);

        // Create subadmin
        const subadmin = await prisma.user.create({
            data: {
                name,
                email: email.toLowerCase(),
                password: hashedPassword,
                phone: phone || '',
                phoneHash,
                college: college || 'Spllit Admin',
                gender: gender || 'other',
                role: 'subadmin',
                isAdmin: true,
                adminStatus: 'active',
                emailVerified: true, // Auto-verify for admins
                phoneVerified: true,
                isActive: true,
                createdBy: req.user?.userId || null
            },
            select: {
                id: true,
                name: true,
                email: true,
                college: true,
                role: true,
                isAdmin: true,
                adminStatus: true,
                createdAt: true
            }
        });

        res.status(201).json({
            message: 'Subadmin created successfully',
            subadmin
        });
    } catch (error) {
        console.error('Create subadmin error:', error);
        res.status(500).json({ 
            error: 'Failed to create subadmin',
            details: error.message || 'Unknown error'
        });
    }
});

/**
 * GET /api/subadmin/list
 * Master admin lists all subadmins
 */
router.get('/list', authenticate, async (req: AuthRequest, res: Response) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        // Check if requester is master admin
        const isMaster = await isMasterAdmin(req.user.userId);
        if (!isMaster) {
            return res.status(403).json({ error: 'Only master admin can view subadmins' });
        }

        // Get all subadmins (excluding deleted ones by default)
        const subadmins = await prisma.user.findMany({
            where: {
                role: 'subadmin',
                adminStatus: {
                    not: 'deleted'
                }
            },
            select: {
                id: true,
                name: true,
                email: true,
                college: true,
                role: true,
                adminStatus: true,
                isActive: true,
                lastSeen: true,
                createdAt: true,
                updatedAt: true
            },
            orderBy: {
                createdAt: 'desc'
            }
        });

        res.json({ subadmins });
    } catch (error) {
        console.error('List subadmins error:', error);
        res.status(500).json({ error: 'Failed to list subadmins' });
    }
});

/**
 * PUT /api/subadmin/:id/deactivate
 * Master admin deactivates a subadmin
 */
router.put('/:id/deactivate', authenticate, async (req: AuthRequest, res: Response) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        // Check if requester is master admin
        const isMaster = await isMasterAdmin(req.user.userId);
        if (!isMaster) {
            return res.status(403).json({ error: 'Only master admin can deactivate subadmins' });
        }

        const { id } = req.params;

        // Check if subadmin exists
        const subadmin = await prisma.user.findUnique({
            where: { id }
        });

        if (!subadmin || subadmin.role !== 'subadmin') {
            return res.status(404).json({ error: 'Subadmin not found' });
        }

        // Deactivate subadmin
        const updated = await prisma.user.update({
            where: { id },
            data: {
                adminStatus: 'inactive',
                isActive: false,
                updatedAt: new Date()
            },
            select: {
                id: true,
                name: true,
                email: true,
                adminStatus: true,
                isActive: true
            }
        });

        res.json({
            message: 'Subadmin deactivated successfully',
            subadmin: updated
        });
    } catch (error) {
        console.error('Deactivate subadmin error:', error);
        res.status(500).json({ error: 'Failed to deactivate subadmin' });
    }
});

/**
 * PUT /api/subadmin/:id/activate
 * Master admin activates a subadmin
 */
router.put('/:id/activate', authenticate, async (req: AuthRequest, res: Response) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        // Check if requester is master admin
        const isMaster = await isMasterAdmin(req.user.userId);
        if (!isMaster) {
            return res.status(403).json({ error: 'Only master admin can activate subadmins' });
        }

        const { id } = req.params;

        // Check if subadmin exists
        const subadmin = await prisma.user.findUnique({
            where: { id }
        });

        if (!subadmin || subadmin.role !== 'subadmin') {
            return res.status(404).json({ error: 'Subadmin not found' });
        }

        // Activate subadmin
        const updated = await prisma.user.update({
            where: { id },
            data: {
                adminStatus: 'active',
                isActive: true,
                updatedAt: new Date()
            },
            select: {
                id: true,
                name: true,
                email: true,
                adminStatus: true,
                isActive: true
            }
        });

        res.json({
            message: 'Subadmin activated successfully',
            subadmin: updated
        });
    } catch (error) {
        console.error('Activate subadmin error:', error);
        res.status(500).json({ error: 'Failed to activate subadmin' });
    }
});

/**
 * DELETE /api/subadmin/:id
 * Master admin permanently deletes a subadmin
 */
router.delete('/:id', authenticate, async (req: AuthRequest, res: Response) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        // Check if requester is master admin
        const isMaster = await isMasterAdmin(req.user.userId);
        if (!isMaster) {
            return res.status(403).json({ error: 'Only master admin can delete subadmins' });
        }

        const { id } = req.params;

        // Check if subadmin exists
        const subadmin = await prisma.user.findUnique({
            where: { id }
        });

        if (!subadmin || subadmin.role !== 'subadmin') {
            return res.status(404).json({ error: 'Subadmin not found' });
        }

        // Soft delete by marking as deleted (allows email reuse)
        await prisma.user.update({
            where: { id },
            data: {
                adminStatus: 'deleted',
                isActive: false,
                email: `deleted_${Date.now()}_${subadmin.email}`, // Modify email to allow reuse
                updatedAt: new Date()
            }
        });

        res.json({
            message: 'Subadmin deleted successfully. Email can be reused for new admin.'
        });
    } catch (error) {
        console.error('Delete subadmin error:', error);
        res.status(500).json({ error: 'Failed to delete subadmin' });
    }
});

/**
 * PUT /api/subadmin/:id/update
 * Master admin updates subadmin details
 */
router.put('/:id/update', authenticate, async (req: AuthRequest, res: Response) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        // Check if requester is master admin
        const isMaster = await isMasterAdmin(req.user.userId);
        if (!isMaster) {
            return res.status(403).json({ error: 'Only master admin can update subadmins' });
        }

        const { id } = req.params;
        const { name, password, college, gender, phone } = req.body;

        // Check if subadmin exists
        const subadmin = await prisma.user.findUnique({
            where: { id }
        });

        if (!subadmin || subadmin.role !== 'subadmin') {
            return res.status(404).json({ error: 'Subadmin not found' });
        }

        // Prepare update data
        const updateData: any = {
            updatedAt: new Date()
        };

        if (name) updateData.name = name;
        if (college) updateData.college = college;
        if (gender) updateData.gender = gender;
        if (phone) updateData.phone = phone;
        if (password) updateData.password = await bcrypt.hash(password, 10);

        // Update subadmin
        const updated = await prisma.user.update({
            where: { id },
            data: updateData,
            select: {
                id: true,
                name: true,
                email: true,
                college: true,
                role: true,
                adminStatus: true,
                updatedAt: true
            }
        });

        res.json({
            message: 'Subadmin updated successfully',
            subadmin: updated
        });
    } catch (error) {
        console.error('Update subadmin error:', error);
        res.status(500).json({ error: 'Failed to update subadmin' });
    }
});

export default router;
