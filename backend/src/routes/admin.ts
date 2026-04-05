import { Router, Request, Response } from 'express';
import { z } from 'zod';
import prisma from '../utils/prisma.js';
import { hashPassword, comparePassword, generateAccessToken } from '../utils/helpers.js';
import jwt from 'jsonwebtoken';
import { io } from '../server.js';

const router = Router();

const STATS_CACHE_TTL_MS = 8000;
let statsCache: { expiresAt: number; payload: any } | null = null;

// Admin auth middleware
const authenticateAdmin = async (req: any, res: Response, next: any) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'Admin authentication required' });
    }

    const decoded: any = jwt.verify(token, process.env.JWT_SECRET!);

    // Master admin token path
    if (decoded.adminId) {
      const admin = await prisma.admin.findUnique({
        where: { id: decoded.adminId }
      });

      if (!admin || !admin.isActive) {
        return res.status(401).json({ error: 'Invalid admin credentials' });
      }

      req.admin = {
        id: admin.id,
        email: admin.email,
        role: admin.role,
        isActive: admin.isActive
      };
      return next();
    }

    // Subadmin token path
    if (decoded.userId) {
      const subadmin = await prisma.user.findUnique({
        where: { id: decoded.userId }
      });

      if (!subadmin || subadmin.role !== 'subadmin' || !subadmin.isAdmin) {
        return res.status(401).json({ error: 'Invalid admin credentials' });
      }

      if (subadmin.adminStatus !== 'active' || !subadmin.isActive) {
        return res.status(403).json({ error: 'Subadmin account is not active' });
      }

      req.admin = {
        id: subadmin.id,
        email: subadmin.email,
        role: subadmin.role,
        isActive: subadmin.isActive
      };
      return next();
    }

    return res.status(401).json({ error: 'Invalid admin token' });
  } catch (error) {
    res.status(401).json({ error: 'Invalid admin token' });
  }
};

// Check if master admin
const requireMaster = (req: any, res: Response, next: any) => {
  if (req.admin.role !== 'master') {
    return res.status(403).json({ error: 'Master admin access required' });
  }
  next();
};

// Admin login schema
const adminLoginSchema = z.object({
  email: z.string().email(),
  password: z.string()
});

// Create admin schema
const createAdminSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().min(2)
});

const createAnnouncementSchema = z.object({
  title: z.string().trim().min(3).max(120),
  message: z.string().trim().min(5).max(500),
  location: z.string().trim().min(2).max(120),
  imageUrl: z.string().trim().optional().nullable(),
  imageAlt: z.string().trim().max(140).optional().nullable()
});

/**
 * POST /api/admin/login
 * Admin login - checks both admin table (master) and users table (subadmins)
 */
