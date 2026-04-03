import { Router, Request, Response } from 'express';
import { z } from 'zod';
import prisma from '../utils/prisma.js';

const router = Router();

const createEarlyAccessSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().email(),
  phone: z.string().trim().min(8).max(20)
});

/**
 * POST /api/early-access
 * Register interest for Spllit Social early access
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const data = createEarlyAccessSchema.parse(req.body);

    const normalizedEmail = data.email.toLowerCase();

    const existingLead = await prisma.earlyAccess.findFirst({
      where: { email: normalizedEmail }
    });

    if (existingLead) {
      const updated = await prisma.earlyAccess.update({
        where: { id: existingLead.id },
        data: {
          name: data.name,
          phone: data.phone,
          updatedAt: new Date()
        }
      });

      return res.status(200).json({
        message: 'Your registration was already present and has been updated.',
        registration: updated
      });
    }

    const registration = await prisma.earlyAccess.create({
      data: {
        name: data.name,
        email: normalizedEmail,
        phone: data.phone
      }
    });

    res.status(201).json({
      message: 'Early access registration successful',
      registration
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors });
    }

    console.error('Early access registration error:', error);
    res.status(500).json({ error: 'Failed to submit registration' });
  }
});

export default router;
