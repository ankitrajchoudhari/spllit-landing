import { Router, Response } from 'express';
import { z } from 'zod';
import prisma from '../utils/prisma.js';
import { authenticate } from '../middleware/auth.js';
import { AuthRequest } from '../types/express.js';
import { io } from '../server.js';

const router = Router();
const RIDE_ACTIVE_WINDOW_MS = 8 * 60 * 60 * 1000;

const createMatchSchema = z.object({
  rideId: z.string()
});

const CHAT_WINDOW_MINUTES = 30;

const isChatActive = (acceptedAt?: Date | null) => {
  if (!acceptedAt) return false;

  const acceptedTime = new Date(acceptedAt).getTime();
  return Date.now() - acceptedTime <= CHAT_WINDOW_MINUTES * 60 * 1000;
};

/**
 * POST /api/matches
 * Create a match between current user and a ride
 */
router.post('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const data = createMatchSchema.parse(req.body);

    // Get the ride
    const ride = await prisma.ride.findUnique({
      where: { id: data.rideId },
      include: { creator: true }
    });

    if (!ride) {
      return res.status(404).json({ error: 'Ride not found' });
    }

    const rideExpiresAt = new Date(ride.createdAt.getTime() + RIDE_ACTIVE_WINDOW_MS);
    if (Date.now() > rideExpiresAt.getTime()) {
      if (ride.status === 'pending') {
        await prisma.ride.update({
          where: { id: ride.id },
          data: { status: 'cancelled' }
        });
      }
      return res.status(400).json({ error: 'Ride is no longer active' });
    }

    if (ride.status !== 'pending') {
      return res.status(400).json({ error: 'Ride is no longer available' });
    }

    if (ride.userId === req.user.userId) {
      return res.status(400).json({ error: 'Cannot match with own ride' });
    }

    // Check if match already exists
    const existingMatch = await prisma.match.findFirst({
      where: {
        rideId: data.rideId,
        OR: [
          { user1Id: req.user.userId },
          { user2Id: req.user.userId }
        ]
      }
    });

    if (existingMatch) {
      return res.status(400).json({ error: 'Match already exists' });
    }

    // Create match with pending status (waiting for creator approval)
    const chatRoomId = `chat_${ride.userId}_${req.user.userId}_${Date.now()}`;

    const match = await prisma.match.create({
      data: {
        rideId: data.rideId,
        user1Id: ride.userId,
        user2Id: req.user.userId,
        chatRoomId,
        status: 'pending' // Wait for ride creator to accept
      },
      include: {
        user1: {
          select: {
            id: true,
            name: true,
            college: true,
            rating: true
          }
        },
        user2: {
          select: {
            id: true,
            name: true,
            college: true,
            rating: true
          }
        },
        ride: true
      }
    });

    // Don't update ride status yet - wait for acceptance

    // Emit socket event to ride creator (user1) - REQUEST TO JOIN
    io.emit(`match_request_${ride.userId}`, { 
      match,
      notification: {
        type: 'match',
        title: '📨 New Match Request!',
        message: `${match.user2.name} wants to join your ride from ${ride.origin} to ${ride.destination}!`,
        rideId: ride.id,
        matchId: match.id
      }
    });

    // Emit socket event to person who joined (user2) - WAITING
    io.emit(`match_request_sent_${req.user.userId}`, { 
      match,
      notification: {
        type: 'info',
        title: '⏳ Request Sent!',
        message: `Waiting for ${match.user1.name} to accept your request...`,
        rideId: ride.id,
        matchId: match.id
      }
    });

    // Emit to admin dashboard
    io.emit('new-match-request', {
      requesterName: match.user2.name,
      creatorName: match.user1.name,
      origin: ride.origin,
      destination: ride.destination,
      matchId: match.id,
      timestamp: new Date()
    });

    res.status(201).json({
      message: 'Match request sent successfully',
      match
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors });
    }
    console.error('Create match error:', error);
    res.status(500).json({ error: 'Failed to create match' });
  }
});

/**
 * POST /api/matches/:id/accept
 * Accept a pending match request (ride creator only)
 */
