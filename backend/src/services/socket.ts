import { Server, Socket } from 'socket.io';
import prisma from '../utils/prisma.js';
import { verifyAccessToken } from '../utils/helpers.js';

const CHAT_WINDOW_MINUTES = 30;

const isChatActive = (acceptedAt?: Date | null) => {
  if (!acceptedAt) return false;

  const acceptedTime = new Date(acceptedAt).getTime();
  return Date.now() - acceptedTime <= CHAT_WINDOW_MINUTES * 60 * 1000;
};

interface AuthSocket extends Socket {
  userId?: string;
  adminId?: string;
  email?: string;
}

// Store active users and their sockets
const activeUsers = new Map<string, string>(); // userId -> socketId

export function setupSocketHandlers(io: Server) {
  // Authentication middleware for Socket.IO
  io.use((socket: AuthSocket, next) => {
    try {
      const token = socket.handshake.auth.token;
      
      if (!token) {
        return next(new Error('Authentication required'));
      }

      const decoded = verifyAccessToken(token) as { userId?: string; adminId?: string; email?: string };
      socket.userId = decoded.userId;
      socket.adminId = decoded.adminId;
      socket.email = decoded.email;

      if (!socket.userId && !socket.adminId) {
        return next(new Error('Invalid token payload'));
      }
      
      next();
    } catch (error) {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket: AuthSocket) => {
    const connectedId = socket.userId || socket.adminId || 'unknown';
    const identityType = socket.userId ? 'User' : socket.adminId ? 'Admin' : 'Unknown';
    console.log(`${identityType} connected: ${connectedId}`);

    if (socket.userId) {
      // Store user's socket
      activeUsers.set(socket.userId, socket.id);

      // Update user's online status
      updateUserOnlineStatus(socket.userId, true);

      // Notify user's matches about online status
      notifyMatchesAboutStatus(io, socket.userId, 'online');
    }

    // Join chat rooms for user's matches
    socket.on('join_matches', async (data: { matchIds: string[] }) => {
      if (!socket.userId) return;

      for (const matchId of data.matchIds) {
        // Verify user is part of the match
        const match = await prisma.match.findFirst({
          where: {
            id: matchId,
            OR: [
              { user1Id: socket.userId },
              { user2Id: socket.userId }
            ]
          }
        });

        if (match) {
          socket.join(match.chatRoomId);
          console.log(`User ${socket.userId} joined room ${match.chatRoomId}`);
        }
      }
    });

    // Send message
    socket.on('send_message', async (data: {
      matchId: string;
      content: string;
      type?: string;
      metadata?: any;
    }) => {
      if (!socket.userId) return;

      try {
        // Verify user is part of the match
        const match = await prisma.match.findFirst({
          where: {
            id: data.matchId,
            OR: [
              { user1Id: socket.userId },
              { user2Id: socket.userId }
            ]
          }
        });

        if (!match) {
          socket.emit('error', { message: 'Match not found or unauthorized' });
          return;
        }

        if (match.status !== 'accepted' || !isChatActive(match.acceptedAt)) {
          socket.emit('error', { message: 'Chat has expired after 30 minutes' });
          return;
        }

        // Save message to database
        const message = await prisma.message.create({
          data: {
            matchId: data.matchId,
            senderId: socket.userId,
            content: data.content,
            type: data.type || 'text',
            metadata: data.metadata
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

        // Broadcast to chat room
        io.to(match.chatRoomId).emit('new_message', message);

        // Send push notification to other user if offline
        const otherUserId = match.user1Id === socket.userId ? match.user2Id : match.user1Id;
        if (!activeUsers.has(otherUserId)) {
          // TODO: Implement push notification
          console.log(`Send push notification to ${otherUserId}`);
        }

      } catch (error) {
        console.error('Send message error:', error);
        socket.emit('error', { message: 'Failed to send message' });
      }
    });

    // Typing indicator
    socket.on('typing', async (data: { matchId: string; isTyping: boolean }) => {
      if (!socket.userId) return;

      const match = await prisma.match.findFirst({
        where: {
          id: data.matchId,
          OR: [
            { user1Id: socket.userId },
            { user2Id: socket.userId }
          ]
        }
      });

      if (match) {
        socket.to(match.chatRoomId).emit('user_typing', {
          userId: socket.userId,
          isTyping: data.isTyping
        });
      }
    });

    // Share location
    socket.on('share_location', async (data: {
      matchId: string;
      latitude: number;
      longitude: number;
      accuracy?: number;
      heading?: number;
      speed?: number;
    }) => {
      if (!socket.userId) return;

      try {
        // Verify match
        const match = await prisma.match.findFirst({
          where: {
            id: data.matchId,
            OR: [
              { user1Id: socket.userId },
              { user2Id: socket.userId }
            ]
          }
        });

        if (!match) return;

        // Save location
        const location = await prisma.location.create({
          data: {
            userId: socket.userId,
            latitude: data.latitude,
            longitude: data.longitude,
            accuracy: data.accuracy,
            heading: data.heading,
            speed: data.speed,
            isActive: true
          }
        });

        // Broadcast to chat room
        io.to(match.chatRoomId).emit('location_update', {
          userId: socket.userId,
          latitude: data.latitude,
          longitude: data.longitude,
          accuracy: data.accuracy,
          heading: data.heading,
          speed: data.speed,
          timestamp: location.createdAt
        });

      } catch (error) {
        console.error('Share location error:', error);
      }
    });

    // Stop sharing location
    socket.on('stop_location', async () => {
      if (!socket.userId) return;

      await prisma.location.updateMany({
        where: {
          userId: socket.userId,
          isActive: true
        },
        data: {
          isActive: false
        }
      });
    });

    // Message read receipt
    socket.on('mark_read', async (data: { messageId: string }) => {
      if (!socket.userId) return;

      try {
        const message = await prisma.message.update({
          where: { id: data.messageId },
          data: { read: true }
        });

        const match = await prisma.match.findUnique({
          where: { id: message.matchId }
        });

        if (match) {
          io.to(match.chatRoomId).emit('message_read', {
            messageId: data.messageId,
            userId: socket.userId
          });
        }
      } catch (error) {
        console.error('Mark read error:', error);
      }
    });

    // Handle disconnect
    socket.on('disconnect', () => {
      console.log(`User disconnected: ${socket.userId}`);

      if (socket.userId) {
        activeUsers.delete(socket.userId);
        updateUserOnlineStatus(socket.userId, false);
        notifyMatchesAboutStatus(io, socket.userId, 'offline');

        // Deactivate location sharing
        prisma.location.updateMany({
          where: {
            userId: socket.userId,
            isActive: true
          },
          data: {
            isActive: false
          }
        }).catch(console.error);
      }
    });
  });

  console.log('✅ Socket.IO handlers configured');
}

// Helper function to update user's online status
async function updateUserOnlineStatus(userId: string, isOnline: boolean) {
  try {
    await prisma.user.update({
      where: { id: userId },
      data: {
        lastSeen: new Date(),
        isActive: isOnline
      }
    });
  } catch (error) {
    console.error('Update online status error:', error);
  }
}

// Helper function to notify matches about status change
async function notifyMatchesAboutStatus(io: Server, userId: string, status: 'online' | 'offline') {
  try {
    const matches = await prisma.match.findMany({
      where: {
        OR: [
          { user1Id: userId },
          { user2Id: userId }
        ],
        status: 'active'
      }
    });

    for (const match of matches) {
      io.to(match.chatRoomId).emit('user_status', {
        userId,
        status,
        timestamp: new Date()
      });
    }
  } catch (error) {
    console.error('Notify matches error:', error);
  }
}

// Get online status of a user
export function isUserOnline(userId: string): boolean {
  return activeUsers.has(userId);
}

// Get all online users
export function getOnlineUsers(): string[] {
  return Array.from(activeUsers.keys());
}