router.post('/login', async (req: Request, res: Response) => {
  try {
    const data = adminLoginSchema.parse(req.body);

    // Normalize email to lowercase
    const normalizedEmail = data.email.toLowerCase().trim();

    // First check users table for subadmins (they take priority for @spllit.app emails)
    // Exact match path for clean data.
    let subadmin = await prisma.user.findUnique({
      where: { email: normalizedEmail }
    });

    // Fallback for legacy records that may contain accidental whitespace/case issues.
    if (!subadmin) {
      const candidates = await prisma.user.findMany({
        where: {
          OR: [{ role: 'subadmin' }, { isAdmin: true }],
          email: {
            startsWith: normalizedEmail
          }
        },
        take: 10
      });

      subadmin = candidates.find((u) => u.email?.trim().toLowerCase() === normalizedEmail) || null;
    }

    // If found in users table as subadmin, authenticate from there
    if (subadmin && (subadmin.role === 'subadmin' || subadmin.isAdmin)) {
      // Check if subadmin is active
      if (subadmin.adminStatus === 'inactive') {
        return res.status(403).json({ error: 'SUBADMIN_DEACTIVATED: Your admin account has been deactivated by the master admin.' });
      }

      if (subadmin.adminStatus === 'deleted') {
        return res.status(403).json({ error: 'SUBADMIN_DELETED: This admin account no longer exists.' });
      }

      if (!subadmin.isActive) {
        return res.status(403).json({ error: 'SUBADMIN_INACTIVE: Your account is not active.' });
      }

      // Verify password
      const isValidPassword = await comparePassword(data.password, subadmin.password);
      if (!isValidPassword) {
        return res.status(401).json({ error: 'Invalid admin credentials' });
      }

      // Update last seen
      await prisma.user.update({
        where: { id: subadmin.id },
        data: { lastSeen: new Date() }
      });

      // Generate token for subadmin
      const token = jwt.sign(
        { userId: subadmin.id, email: subadmin.email, role: subadmin.role },
        process.env.JWT_SECRET!,
        { expiresIn: '24h' }
      );

      return res.json({
        message: 'Admin login successful',
        admin: {
          id: subadmin.id,
          email: subadmin.email,
          name: subadmin.name,
          role: subadmin.role
        },
        token
      });
    }

    // Then check admin table (for master admin only)
    let admin = await prisma.admin.findUnique({
      where: { email: normalizedEmail }
    });

    // If master admin doesn't exist, create it on first login
    if (!admin && normalizedEmail === 'ankit@spllit.app') {
      const hashedPassword = await hashPassword('Kurkure123@');
      admin = await prisma.admin.create({
        data: {
          email: 'ankit@spllit.app',
          password: hashedPassword,
          name: 'Ankit (Master Admin)',
          role: 'master'
        }
      });
    }

    // If found in admin table
    if (admin) {
      if (!admin.isActive) {
        return res.status(401).json({ error: 'MASTER_ADMIN_DEACTIVATED: This master admin account is deactivated.' });
      }

      // Verify password
      const isValidPassword = await comparePassword(data.password, admin.password);
      if (!isValidPassword) {
        return res.status(401).json({ error: 'Invalid admin credentials' });
      }

      // Update last login
      await prisma.admin.update({
        where: { id: admin.id },
        data: { lastLogin: new Date() }
      });

      // Generate token
      const token = jwt.sign(
        { adminId: admin.id, email: admin.email, role: admin.role },
        process.env.JWT_SECRET!,
        { expiresIn: '24h' }
      );

      return res.json({
        message: 'Admin login successful',
        admin: {
          id: admin.id,
          email: admin.email,
          name: admin.name,
          role: admin.role
        },
        token
      });
    }

    // Not found in either table
    return res.status(401).json({ error: 'Invalid admin credentials - account not found' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors });
    }
    console.error('Admin login error:', error);
    res.status(500).json({ error: 'Failed to login' });
  }
});

/**
 * GET /api/admin/stats
 * Get dashboard statistics
 */