router.post('/:id/accept', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const match = await prisma.match.findUnique({
      where: { id: req.params.id },
      include: {
        user1: true,
        user2: true,
        ride: true
      }
    });

    if (!match) {
      return res.status(404).json({ error: 'Match not found' });
    }

    // Only ride creator can accept
    if (match.user1Id !== req.user.userId) {
      return res.status(403).json({ error: 'Only ride creator can accept' });
    }

    if (match.status !== 'pending') {
      return res.status(400).json({ error: 'Match is not pending' });
    }

    // Update match status to accepted
    const updatedMatch = await prisma.match.update({
      where: { id: req.params.id },
      data: { 
        status: 'accepted',
        acceptedAt: new Date()
      },
      include: {
        user1: true,
        user2: true,
        ride: true
      }
    });

    // Update ride status
    await prisma.ride.update({
      where: { id: match.rideId },
      data: { status: 'matched' }
    });

    // Notify ride creator (confirmat ion)
    io.emit(`match_accepted_${match.user1Id}`, {
      match: updatedMatch,
      notification: {
        type: 'success',
        title: '✅ Match Accepted!',
        message: `You accepted ${match.user2.name}'s request. Chat is now active!`,
        matchId: match.id,
        chatRoomId: match.chatRoomId
      }
    });

    // Notify requester (acceptance)
    io.emit(`match_accepted_${match.user2Id}`, {
      match: updatedMatch,
      notification: {
        type: 'success',
        title: '🎉 Request Accepted!',
        message: `${match.user1.name} accepted your request! Start chatting now.`,
        matchId: match.id,
        chatRoomId: match.chatRoomId
      }
    });

    // Broadcast ride status update
    io.emit('ride-status-updated', {
      rideId: match.rideId,
      status: 'matched'
    });

    // Admin notification
    io.emit('match-accepted', {
      matchId: match.id,
      creator: match.user1.name,
      requester: match.user2.name,
      timestamp: new Date()
    });

    res.json({
      message: 'Match accepted successfully',
      match: updatedMatch
    });
  } catch (error) {
    console.error('Accept match error:', error);
    res.status(500).json({ error: 'Failed to accept match' });
  }
});

/**
 * POST /api/matches/:id/reject
 * Reject a pending match request (ride creator only)
 */
router.post('/:id/reject', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const match = await prisma.match.findUnique({
      where: { id: req.params.id },
      include: {
        user1: true,
        user2: true,
        ride: true
      }
    });

    if (!match) {
      return res.status(404).json({ error: 'Match not found' });
    }

    // Only ride creator can reject
    if (match.user1Id !== req.user.userId) {
      return res.status(403).json({ error: 'Only ride creator can reject' });
    }

    if (match.status !== 'pending') {
      return res.status(400).json({ error: 'Match is not pending' });
    }

    // Update match status to rejected
    await prisma.match.update({
      where: { id: req.params.id },
      data: { status: 'rejected' }
    });

    // Notify requester
    io.emit(`match_rejected_${match.user2Id}`, {
      notification: {
        type: 'error',
        title: '❌ Request Declined',
        message: `${match.user1.name} declined your request.`,
        matchId: match.id
      }
    });

    res.json({
      message: 'Match rejected successfully'
    });
  } catch (error) {
    console.error('Reject match error:', error);
    res.status(500).json({ error: 'Failed to reject match' });
  }
});

/**
 * GET /api/matches/my
 * Get current user's matches
 */
router.get('/my', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const matches = await prisma.match.findMany({
      where: {
        OR: [
          { user1Id: req.user.userId },
          { user2Id: req.user.userId }
        ],
        status: {
          in: ['pending', 'accepted', 'rejected']
        }
      },
      include: {
        user1: {
          select: {
            id: true,
            name: true,
            college: true,
            rating: true,
            lastSeen: true
          }
        },
        user2: {
          select: {
            id: true,
            name: true,
            college: true,
            rating: true,
            lastSeen: true
          }
        },
        ride: true,
        messages: {
          orderBy: {
            createdAt: 'desc'
          },
          take: 1
        }
      },
      orderBy: {
        matchedAt: 'desc'
      }
    });

    res.json({ matches });
  } catch (error) {
    console.error('Get matches error:', error);
    res.status(500).json({ error: 'Failed to get matches' });
  }
});

/**
 * GET /api/matches/:id/messages
 * Get messages for a match
 */
router.get('/:id/messages', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { id } = req.params;
    const limit = parseInt(req.query.limit as string) || 50;
    const before = req.query.before as string;

    // Verify user is part of this match
    const match = await prisma.match.findFirst({
      where: {
        id,
        OR: [
          { user1Id: req.user.userId },
          { user2Id: req.user.userId }
        ]
      }
    });

    if (!match) {
      return res.status(404).json({ error: 'Match not found or unauthorized' });
    }

    if (!isChatActive(match.acceptedAt)) {
      return res.status(403).json({ error: 'Chat has expired after 30 minutes' });
    }

    // Get messages
    const messages = await prisma.message.findMany({
      where: {
        matchId: id,
        ...(before && {
          createdAt: {
            lt: new Date(before)
          }
        })
      },
      include: {
        sender: {
          select: {
            id: true,
            name: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: limit
    });

    // Mark messages as read
    await prisma.message.updateMany({
      where: {
        matchId: id,
        senderId: {
          not: req.user.userId
        },
        read: false
      },
      data: {
        read: true
      }
    });

    res.json({
      messages: messages.reverse(),
      hasMore: messages.length === limit
    });
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({ error: 'Failed to get messages' });
  }
});

/**
 * PUT /api/matches/:id/complete
 * Mark match as completed
 */
router.put('/:id/complete', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { id } = req.params;

    // Verify user is part of this match
    const match = await prisma.match.findFirst({
      where: {
        id,
        OR: [
          { user1Id: req.user.userId },
          { user2Id: req.user.userId }
        ]
      }
    });

    if (!match) {
      return res.status(404).json({ error: 'Match not found or unauthorized' });
    }

    const updatedMatch = await prisma.match.update({
      where: { id },
      data: {
        status: 'completed',
        completedAt: new Date()
      }
    });

    // Update ride status
    await prisma.ride.update({
      where: { id: match.rideId },
      data: { status: 'completed' }
    });

    res.json({
      message: 'Match completed successfully',
      match: updatedMatch
    });
  } catch (error) {
    console.error('Complete match error:', error);
    res.status(500).json({ error: 'Failed to complete match' });
  }
});

