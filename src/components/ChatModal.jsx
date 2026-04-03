import { useState, useEffect, useRef } from 'react';
import { FaTimes, FaPaperPlane, FaCircle, FaEdit, FaTrash, FaCheck } from 'react-icons/fa';
import { matchesAPI } from '../services/api';
import socketService from '../services/socket';

const ChatModal = ({ match, onClose, currentUserId, socketClient }) => {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [editingMessageId, setEditingMessageId] = useState(null);
  const [editingContent, setEditingContent] = useState('');
  const [chatLoadError, setChatLoadError] = useState('');
  const messagesEndRef = useRef(null);
  const chatContainerRef = useRef(null);
  const activeSocket = socketClient || socketService.socket;
  const chatAcceptedAt = match.acceptedAt ? new Date(match.acceptedAt) : null;
  const chatExpiresAt = chatAcceptedAt ? new Date(chatAcceptedAt.getTime() + 30 * 60 * 1000) : null;
  const chatIsActive = chatExpiresAt ? Date.now() < chatExpiresAt.getTime() : false;

  // Determine the other user
  const otherUser = match.user1.id === currentUserId ? match.user2 : match.user1;

  // Scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Load messages
  useEffect(() => {
    const loadMessages = async () => {
      setLoading(true);
      try {
        const response = await matchesAPI.getMessages(match.id);
        setMessages(response.messages || []);
        setChatLoadError('');
        setTimeout(scrollToBottom, 100);
      } catch (error) {
        if (error?.response?.status === 403) {
          setChatLoadError(error?.response?.data?.error || 'Chat is not active right now.');
          setMessages([]);
        } else {
          setChatLoadError('Unable to load chat messages right now.');
        }
      } finally {
        setLoading(false);
      }
    };

    loadMessages();
  }, [match.id]);

  // Listen for new messages
  useEffect(() => {
    const handleNewMessage = (data) => {
      if (data.matchId === match.id) {
        setMessages(prev => [...prev, data.message]);
        setTimeout(scrollToBottom, 100);
      }
    };

    const handleMessageUpdated = (data) => {
      if (data.chatRoomId === match.chatRoomId && data.message) {
        setMessages(prev => prev.map((message) => (
          message.id === data.message.id ? data.message : message
        )));
      }
    };

    const handleMessageDeleted = (data) => {
      if (data.chatRoomId === match.chatRoomId && data.message) {
        setMessages(prev => prev.map((message) => (
          message.id === data.message.id ? data.message : message
        )));
      }
    };

    if (!activeSocket || typeof activeSocket.on !== 'function' || typeof activeSocket.off !== 'function') {
      return undefined;
    }

    activeSocket.on(`new_message_${match.chatRoomId}`, handleNewMessage);
    activeSocket.on(`message_updated_${match.chatRoomId}`, handleMessageUpdated);
    activeSocket.on(`message_deleted_${match.chatRoomId}`, handleMessageDeleted);

    return () => {
      activeSocket.off(`new_message_${match.chatRoomId}`, handleNewMessage);
      activeSocket.off(`message_updated_${match.chatRoomId}`, handleMessageUpdated);
      activeSocket.off(`message_deleted_${match.chatRoomId}`, handleMessageDeleted);
    };
  }, [match.id, match.chatRoomId, activeSocket]);

  // Send message
  const handleSendMessage = async (e) => {
    e.preventDefault();
    
    if (!newMessage.trim() || sending) return;

    setSending(true);
    try {
      await matchesAPI.sendMessage(match.id, newMessage.trim());
      setNewMessage('');
      // Message will be added via Socket.IO event
    } catch (error) {
      console.error('Failed to send message:', error);
      alert('Failed to send message. Please try again.');
    } finally {
      setSending(false);
    }
  };

  const handleStartEdit = (message) => {
    setEditingMessageId(message.id);
    setEditingContent(message.content);
  };

  const handleCancelEdit = () => {
    setEditingMessageId(null);
    setEditingContent('');
  };

  const handleSaveEdit = async (messageId) => {
    if (!editingContent.trim()) return;

    try {
      await matchesAPI.editMessage(match.id, messageId, editingContent.trim());
      setEditingMessageId(null);
      setEditingContent('');
    } catch (error) {
      console.error('Failed to edit message:', error);
      alert('Failed to edit message. Please try again.');
    }
  };

  const handleDeleteMessage = async (messageId) => {
    if (!window.confirm('Delete this message for both users?')) return;

    try {
      await matchesAPI.deleteMessage(match.id, messageId);
      if (editingMessageId === messageId) {
        handleCancelEdit();
      }
    } catch (error) {
      console.error('Failed to delete message:', error);
      alert('Failed to delete message. Please try again.');
    }
  };

  // Format time
  const formatTime = (date) => {
    const d = new Date(date);
    const now = new Date();
    const diffMs = now - d;
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 z-[150]">
      <div className="bg-[#0b0b0b] border border-white/10 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] sm:max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-3 sm:p-4 border-b border-white/10 bg-[#101010]">
          <div className="flex items-center space-x-3 min-w-0">
            <div className="relative">
              <div className="w-10 h-10 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center text-white font-semibold">
                {otherUser.name.charAt(0).toUpperCase()}
              </div>
              <FaCircle className="absolute bottom-0 right-0 text-green-500 text-xs bg-[#101010] rounded-full" />
            </div>
            <div className="min-w-0">
              <h3 className="font-semibold text-white truncate">{otherUser.name}</h3>
              <p className="text-xs text-gray-400 truncate">{otherUser.college}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <FaTimes className="text-xl" />
          </button>
        </div>

        {/* Ride Details */}
        <div className="px-3 sm:px-4 py-3 bg-[#111111] border-b border-white/10">
          <p className="text-sm text-gray-200">
            <span className="font-semibold">Route:</span> {match.ride.origin} → {match.ride.destination}
          </p>
          <p className="text-xs text-gray-400 mt-1">
            {new Date(match.ride.departureTime).toLocaleString('en-US', { 
              month: 'short', 
              day: 'numeric', 
              hour: 'numeric', 
              minute: '2-digit' 
            })}
          </p>
          <p className={`text-xs mt-1 ${chatIsActive ? 'text-green-600' : 'text-red-600'}`}>
            {chatIsActive
              ? `Chat active until ${chatExpiresAt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`
              : 'Chat is inactive after 30 minutes of acceptance'}
          </p>
        </div>

        {/* Messages */}
        <div 
          ref={chatContainerRef}
          className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-4 bg-[#0b0b0b]"
        >
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : chatLoadError ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-500">
              <p className="text-sm">{chatLoadError}</p>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-500">
              <svg className="w-16 h-16 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              <p className="text-sm">No messages yet. Start the conversation!</p>
            </div>
          ) : (
            <>
              {messages.map((msg, index) => {
                const isOwnMessage = msg.senderId === currentUserId;
                const isDeleted = msg.isDeleted;
                return (
                  <div
                    key={index}
                    className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[85%] sm:max-w-[70%] rounded-lg px-3 sm:px-4 py-2 ${
                        isOwnMessage
                          ? 'bg-blue-600 text-white'
                          : 'bg-[#141414] text-gray-100 border border-white/10'
                      }`}
                    >
                      {editingMessageId === msg.id ? (
                        <div className="space-y-2">
                          <textarea
                            value={editingContent}
                            onChange={(e) => setEditingContent(e.target.value)}
                            className="w-full min-h-[84px] px-3 py-2 rounded-lg border border-white/10 bg-black/30 text-sm text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                          />
                          <div className="flex items-center gap-2 justify-end">
                            <button
                              type="button"
                              onClick={handleCancelEdit}
                              className="px-3 py-1.5 rounded-md bg-white/10 text-white text-xs"
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              onClick={() => handleSaveEdit(msg.id)}
                              className="px-3 py-1.5 rounded-md bg-green-500 text-white text-xs inline-flex items-center gap-1"
                            >
                              <FaCheck /> Save
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <p className={`text-sm break-words ${isDeleted ? 'italic opacity-70' : ''}`}>
                            {isDeleted ? 'Message deleted' : msg.content}
                            {msg.editedAt && !isDeleted && (
                              <span className="ml-1 text-[10px] opacity-70">(edited)</span>
                            )}
                          </p>
                          <div className="flex items-center justify-between gap-2 mt-1">
                            <p
                              className={`text-xs ${
                                isOwnMessage ? 'text-blue-200' : 'text-gray-500'
                              }`}
                            >
                              {formatTime(msg.createdAt)}
                            </p>
                            {isOwnMessage && !isDeleted && (
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => handleStartEdit(msg)}
                                  className={`text-xs ${isOwnMessage ? 'text-blue-100' : 'text-gray-500'} inline-flex items-center gap-1`}
                                >
                                  <FaEdit /> Edit
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteMessage(msg.id)}
                                  className={`text-xs ${isOwnMessage ? 'text-blue-100' : 'text-gray-500'} inline-flex items-center gap-1`}
                                >
                                  <FaTrash /> Delete
                                </button>
                              </div>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        {/* Input */}
        <form onSubmit={handleSendMessage} className="p-3 sm:p-4 border-t border-white/10 bg-[#101010]">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Type a message..."
              className="flex-1 px-4 py-2 border border-white/15 rounded-lg bg-black/30 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
              disabled={sending || !chatIsActive}
            />
            <button
              type="submit"
              disabled={!newMessage.trim() || sending || !chatIsActive}
              className="px-4 sm:px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center space-x-2"
            >
              {sending ? (
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
              ) : (
                <>
                  <FaPaperPlane />
                  <span className="hidden sm:inline">Send</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ChatModal;
