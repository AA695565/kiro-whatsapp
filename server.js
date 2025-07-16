const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'client/build')));

// In-memory storage for rooms and messages
const rooms = new Map();
const typingUsers = new Map();
const userProfiles = new Map();
const onlineUsers = new Map();
const ipUsernames = new Map(); // Store usernames by IP address
const userIdToSocketId = new Map(); // Map userId to current socketId
const socketIdToUserId = new Map(); // Map socketId to userId
const userSessions = new Map(); // Store user session data by userId

// Generate random username with more variety
function generateUsername() {
  const adjectives = ['Cool', 'Smart', 'Fast', 'Bright', 'Happy', 'Lucky', 'Swift', 'Bold', 'Calm', 'Wise'];
  const nouns = ['Tiger', 'Eagle', 'Wolf', 'Lion', 'Fox', 'Bear', 'Hawk', 'Shark', 'Panda', 'Falcon'];
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  const num = Math.floor(Math.random() * 999).toString().padStart(3, '0');
  return `${adj}${noun}${num}`;
}

// Generate random avatar color
function generateAvatarColor() {
  const colors = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', 
    '#DDA0DD', '#98D8C8', '#F7DC6F', '#85C1E9', '#F8C471',
    '#82E0AA', '#F1948A', '#BB8FCE', '#85C1E9', '#F9E79F'
  ];
  return colors[Math.floor(Math.random() * colors.length)];
}

// Generate status messages
function generateRandomStatus() {
  const statuses = [
    'Hey there! I am using WhatsApp.',
    'Busy',
    'At work',
    'Available',
    'Can\'t talk, WhatsApp only',
    'In a meeting',
    'Sleeping',
    'Urgent calls only'
  ];
  return statuses[Math.floor(Math.random() * statuses.length)];
}

