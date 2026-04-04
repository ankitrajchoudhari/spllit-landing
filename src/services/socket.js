import { io } from 'socket.io-client';

// Hardcoded socket URL - prioritize environment variable, fallback to localhost for development
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3001';

class SocketService {
    constructor() {
        this.socket = null;
        this.connected = false;
    }

    connect(userId) {
        if (this.socket?.connected) {
            console.log('Socket already connected');
            return;
        }

        const token = localStorage.getItem('accessToken');
        if (!token) {
            console.error('No access token found');
            return;
        }

        const isLikelyMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

        this.socket = io(SOCKET_URL, {
            auth: { token },
            transports: isLikelyMobile ? ['polling'] : ['websocket', 'polling'],
            upgrade: !isLikelyMobile,
            reconnection: true,
            reconnectionDelay: 1000,
            reconnectionAttempts: 5,
        });

        this.socket.on('connect', () => {
            console.log('✅ Socket connected:', this.socket.id);
            this.connected = true;
        });

        this.socket.on('disconnect', (reason) => {
            console.log('❌ Socket disconnected:', reason);
            this.connected = false;
        });

        this.socket.on('connect_error', (error) => {
            console.error('Socket connection error:', error.message);
        });

        return this.socket;
    }

    disconnect() {
        if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
            this.connected = false;
            console.log('Socket disconnected');
        }
    }

    // ============ MATCH EVENTS ============

    joinMatches(matchIds) {
        if (!this.socket) return;
        this.socket.emit('join_matches', { matchIds });
        console.log('Joined matches:', matchIds);
    }

    onNewMatch(callback) {
        if (!this.socket) return;
        this.socket.on('new_match', callback);
    }

    // ============ CHAT EVENTS ============

    sendMessage(matchId, content) {
        if (!this.socket) return;
        this.socket.emit('send_message', { matchId, content });
    }

    onNewMessage(callback) {
        if (!this.socket) return;
        this.socket.on('new_message', callback);
    }

    markMessagesAsRead(messageId) {
        if (!this.socket) return;
        this.socket.emit('mark_read', { messageId });
    }

    onMessagesRead(callback) {
        if (!this.socket) return;
        this.socket.on('message_read', callback);
    }

    // ============ TYPING EVENTS ============

    sendTyping(matchId) {
        if (!this.socket) return;
        this.socket.emit('typing', { matchId, isTyping: true });
    }

    onUserTyping(callback) {
        if (!this.socket) return;
        this.socket.on('user_typing', callback);
    }

    // ============ LOCATION EVENTS ============

    shareLocation(matchId, latitude, longitude) {
        if (!this.socket) return;
        this.socket.emit('share_location', {
            matchId,
            latitude,
            longitude,
        });
    }

    stopSharingLocation(matchId) {
        if (!this.socket) return;
        this.socket.emit('stop_location', { matchId });
    }

    onLocationUpdate(callback) {
        if (!this.socket) return;
        this.socket.on('location_update', callback);
    }

    // ============ USER STATUS EVENTS ============

    onUserOnline(callback) {
        if (!this.socket) return;
        this.socket.on('user_online', callback);
    }

    onUserOffline(callback) {
        if (!this.socket) return;
        this.socket.on('user_offline', callback);
    }

    // ============ CLEANUP ============

    removeListener(event) {
        if (!this.socket) return;
        this.socket.off(event);
    }

    removeAllListeners() {
        if (!this.socket) return;
        this.socket.removeAllListeners();
    }
}

// Export singleton instance
const socketService = new SocketService();
export default socketService;