/**
 * POST /api/matches/:id/messages
 * Send a message in a match
 */
router.post('/:id/messages', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { id } = req.params;
    const { content } = req.body;

    if (!content || !content.trim()) {
      return res.status(400).json({ error: 'Message content is required' });
    }

    // Verify match exists and user is part of it
    const match = await prisma.match.findFirst({
      where: {
        id,
        OR: [
          { user1Id: req.user.userId },
          { user2Id: req.user.userId }
        ],
        status: 'accepted'
      },
      include: {
        user1: {
          select: {
            id: true,
            name: true
          }
        },
        user2: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });

    if (!match) {
      return res.status(404).json({ error: 'Match not found or not accepted' });
    }

    if (!isChatActive(match.acceptedAt)) {
      return res.status(403).json({ error: 'Chat has expired after 30 minutes' });
    }

    // Create message
    const message = await prisma.message.create({
      data: {
        matchId: id,
        senderId: req.user.userId,
        content: content.trim()
      },
      include: {
        sender: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });

    // Determine recipient ID
    const recipientId = match.user1Id === req.user.userId ? match.user2Id : match.user1Id;

    // Emit real-time message via Socket.IO
    io.emit(`new_message_${match.chatRoomId}`, {
      message,
      matchId: id,
      chatRoomId: match.chatRoomId
    });

    // Notify recipient
    io.emit(`message_notification_${recipientId}`, {
      notification: {
        id: `message-${message.id}`,
        type: 'match',
        title: '💬 New Message',
        message: `${message.sender.name}: ${content.substring(0, 50)}${content.length > 50 ? '...' : ''}`,
        matchId: id,
        chatRoomId: match.chatRoomId
      }
    });

    res.json({
      message,
      success: true
    });
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

/**
 * PUT /api/matches/:id/messages/:messageId
 * Edit a message sent by the current user
 */
router.put('/:id/messages/:messageId', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { id, messageId } = req.params;
    const { content } = req.body;

    if (!content || !content.trim()) {
      return res.status(400).json({ error: 'Message content is required' });
    }

    const match = await prisma.match.findFirst({
      where: {
        id,
        OR: [
          { user1Id: req.user.userId },
          { user2Id: req.user.userId }
        ],
        status: 'accepted'
      }
    });

    if (!match) {
      return res.status(404).json({ error: 'Match not found or not accepted' });
    }

    if (!isChatActive(match.acceptedAt)) {
      return res.status(403).json({ error: 'Chat has expired after 30 minutes' });
    }

    const message = await prisma.message.findFirst({
      where: {
        id: messageId,
        matchId: id,
        senderId: req.user.userId,
        isDeleted: false
      }
    });

    if (!message) {
      return res.status(404).json({ error: 'Message not found or unauthorized' });
    }

    const updatedMessage = await prisma.message.update({
      where: { id: messageId },
      data: {
        content: content.trim(),
        editedAt: new Date()
      },
      include: {
        sender: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });

    io.to(match.chatRoomId).emit(`message_updated_${match.chatRoomId}`, {
      message: updatedMessage,
      chatRoomId: match.chatRoomId
    });

    res.json({
      message: updatedMessage
    });
  } catch (error) {
    console.error('Edit message error:', error);
    res.status(500).json({ error: 'Failed to edit message' });
  }
});

/**
 * DELETE /api/matches/:id/messages/:messageId
 * Soft delete a message sent by the current user
 */
router.delete('/:id/messages/:messageId', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { id, messageId } = req.params;

    const match = await prisma.match.findFirst({
      where: {
        id,
        OR: [
          { user1Id: req.user.userId },
          { user2Id: req.user.userId }
        ],
        status: 'accepted'
      }
    });

    if (!match) {
      return res.status(404).json({ error: 'Match not found or not accepted' });
    }

    if (!isChatActive(match.acceptedAt)) {
      return res.status(403).json({ error: 'Chat has expired after 30 minutes' });
    }

    const message = await prisma.message.findFirst({
      where: {
        id: messageId,
        matchId: id,
        senderId: req.user.userId,
        isDeleted: false
      }
    });

    if (!message) {
      return res.status(404).json({ error: 'Message not found or unauthorized' });
    }

    const deletedMessage = await prisma.message.update({
      where: { id: messageId },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
        content: message.content
      },
      include: {
        sender: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });

    io.to(match.chatRoomId).emit(`message_deleted_${match.chatRoomId}`, {
      message: deletedMessage,
      chatRoomId: match.chatRoomId
    });

    res.json({
      message: deletedMessage
    });
  } catch (error) {
    console.error('Delete message error:', error);
    res.status(500).json({ error: 'Failed to delete message' });
  }
});

export default router;
