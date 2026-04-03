import { Router, Response } from 'express';
import prisma from '../utils/prisma.js';
import { authenticate } from '../middleware/auth.js';
import { AuthRequest } from '../types/express.js';
import { sanitizeUser } from '../utils/helpers.js';

const router = Router();

const getCurrentProfile = async (req: AuthRequest, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const user = await prisma.user.findUnique({
    where: { id: req.user.userId }
  });

  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  return res.json({ user: sanitizeUser(user) });
};

const updateCurrentProfile = async (req: AuthRequest, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { name, college, profilePhoto, phone, gender, dateOfBirth } = req.body;
  const normalizedDateOfBirth = dateOfBirth ? new Date(dateOfBirth) : null;

  const user = await prisma.user.update({
    where: { id: req.user.userId },
    data: {
      ...(name && { name }),
      ...(college && { college }),
      ...(profilePhoto && { profilePhoto }),
      ...(phone !== undefined && { phone: phone || null }),
      ...(gender && { gender }),
      ...(dateOfBirth && { dateOfBirth: normalizedDateOfBirth })
    }
  });

  return res.json({
    message: 'Profile updated successfully',
    user: sanitizeUser(user)
  });
};

/**
 * GET /api/users/me
 * Get current user profile
 */
router.get('/me', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    await getCurrentProfile(req, res);
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Failed to get profile' });
  }
});

/**
 * PUT /api/users/me
 * Update current user profile
 */
router.put('/me', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    await updateCurrentProfile(req, res);
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

router.get('/profile', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    await getCurrentProfile(req, res);
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Failed to get profile' });
  }
});

router.put('/profile', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    await updateCurrentProfile(req, res);
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

/**
 * GET /api/users/:id
 * Get user profile by ID
 */
router.get('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        college: true,
        rating: true,
        totalRides: true,
        profilePhoto: true,
        lastSeen: true
      }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Failed to get user' });
  }
});

export default router;
