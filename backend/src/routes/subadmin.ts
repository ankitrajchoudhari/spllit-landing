import express, { Response } from 'express';
import prisma from '../utils/prisma.js';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { io } from '../server.js';
import { AdminRequest } from '../types/express.js';

const router = express.Router();

// Admin authentication middleware
const authenticateAdmin = async (req: AdminRequest, res: Response, next: any) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) {
            return res.status(401).json({ error: 'Admin authentication required' });
        }

        const decoded: any = jwt.verify(token, process.env.JWT_SECRET!);
        
        // Check if it's an admin token (has adminId)
        if (!decoded.adminId) {
            return res.status(401).json({ error: 'Invalid admin token' });
        }

        const admin = await prisma.admin.findUnique({
            where: { id: decoded.adminId }
        });

        if (!admin || !admin.isActive) {
            return res.status(401).json({ error: 'Invalid admin credentials' });
        }

        req.admin = {
            id: admin.id,
            email: admin.email,
            role: admin.role
        };
        
        next();
    } catch (error) {
        console.error('Admin authentication error:', error);
        res.status(401).json({ error: 'Invalid admin token' });
    }
};

// Check if master admin
const requireMaster = (req: AdminRequest, res: Response, next: any) => {
    if (req.admin?.role !== 'master') {
        return res.status(403).json({ error: 'Master admin access required' });
    }
    next();
};

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
    'spllit.app',  // Official Spllit domain
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
 * POST /api/subadmin/create
 * Master admin creates a subadmin
 */
router.post('/create', authenticateAdmin, requireMaster, async (req: AdminRequest, res: Response) => {
    try {

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
                        createdBy: req.admin?.id || null,
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
                createdBy: req.admin?.id || null
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
router.get('/list', authenticateAdmin, requireMaster, async (req: AdminRequest, res: Response) => {
    try {
        console.log('=== GET /list DEBUG ===');
        console.log('Admin from token:', req.admin);
        
        console.log('Fetching subadmins...');
        
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

        console.log('Found subadmins:', subadmins.length);
        
        res.json({ subadmins });
    } catch (error) {
        console.error('=== List subadmins error ===');
        console.error('Error:', error);
        res.status(500).json({ 
            error: 'Failed to list subadmins',
            details: error.message || 'Unknown error'
        });
    }
});

/**
 * PUT /api/subadmin/:id/deactivate
 * Master admin deactivates a subadmin
 */
router.put('/:id/deactivate', authenticateAdmin, requireMaster, async (req: AdminRequest, res: Response) => {
    try {
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

        // Emit real-time update
        io.emit('subadmin-status-changed', {
            id: updated.id,
            email: updated.email,
            name: updated.name,
            status: 'inactive',
            isActive: false,
            timestamp: new Date()
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
router.put('/:id/activate', authenticateAdmin, requireMaster, async (req: AdminRequest, res: Response) => {
    try {
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

        // Emit real-time update
        io.emit('subadmin-status-changed', {
            id: updated.id,
            email: updated.email,
            name: updated.name,
            status: 'active',
            isActive: true,
            timestamp: new Date()
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
router.delete('/:id', authenticateAdmin, requireMaster, async (req: AdminRequest, res: Response) => {
    try {
        const { id } = req.params;

        // Check if subadmin exists
        const subadmin = await prisma.user.findUnique({
            where: { id }
        });

        if (!subadmin || subadmin.role !== 'subadmin') {
            return res.status(404).json({ error: 'Subadmin not found' });
        }

        // Permanently delete the subadmin (hard delete)
        await prisma.user.delete({
            where: { id }
        });

        // Emit real-time update
        io.emit('subadmin-deleted', {
            id: subadmin.id,
            email: subadmin.email,
            name: subadmin.name,
            timestamp: new Date()
        });

        res.json({
            message: 'Subadmin permanently deleted. Email can be reused.'
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
router.put('/:id/update', authenticateAdmin, requireMaster, async (req: AdminRequest, res: Response) => {
    try {
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
