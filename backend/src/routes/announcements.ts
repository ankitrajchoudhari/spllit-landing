import { Router, Response } from 'express';
import { z } from 'zod';
import jwt from 'jsonwebtoken';
import prisma from '../utils/prisma.js';
import { authenticate } from '../middleware/auth.js';
import { AuthRequest, AdminRequest } from '../types/express.js';
import { io } from '../server.js';

const router = Router();

const createAnnouncementSchema = z.object({
  title: z.string().trim().min(3).max(120),
  message: z.string().trim().min(5).max(500),
  location: z.string().trim().min(2).max(120),
  imageUrl: z.string().trim().optional().nullable(),
  imageAlt: z.string().trim().max(140).optional().nullable()
});

const authenticateAdmin = async (req: AdminRequest, res: Response, next: any) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'Admin authentication required' });
    }

    const decoded: any = jwt.verify(token, process.env.JWT_SECRET!);

    if (decoded.adminId) {
      const admin = await prisma.admin.findUnique({ where: { id: decoded.adminId } });

      if (!admin || !admin.isActive) {
        return res.status(401).json({ error: 'Invalid admin credentials' });
      }

      req.admin = { id: admin.id, email: admin.email, role: admin.role };
      return next();
    }

    if (decoded.userId) {
      const subadmin = await prisma.user.findUnique({ where: { id: decoded.userId } });

      if (!subadmin || subadmin.role !== 'subadmin' || !subadmin.isAdmin) {
        return res.status(401).json({ error: 'Invalid admin credentials' });
      }

      if (subadmin.adminStatus !== 'active' || !subadmin.isActive) {
        return res.status(403).json({ error: 'Subadmin account is not active' });
      }

      req.admin = { id: subadmin.id, email: subadmin.email, role: subadmin.role };
      return next();
    }

    return res.status(401).json({ error: 'Invalid admin token' });
  } catch (error) {
    console.error('Announcement admin auth error:', error);
    res.status(401).json({ error: 'Invalid admin token' });
  }
};

router.get('/', authenticate, async (_req: AuthRequest, res: Response) => {
  try {
    const announcements = await prisma.announcement.findMany({
      orderBy: { createdAt: 'desc' },
      take: 20
    });

    res.json({ announcements });
  } catch (error) {
    console.error('Get announcements error:', error);
    res.status(500).json({ error: 'Failed to fetch announcements' });
  }
});

router.post('/', authenticateAdmin, async (req: AdminRequest, res: Response) => {
  try {
    const data = createAnnouncementSchema.parse(req.body);

    const announcement = await prisma.announcement.create({
      data: {
        title: data.title,
        message: data.message,
        location: data.location,
        imageUrl: data.imageUrl || null,
        imageAlt: data.imageAlt || null,
        createdById: req.admin!.id,
        createdByName: req.admin!.email,
        createdByRole: req.admin!.role
      }
    });

    io.emit('new-admin-announcement', { announcement });

    res.status(201).json({
      message: 'Announcement created successfully',
      announcement
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors });
    }

    console.error('Create announcement error:', error);
    res.status(500).json({ error: 'Failed to create announcement' });
  }
});

export default router;