router.get('/stats', authenticateAdmin, async (req: any, res: Response) => {
  try {
    if (statsCache && Date.now() < statsCache.expiresAt) {
      return res.json(statsCache.payload);
    }

    const [
      totalUsers,
      totalRides,
      totalMatches,
      activeRides,
      pendingMatches,
      todayUsers,
      todayRides,
      earlyAccessCount
    ] = await Promise.all([
      prisma.user.count(),
      prisma.ride.count(),
      prisma.match.count(),
      prisma.ride.count({ where: { status: 'pending' } }),
      prisma.match.count({ where: { status: 'active' } }),
      prisma.user.count({
        where: {
          createdAt: {
            gte: new Date(new Date().setHours(0, 0, 0, 0))
          }
        }
      }),
      prisma.ride.count({
        where: {
          createdAt: {
            gte: new Date(new Date().setHours(0, 0, 0, 0))
          }
        }
      }),
      prisma.earlyAccess.count()
    ]);

    // Get recent activity
    const recentUsers = await prisma.user.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        email: true,
        college: true,
        createdAt: true
      }
    });

    const recentRides = await prisma.ride.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      include: {
        creator: {
          select: { name: true, email: true }
        }
      }
    });

    // Get match status breakdown
    const matchStats = await prisma.match.groupBy({
      by: ['status'],
      _count: true
    });

    // Get rides by vehicle type
    const vehicleStats = await prisma.ride.groupBy({
      by: ['vehicleType'],
      _count: true
    });

    const payload = {
      stats: {
        totalUsers,
        totalRides,
        totalMatches,
        activeRides,
        pendingMatches,
        todayUsers,
        todayRides,
        earlyAccessCount
      },
      recentUsers,
      recentRides,
      matchStats,
      vehicleStats
    };

    statsCache = {
      expiresAt: Date.now() + STATS_CACHE_TTL_MS,
      payload
    };

    res.json(payload);
  } catch (error) {
    console.error('Failed to fetch stats:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

/**
 * GET /api/admin/announcements
 * Fetch admin announcements (admin-authenticated path)
 */
router.get('/announcements', authenticateAdmin, async (_req: any, res: Response) => {
  try {
    const announcements = await prisma.announcement.findMany({
      orderBy: { createdAt: 'desc' },
      take: 30
    });

    res.json({ announcements });
  } catch (error) {
    console.error('Failed to fetch admin announcements:', error);
    res.status(500).json({ error: 'Failed to fetch announcements' });
  }
});

/**
 * POST /api/admin/announcements
 * Create announcement post from admin panel
 */
router.post('/announcements', authenticateAdmin, async (req: any, res: Response) => {
  try {
    const data = createAnnouncementSchema.parse(req.body);

    let createdByName = req.admin?.email || 'Admin';
    if (req.admin?.role === 'master') {
      const masterAdmin = await prisma.admin.findUnique({
        where: { id: req.admin.id },
        select: { name: true }
      });
      createdByName = masterAdmin?.name || createdByName;
    } else if (req.admin?.role === 'subadmin') {
      const subadmin = await prisma.user.findUnique({
        where: { id: req.admin.id },
        select: { name: true }
      });
      createdByName = subadmin?.name || createdByName;
    }

    const announcement = await prisma.announcement.create({
      data: {
        title: data.title,
        message: data.message,
        location: data.location,
        imageUrl: data.imageUrl || null,
        imageAlt: data.imageAlt || null,
        createdById: req.admin.id,
        createdByName,
        createdByRole: req.admin.role || 'admin'
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

    console.error('Failed to create admin announcement:', error);
    res.status(500).json({ error: 'Failed to create announcement' });
  }
});

/**
 * DELETE /api/admin/announcements/:id
 * Delete announcement post from admin panel
 */
router.delete('/announcements/:id', authenticateAdmin, async (req: any, res: Response) => {
  try {
    const announcementId = req.params.id;

    const existing = await prisma.announcement.findUnique({
      where: { id: announcementId },
      select: { id: true }
    });

    if (!existing) {
      return res.status(404).json({ error: 'Announcement not found' });
    }

    await prisma.announcement.delete({
      where: { id: announcementId }
    });

    io.emit('admin-announcement-deleted', { id: announcementId });

    res.json({
      message: 'Announcement deleted successfully',
      id: announcementId
    });
  } catch (error) {
    console.error('Failed to delete admin announcement:', error);
    res.status(500).json({ error: 'Failed to delete announcement' });
  }
});

/**
 * GET /api/admin/users
 * Get all users with pagination
 */
router.get('/users', authenticateAdmin, async (req: any, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const skip = (page - 1) * limit;

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          college: true,
          gender: true,
          dateOfBirth: true,
          rating: true,
          totalRides: true,
          createdAt: true,
          updatedAt: true,
          lastSeen: true,
          isActive: true,
          _count: {
            select: {
              ridesCreated: true,
              matchesAsUser1: true,
              matchesAsUser2: true
            }
          }
        }
      }),
      prisma.user.count()
    ]);

    res.json({
      users,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Failed to fetch users:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

/**
 * GET /api/admin/rides
 * Get all rides with pagination
 */
router.get('/rides', authenticateAdmin, async (req: any, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const skip = (page - 1) * limit;

    const [rides, total] = await Promise.all([
      prisma.ride.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          creator: {
            select: { name: true, email: true, phone: true }
          },
          matches: {
            include: {
              user2: {
                select: { name: true, email: true }
              }
            }
          }
        }
      }),
      prisma.ride.count()
    ]);

    res.json({
      rides,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Failed to fetch rides:', error);
    res.status(500).json({ error: 'Failed to fetch rides' });
  }
});

/**
 * GET /api/admin/matches
 * Get all matches with pagination
 */
router.get('/matches', authenticateAdmin, async (req: any, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const skip = (page - 1) * limit;

    const [matches, total] = await Promise.all([
      prisma.match.findMany({
        skip,
        take: limit,
        orderBy: { matchedAt: 'desc' },
        include: {
          ride: {
            select: {
              origin: true,
              destination: true,
              departureTime: true,
              fare: true
            }
          },
          user1: {
            select: { name: true, email: true, phone: true }
          },
          user2: {
            select: { name: true, email: true, phone: true }
          }
        }
      }),
      prisma.match.count()
    ]);

    res.json({
      matches,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Failed to fetch matches:', error);
    res.status(500).json({ error: 'Failed to fetch matches' });
  }
});

/**
 * GET /api/admin/admins
 * Get all admins (Master only)
 */
router.get('/admins', authenticateAdmin, requireMaster, async (req: any, res: Response) => {
  try {
    const admins = await prisma.admin.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        lastLogin: true,
        createdAt: true
      }
    });

    res.json({ admins });
  } catch (error) {
    console.error('Failed to fetch admins:', error);
    res.status(500).json({ error: 'Failed to fetch admins' });
  }
});

