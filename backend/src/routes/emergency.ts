import { Router, Response } from 'express';
import { z } from 'zod';
import prisma from '../utils/prisma.js';
import { authenticate } from '../middleware/auth.js';
import { AuthRequest } from '../types/express.js';
import { io } from '../server.js';
import { deprecated } from '../middleware/deprecation.js';
import { isLegacyAdmin } from '../services/legacyAdmin.js';

/** The token payload `authenticate` attached — a master token has `adminId`. */
const callerOf = (req: AuthRequest) => req.user as { userId?: string; adminId?: string } | undefined;

const router = Router();

/** Deprecated router — usage is recorded so deletion can be justified by
 *  runtime evidence. See docs/DEPRECATION-POLICY.md. */
router.use(deprecated('emergency'));

const sosSchema = z.object({
  location: z.object({
    lat: z.number(),
    lng: z.number()
  }),
  message: z.string().optional(),
  emergencyType: z.enum(['accident', 'harassment', 'medical', 'other']).optional()
});

/**
 * POST /api/emergency/sos
 * Create an emergency SOS alert
 */
router.post('/sos', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const data = sosSchema.parse(req.body);

    // Get user details
    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        college: true
      }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Create emergency record
    const emergency = await prisma.emergency.create({
      data: {
        userId: user.id,
        locationLat: data.location.lat,
        locationLng: data.location.lng,
        message: data.message || 'Emergency SOS triggered',
        emergencyType: data.emergencyType || 'other',
        status: 'active'
      }
    });

    // Emit Socket.IO event to admin dashboard
    io.emit('emergency-sos', {
      id: emergency.id,
      userName: user.name,
      userPhone: user.phone,
      userEmail: user.email,
      college: user.college,
      location: {
        lat: data.location.lat,
        lng: data.location.lng
      },
      message: emergency.message,
      emergencyType: emergency.emergencyType,
      timestamp: emergency.createdAt,
      status: 'active'
    });

    res.status(201).json({
      message: 'Emergency SOS sent successfully',
      emergency: {
        id: emergency.id,
        status: emergency.status,
        timestamp: emergency.createdAt
      }
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors });
    }
    console.error('Emergency SOS error:', error);
    res.status(500).json({ error: 'Failed to send emergency alert' });
  }
});

/**
 * PATCH /api/emergency/:id/status
 * Update emergency status (admin only)
 */
router.patch('/:id/status', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { id } = req.params;
    const { status } = req.body;

    const validStatuses = ['active', 'acknowledged', 'resolved', 'false-alarm'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    /**
     * Admins may set any status. The person who raised the alert may only
     * stand it down — a false alarm or "I'm safe" — never acknowledge it on the
     * responders' behalf. This checked only for a login, so anyone could close
     * a stranger's live emergency.
     */
    const caller = callerOf(req);
    if (!(await isLegacyAdmin(caller ?? {}))) {
      const owned = await prisma.emergency.findFirst({
        where: { id, userId: caller?.userId ?? '' },
        select: { id: true },
      });
      if (!owned || !['resolved', 'false-alarm'].includes(status)) {
        return res.status(403).json({ error: 'Admin access required' });
      }
    }

    const emergency = await prisma.emergency.update({
      where: { id },
      data: { 
        status,
        resolvedAt: status === 'resolved' ? new Date() : null
      },
      include: {
        user: {
          select: {
            name: true,
            email: true
          }
        }
      }
    });

    // Emit update to admin dashboard
    io.emit('emergency-status-updated', {
      id: emergency.id,
      status: emergency.status,
      resolvedAt: emergency.resolvedAt
    });

    res.json({
      message: 'Emergency status updated',
      emergency
    });
  } catch (error) {
    console.error('Update emergency status error:', error);
    res.status(500).json({ error: 'Failed to update emergency status' });
  }
});

/**
 * GET /api/emergency
 * Get all active emergencies (admin only)
 */
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Names, phones, emails and live locations of people in trouble. This
    // said "admin only" and checked only for a login.
    if (!(await isLegacyAdmin(callerOf(req) ?? {}))) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const emergencies = await prisma.emergency.findMany({
      where: {
        status: {
          in: ['active', 'acknowledged']
        }
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            phone: true,
            email: true,
            college: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    res.json({ emergencies });
  } catch (error) {
    console.error('Get emergencies error:', error);
    res.status(500).json({ error: 'Failed to fetch emergencies' });
  }
});

export default router;
