import { Router, Response } from 'express';
import { z } from 'zod';
import prisma from '../utils/prisma.js';
import { authenticate } from '../middleware/auth.js';
import { AuthRequest } from '../types/express.js';
import { calculateDistance, isTimeWithinWindow } from '../utils/helpers.js';
import { io } from '../server.js';

const router = Router();

// Validation schemas
const createRideSchema = z.object({
  origin: z.string(),
  originLat: z.number().optional(),
  originLng: z.number().optional(),
  destination: z.string(),
  destLat: z.number(),
  destLng: z.number(),
  departureTime: z.string().datetime(),
  vehicleType: z.enum(['cab', 'bike', 'auto']),
  seats: z.number().int().min(1).max(4).default(1),
  fare: z.number().positive().optional(),
  genderPref: z.enum(['male', 'female', 'any']).default('any')
});

const searchRidesSchema = z.object({
  destination: z.string(),
  destLat: z.number(),
  destLng: z.number(),
  departureTime: z.string().datetime(),
  timeWindowMinutes: z.number().int().positive().default(30),
  maxDistance: z.number().positive().default(2), // km
  genderPref: z.enum(['male', 'female', 'any']).optional()
});

/**
 * POST /api/rides
 * Create a new ride
 */
router.post('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const data = createRideSchema.parse(req.body);

    const ride = await prisma.ride.create({
      data: {
        userId: req.user.userId,
        origin: data.origin,
        originLat: data.originLat,
        originLng: data.originLng,
        destination: data.destination,
        destLat: data.destLat,
        destLng: data.destLng,
        departureTime: new Date(data.departureTime),
        vehicleType: data.vehicleType,
        seats: data.seats,
        fare: data.fare,
        genderPref: data.genderPref
      },
      include: {
        creator: {
          select: {
            id: true,
            name: true,
            college: true,
            rating: true,
            totalRides: true
          }
        }
      }
    });

    // Emit Socket.IO event for new ride creation (broadcast to all users)
    io.emit('new-ride-created', {
      id: ride.id,
      origin: ride.origin,
      destination: ride.destination,
      fare: ride.fare,
      vehicleType: ride.vehicleType,
      seats: ride.seats,
      departureTime: ride.departureTime,
      genderPref: ride.genderPref,
      status: ride.status,
      creator: {
        id: ride.creator.id,
        name: ride.creator.name,
        college: ride.creator.college
      },
      timestamp: ride.createdAt
    });

    res.status(201).json({
      message: 'Ride created successfully',
      ride
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors });
    }
    console.error('Create ride error:', error);
    res.status(500).json({ error: 'Failed to create ride' });
  }
});

/**
 * GET /api/rides/available
 * Get all available rides (simpler endpoint for browse all)
 */