/**
 * POST /api/admin/create-admin
 * Create new admin (Master only)
 */
router.post('/create-admin', authenticateAdmin, requireMaster, async (req: any, res: Response) => {
  try {
    const data = createAdminSchema.parse(req.body);

    // Check if admin already exists
    const existingAdmin = await prisma.admin.findUnique({
      where: { email: data.email }
    });

    if (existingAdmin) {
      return res.status(400).json({ error: 'Admin with this email already exists' });
    }

    // Create admin
    const hashedPassword = await hashPassword(data.password);
    const admin = await prisma.admin.create({
      data: {
        email: data.email,
        password: hashedPassword,
        name: data.name,
        role: 'admin',
        createdBy: req.admin.id
      }
    });

    res.json({
      message: 'Admin created successfully',
      admin: {
        id: admin.id,
        email: admin.email,
        name: admin.name,
        role: admin.role
      }
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors });
    }
    console.error('Failed to create admin:', error);
    res.status(500).json({ error: 'Failed to create admin' });
  }
});

/**
 * DELETE /api/admin/:id
 * Deactivate admin (Master only)
 */
router.delete('/:id', authenticateAdmin, requireMaster, async (req: any, res: Response) => {
  try {
    const adminId = req.params.id;

    if (adminId === req.admin.id) {
      return res.status(400).json({ error: 'Cannot deactivate your own account' });
    }

    await prisma.admin.update({
      where: { id: adminId },
      data: { isActive: false }
    });

    res.json({ message: 'Admin deactivated successfully' });
  } catch (error) {
    console.error('Failed to deactivate admin:', error);
    res.status(500).json({ error: 'Failed to deactivate admin' });
  }
});

/**
 * GET /api/admin/chart-data
 * Get data for charts
 */
router.get('/chart-data', authenticateAdmin, async (req: any, res: Response) => {
  try {
    // Last 7 days user registrations
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - (6 - i));
      date.setHours(0, 0, 0, 0);
      return date;
    });

    const userGrowth = await Promise.all(
      last7Days.map(async (date, index) => {
        const nextDate = new Date(date);
        nextDate.setDate(nextDate.getDate() + 1);
        
        const count = await prisma.user.count({
          where: {
            createdAt: {
              gte: date,
              lt: nextDate
            }
          }
        });

        return {
          date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          count
        };
      })
    );

    // Rides by status
    const ridesByStatus = await prisma.ride.groupBy({
      by: ['status'],
      _count: true
    });

    res.json({
      userGrowth,
      ridesByStatus: ridesByStatus.map(item => ({
        status: item.status,
        count: item._count
      }))
    });
  } catch (error) {
    console.error('Failed to fetch chart data:', error);
    res.status(500).json({ error: 'Failed to fetch chart data' });
  }
});

/**
 * GET /api/admin/early-access
 * Get Spllit Social early access registrations
 */
router.get('/early-access', authenticateAdmin, async (req: any, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 100;
    const skip = (page - 1) * limit;

    const [registrations, total] = await Promise.all([
      prisma.earlyAccess.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' }
      }),
      prisma.earlyAccess.count()
    ]);

    res.json({
      registrations,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Failed to fetch early access registrations:', error);
    res.status(500).json({ error: 'Failed to fetch early access registrations' });
  }
});

export default router;