// Clean up inactive rooms (30 minutes)
setInterval(() => {
  const now = Date.now();
  for (const [roomCode, room] of rooms.entries()) {
    if (now - room.lastActivity > 30 * 60 * 1000) {
      rooms.delete(roomCode);
      console.log(`Room ${roomCode} expired due to inactivity`);
    }
  }
}, 5 * 60 * 1000);

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);
  
  // Get client IP address
  const clientIP = socket.handshake.headers['x-forwarded-for'] || 
                   socket.handshake.address || 
                   socket.conn.remoteAddress || 
                   'unknown';

  let currentUserId = null;

  // Handle user ID setting
  socket.on('set-user-id', (userId) => {
    currentUserId = userId;
    userIdToSocketId.set(userId, socket.id);
    socketIdToUserId.set(socket.id, userId);
    
    // Restore user session if exists
    if (userSessions.has(userId)) {
      const session = userSessions.get(userId);
      console.log(`User ${userId} reconnected, restoring session for ${session.username}`);
    }
  });

  socket.on('join-room', (data) => {
    const { roomCode, desiredUsername, userId } = data;
    
    // Set userId if not already set
    if (!currentUserId && userId) {
      currentUserId = userId;
      userIdToSocketId.set(userId, socket.id);
      socketIdToUserId.set(socket.id, userId);
    }
    
    // Validate room code (6 digits)
    if (!/^\d{6}$/.test(roomCode)) {
      socket.emit('error', 'Invalid room code. Please enter 6 digits.');
      return;
    }

    // Initialize room if it doesn't exist
    if (!rooms.has(roomCode)) {
      rooms.set(roomCode, {
        messages: [],
        users: new Map(),
        lastActivity: Date.now(),
        createdAt: Date.now()
      });
    }

    const room = rooms.get(roomCode);
    
    // Check if room is full (max 2 participants)
    if (room.users.size >= 2) {
      socket.emit('error', 'Room is full. Maximum 2 participants allowed.');
      return;
    }

    // Check for existing user session
    let username;
    let avatarColor;
    let status;
    
    const existingSession = userSessions.get(currentUserId);
    
    if (existingSession && !desiredUsername) {
      // Use existing session data
      username = existingSession.username;
      avatarColor = existingSession.avatarColor;
      status = existingSession.status;
    } else {
      // Create new session or use desired username
      if (desiredUsername && desiredUsername.trim()) {
        username = desiredUsername.trim().substring(0, 20);
      } else {
        username = generateUsername();
      }
      
      // Check if username is already taken in this room
      const existingUsernames = Array.from(room.users.values()).map(user => user.username);
      if (existingUsernames.includes(username)) {
        username = `${username}_${Math.floor(Math.random() * 99)}`;
      }
      
      avatarColor = generateAvatarColor();
      status = generateRandomStatus();
      
      // Store session
      userSessions.set(currentUserId, {
        username,
        avatarColor,
        status,
        lastSeen: Date.now()
      });
    }

    // Create user profile
    const userProfile = {
      username,
      roomCode,
      avatarColor,
      status,
      userId: currentUserId,
      joinedAt: Date.now(),
      lastSeen: Date.now(),
      isOnline: true
    };
    
    room.users.set(socket.id, userProfile);
    onlineUsers.set(socket.id, userProfile);
    socket.join(roomCode);
    room.lastActivity = Date.now();

    // Get all participants for sidebar
    const participants = Array.from(room.users.values()).map(user => ({
      username: user.username,
      avatarColor: user.avatarColor,
      status: user.status,
      isOnline: user.isOnline,
      lastSeen: user.lastSeen
    }));

    // Send existing messages to the new user
    socket.emit('room-joined', {
      roomCode,
      username,
      avatarColor,
      status,
      messages: room.messages,
      userCount: room.users.size,
      participants
    });

    // Update message statuses for messages that should be marked as delivered/seen
    setTimeout(() => {
      room.messages.forEach(msg => {
        // Check if message was sent by a different user (using userId instead of socketId)
        const msgSenderUserId = msg.senderUserId;
        if (msgSenderUserId && msgSenderUserId !== currentUserId && msg.status === 'sent') {
          msg.status = 'delivered';
          console.log(`Message ${msg.id} marked as delivered for rejoining user`);
          // Send status update to all users in room
          io.to(roomCode).emit('message-status-update', {
            messageId: msg.id,
            status: 'delivered'
          });
        }
      });
    }, 300);

    // Notify others that user joined
    socket.to(roomCode).emit('user-joined', {
      username,
      userCount: room.users.size,
      participants
    });

    // Send system message
    const joinMessage = {
      id: Date.now() + Math.random(),
      type: 'system',
      message: `${username} joined the chat`,
      timestamp: new Date().toISOString(),
      systemType: 'user-joined'
    };
    
    room.messages.push(joinMessage);
    socket.to(roomCode).emit('new-message', joinMessage);

    console.log(`${username} joined room ${roomCode} (${room.users.size}/2 participants) [IP: ${clientIP}]`);
  });

  socket.on('send-message', (data) => {
    const { roomCode, message, type = 'text', media, replyTo } = data;
    
    if (!rooms.has(roomCode)) {
      socket.emit('error', 'Room not found');
      return;
    }

    const room = rooms.get(roomCode);
    const user = room.users.get(socket.id);
    
    if (!user) {
      socket.emit('error', 'User not in room');
      return;
    }

    const messageData = {
      id: Date.now() + Math.random(),
      username: user.username,
      avatarColor: user.avatarColor,
      message: type === 'text' ? message.trim() : message,
      type,
      media,
      replyTo,
      timestamp: new Date().toISOString(),
      senderId: socket.id,
      senderUserId: user.userId, // Add persistent user ID
      status: 'sent',
      reactions: {},
      edited: false,
      editedAt: null
    };

    // Store message in room
    room.messages.push(messageData);
    room.lastActivity = Date.now();
    user.lastSeen = Date.now();

    // Mark as delivered for all users in room
    setTimeout(() => {
      if (messageData.status === 'sent') {
        messageData.status = 'delivered';
        console.log(`Message ${messageData.id} marked as delivered`);
        io.to(roomCode).emit('message-status-update', {
          messageId: messageData.id,
          status: 'delivered'
        });
      }
    }, 500);

    // Broadcast message to all users in the room
    io.to(roomCode).emit('new-message', messageData);

    console.log(`Message in room ${roomCode} from ${user.username}: ${type === 'text' ? message : `[${type}]`}`);
  });

  // Handle typing indicators
  socket.on('typing-start', (roomCode) => {
    if (!rooms.has(roomCode)) return;
    
    const room = rooms.get(roomCode);
    const user = room.users.get(socket.id);
    if (!user) return;

    if (!typingUsers.has(roomCode)) {
      typingUsers.set(roomCode, new Set());
    }
    
    typingUsers.get(roomCode).add(user.username);
    socket.to(roomCode).emit('user-typing', {
      username: user.username,
      typingUsers: Array.from(typingUsers.get(roomCode))
    });
  });

  socket.on('typing-stop', (roomCode) => {
    if (!rooms.has(roomCode)) return;
    
    const room = rooms.get(roomCode);
    const user = room.users.get(socket.id);
    if (!user) return;

    if (typingUsers.has(roomCode)) {
      typingUsers.get(roomCode).delete(user.username);
      if (typingUsers.get(roomCode).size === 0) {
        typingUsers.delete(roomCode);
      }
    }
    
    socket.to(roomCode).emit('user-typing', {
      username: user.username,
      typingUsers: typingUsers.has(roomCode) ? Array.from(typingUsers.get(roomCode)) : []
    });
  });

  // Handle message reactions
  socket.on('add-reaction', (data) => {
    const { roomCode, messageId, emoji } = data;
    
    if (!rooms.has(roomCode)) return;
    
    const room = rooms.get(roomCode);
    const user = room.users.get(socket.id);
    if (!user) return;

    const message = room.messages.find(msg => msg.id === messageId);
    if (!message) return;

    if (!message.reactions[emoji]) {
      message.reactions[emoji] = [];
    }
    
    if (!message.reactions[emoji].includes(user.username)) {
      message.reactions[emoji].push(user.username);
    }

    io.to(roomCode).emit('reaction-update', {
      messageId,
      reactions: message.reactions
    });
  });

  // Handle message seen status
  socket.on('message-seen', (data) => {
    const { roomCode, messageId } = data;
    
    if (!rooms.has(roomCode)) return;
    
    const room = rooms.get(roomCode);
    const message = room.messages.find(msg => msg.id === messageId);
    if (!message) return;

    const currentUser = room.users.get(socket.id);
    if (!currentUser) return;

    console.log(`Message seen event: messageId=${messageId}, senderUserId=${message.senderUserId}, currentUserId=${currentUser.userId}, currentStatus=${message.status}`);

    // Only update if message was sent by different user and not already seen
    if (message.senderUserId !== currentUser.userId && message.status !== 'seen') {
      message.status = 'seen';
      console.log(`Updating message ${messageId} status to 'seen'`);
      io.to(roomCode).emit('message-status-update', {
        messageId,
        status: 'seen'
      });
    }
  });

  // Handle message editing
  socket.on('edit-message', (data) => {
    const { roomCode, messageId, newMessage } = data;
    
    if (!rooms.has(roomCode)) return;
    
    const room = rooms.get(roomCode);
    const user = room.users.get(socket.id);
    if (!user) return;

    const message = room.messages.find(msg => msg.id === messageId && msg.senderId === socket.id);
    if (!message || message.type !== 'text') return;

    message.message = newMessage.trim();
    message.edited = true;
    message.editedAt = new Date().toISOString();

    io.to(roomCode).emit('message-edited', {
      messageId,
      newMessage: message.message,
      editedAt: message.editedAt
    });
  });

  // Handle message deletion
  socket.on('delete-message', (data) => {
    const { roomCode, messageId, deleteForEveryone } = data;
    
    if (!rooms.has(roomCode)) return;
    
    const room = rooms.get(roomCode);
    const user = room.users.get(socket.id);
    if (!user) return;

    const messageIndex = room.messages.findIndex(msg => msg.id === messageId);
    if (messageIndex === -1) return;

    const message = room.messages[messageIndex];
    
    if (deleteForEveryone && message.senderId === socket.id) {
      // Delete for everyone
      message.deleted = true;
      message.message = 'This message was deleted';
      message.type = 'deleted';
      
      io.to(roomCode).emit('message-deleted', {
        messageId,
        deletedForEveryone: true
      });
    } else if (message.senderId === socket.id) {
      // Delete for self only
      socket.emit('message-deleted', {
        messageId,
        deletedForEveryone: false
      });
    }
  });

  // Handle voice messages
  socket.on('send-voice-message', (data) => {
    const { roomCode, audioData, duration } = data;
    
    if (!rooms.has(roomCode)) return;
    
    const room = rooms.get(roomCode);
    const user = room.users.get(socket.id);
    if (!user) return;

    const messageData = {
      id: Date.now() + Math.random(),
      username: user.username,
      avatarColor: user.avatarColor,
      message: `Voice message (${duration}s)`,
      type: 'voice',
      media: {
        data: audioData,
        duration: duration
      },
      timestamp: new Date().toISOString(),
      senderId: socket.id,
      senderUserId: user.userId, // Add persistent user ID
      status: 'sent',
      reactions: {}
    };

    room.messages.push(messageData);
    room.lastActivity = Date.now();
    user.lastSeen = Date.now();

    // Mark as delivered for all users in room
    setTimeout(() => {
      if (messageData.status === 'sent') {
        messageData.status = 'delivered';
        io.to(roomCode).emit('message-status-update', {
          messageId: messageData.id,
          status: 'delivered'
        });
      }
    }, 500);

    io.to(roomCode).emit('new-message', messageData);
  });

  // Handle user status updates
  socket.on('update-status', (data) => {
    const { roomCode, status } = data;
    
    if (!rooms.has(roomCode)) return;
    
    const room = rooms.get(roomCode);
    const user = room.users.get(socket.id);
    if (!user) return;

    user.status = status;
    
    socket.to(roomCode).emit('user-status-updated', {
      username: user.username,
      status: status
    });
  });

  // Handle message forwarding
  socket.on('forward-message', (data) => {
    const { fromRoomCode, toRoomCode, messageId } = data;
    
    if (!rooms.has(fromRoomCode) || !rooms.has(toRoomCode)) return;
    
    const fromRoom = rooms.get(fromRoomCode);
    const toRoom = rooms.get(toRoomCode);
    const user = fromRoom.users.get(socket.id) || toRoom.users.get(socket.id);
    
    if (!user) return;

    const originalMessage = fromRoom.messages.find(msg => msg.id === messageId);
    if (!originalMessage) return;

    const forwardedMessage = {
      id: Date.now() + Math.random(),
      username: user.username,
      avatarColor: user.avatarColor,
      message: originalMessage.message,
      type: originalMessage.type,
      media: originalMessage.media,
      forwarded: true,
      originalSender: originalMessage.username,
      timestamp: new Date().toISOString(),
      senderId: socket.id,
      status: 'sent',
      reactions: {}
    };

    toRoom.messages.push(forwardedMessage);
    toRoom.lastActivity = Date.now();

    io.to(toRoomCode).emit('new-message', forwardedMessage);
  });

  // Handle username preference updates
  socket.on('update-username-preference', (data) => {
    const { newUsername } = data;
    if (newUsername && newUsername.trim()) {
      const username = newUsername.trim().substring(0, 20);
      ipUsernames.set(clientIP, username);
      console.log(`Username preference updated for IP ${clientIP}: ${username}`);
    }
  });

  socket.on('disconnect', () => {
    // Clean up user mappings
    const userId = socketIdToUserId.get(socket.id);
    if (userId) {
      userIdToSocketId.delete(userId);
      socketIdToUserId.delete(socket.id);
      
      // Update session last seen
      if (userSessions.has(userId)) {
        const session = userSessions.get(userId);
        session.lastSeen = Date.now();
        userSessions.set(userId, session);
      }
    }
    
    // Find and remove user from all rooms
    for (const [roomCode, room] of rooms.entries()) {
      if (room.users.has(socket.id)) {
        const user = room.users.get(socket.id);
        room.users.delete(socket.id);
        
        // Remove from typing users
        if (typingUsers.has(roomCode)) {
          typingUsers.get(roomCode).delete(user.username);
          if (typingUsers.get(roomCode).size === 0) {
            typingUsers.delete(roomCode);
          }
        }
        
        // Notify others that user left and update user count
        socket.to(roomCode).emit('user-left', {
          username: user.username,
          userCount: room.users.size
        });
        
        console.log(`${user.username} left room ${roomCode} [IP: ${clientIP}, UserId: ${userId}]`);
        
        // Clean up empty rooms
        if (room.users.size === 0) {
          rooms.delete(roomCode);
          typingUsers.delete(roomCode);
          console.log(`Room ${roomCode} deleted (empty)`);
        }
        break;
      }
    }
    
    console.log('User disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});