router.get('/available', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const rides = await prisma.ride.findMany({
      where: {
        status: 'pending',
        userId: {
          not: req.user.userId // Exclude own rides
        },
        departureTime: {
          gte: new Date() // Only future rides
        }
      },
      include: {
        creator: {
          select: {
            id: true,
            name: true,
            college: true,
            gender: true,
            rating: true,
            totalRides: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    res.json({
      message: 'Available rides',
      count: rides.length,
      rides: rides.map(ride => ({
        ...ride,
        seatsAvailable: ride.seats
      }))
    });
  } catch (error) {
    console.error('Get available rides error:', error);
    res.status(500).json({ error: 'Failed to fetch available rides' });
  }
});

/**
 * GET /api/rides/search
 * Search for matching rides
 */
router.get('/search', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const query = {
      destination: req.query.destination as string,
      destLat: parseFloat(req.query.destLat as string),
      destLng: parseFloat(req.query.destLng as string),
      departureTime: req.query.departureTime as string,
      timeWindowMinutes: req.query.timeWindowMinutes ? parseInt(req.query.timeWindowMinutes as string) : 30,
      maxDistance: req.query.maxDistance ? parseFloat(req.query.maxDistance as string) : 2,
      genderPref: req.query.genderPref as 'male' | 'female' | 'any' | undefined
    };

    const data = searchRidesSchema.parse(query);
    const searchTime = new Date(data.departureTime);

    // Get current user for gender matching
    const currentUser = await prisma.user.findUnique({
      where: { id: req.user.userId }
    });

    if (!currentUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Find rides in time window
    const timeWindowStart = new Date(searchTime.getTime() - data.timeWindowMinutes * 60000);
    const timeWindowEnd = new Date(searchTime.getTime() + data.timeWindowMinutes * 60000);

    const rides = await prisma.ride.findMany({
      where: {
        status: 'pending',
        departureTime: {
          gte: timeWindowStart,
          lte: timeWindowEnd
        },
        userId: {
          not: req.user.userId // Exclude own rides
        }
      },
      include: {
        creator: {
          select: {
            id: true,
            name: true,
            college: true,
            gender: true,
            rating: true,
            totalRides: true
          }
        }
      }
    });

    // Filter by distance and gender preference
    const matchingRides = rides
      .filter((ride: any) => {
        // Check distance
        const distance = calculateDistance(
          data.destLat,
          data.destLng,
          ride.destLat,
          ride.destLng
        );

        if (distance > data.maxDistance) return false;

        // Check gender preferences
        const rideCreatorGender = ride.creator.gender;
        const currentUserGender = currentUser.gender;

        // Check if ride creator's preference matches current user
        if (ride.genderPref !== 'any' && ride.genderPref !== currentUserGender) {
          return false;
        }

        // Check if current user's preference matches ride creator
        if (data.genderPref && data.genderPref !== 'any' && data.genderPref !== rideCreatorGender) {
          return false;
        }

        return true;
      })
      .map((ride: any) => ({
        ...ride,
        distance: calculateDistance(data.destLat, data.destLng, ride.destLat, ride.destLng),
        timeDiff: Math.abs(ride.departureTime.getTime() - searchTime.getTime()) / 60000 // minutes
      }))
      .sort((a: any, b: any) => {
        // Sort by time difference first, then distance
        const timeDiffScore = a.timeDiff - b.timeDiff;
        if (Math.abs(timeDiffScore) > 5) return timeDiffScore; // 5 min threshold
        return a.distance - b.distance;
      });

    res.json({
      message: 'Rides found',
      count: matchingRides.length,
      rides: matchingRides
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors });
    }
    console.error('Search rides error:', error);
    res.status(500).json({ error: 'Failed to search rides' });
  }
});

/**
 * GET /api/rides/my
 * Get current user's rides
 */
router.get('/my', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const rides = await prisma.ride.findMany({
      where: {
        userId: req.user.userId
      },
      include: {
        matches: {
          include: {
            user2: {
              select: {
                id: true,
                name: true,
                college: true,
                rating: true
              }
            }
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    res.json({ rides });
  } catch (error) {
    console.error('Get my rides error:', error);
    res.status(500).json({ error: 'Failed to get rides' });
  }
});

/**
 * PUT /api/rides/:id
 * Update ride status
 */
router.put('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { id } = req.params;
    const { status } = req.body;

    if (!['pending', 'matched', 'completed', 'cancelled'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    // Check if ride belongs to user
    const ride = await prisma.ride.findFirst({
      where: {
        id,
        userId: req.user.userId
      }
    });

    if (!ride) {
      return res.status(404).json({ error: 'Ride not found or unauthorized' });
    }

    const updatedRide = await prisma.ride.update({
      where: { id },
      data: { status }
    });

    res.json({
      message: 'Ride updated successfully',
      ride: updatedRide
    });
  } catch (error) {
    console.error('Update ride error:', error);
    res.status(500).json({ error: 'Failed to update ride' });
  }
});

/**
 * DELETE /api/rides/:id
 * Delete/cancel a ride
 */
router.delete('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { id } = req.params;

    // Check if ride belongs to user
    const ride = await prisma.ride.findFirst({
      where: {
        id,
        userId: req.user.userId
      }
    });

    if (!ride) {
      return res.status(404).json({ error: 'Ride not found or unauthorized' });
    }

    // Delete related matches and their messages first (no cascade in MongoDB)
    const matches = await prisma.match.findMany({ where: { rideId: id }, select: { id: true } });
    if (matches.length > 0) {
      const matchIds = matches.map(m => m.id);
      await prisma.message.deleteMany({ where: { matchId: { in: matchIds } } });
      await prisma.match.deleteMany({ where: { rideId: id } });
    }

    await prisma.ride.delete({
      where: { id }
    });

    res.json({ message: 'Ride deleted successfully' });
  } catch (error) {
    console.error('Delete ride error:', error);
    res.status(500).json({ error: 'Failed to delete ride' });
  }
});

export default router;
