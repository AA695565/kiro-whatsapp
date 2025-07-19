import React, { useState, useEffect, useRef, useCallback } from 'react';
import io from 'socket.io-client';
import data from '@emoji-mart/data';
import Picker from '@emoji-mart/react';
import './App.css';

// Use the appropriate server URL based on environment
const SERVER_URL = process.env.NODE_ENV === 'production' 
  ? 'https://kiro-whatsapp-1.onrender.com'  // Your actual deployed server URL
  : 'http://localhost:5000';

const socket = io(SERVER_URL, {
  transports: ['websocket', 'polling'],
  reconnectionAttempts: 5,
  reconnectionDelay: 1000
});

function App() {
  const [roomCode, setRoomCode] = useState('');
  const [inputRoomCode, setInputRoomCode] = useState('');
  const [desiredUsername, setDesiredUsername] = useState('');
  const [username, setUsername] = useState('');
  const [avatarColor, setAvatarColor] = useState('');
  const [userStatus, setUserStatus] = useState('');
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [isJoined, setIsJoined] = useState(false);
  const [error, setError] = useState('');
  const [userCount, setUserCount] = useState(0);
  const [participants, setParticipants] = useState([]);
  const [typingUsers, setTypingUsers] = useState([]);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [replyingTo, setReplyingTo] = useState(null);
  const [editingMessage, setEditingMessage] = useState(null);
  const [selectedMessages, setSelectedMessages] = useState(new Set());
  const [showMessageMenu, setShowMessageMenu] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [theme, setTheme] = useState('light');
  
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recordingIntervalRef = useRef(null);
  const messageInputRef = useRef(null);
  const seenMessagesRef = useRef(new Set()); // Track which messages have been marked as seen

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Separate effect to handle marking messages as seen
  useEffect(() => {
    if (!isJoined || !roomCode) return;

    // Find messages that need to be marked as seen (not already processed)
    const messagesToMarkSeen = messages.filter(msg => 
      msg.senderId !== socket.id && 
      msg.type !== 'system' && 
      msg.status !== 'seen' &&
      !seenMessagesRef.current.has(msg.id) // Not already processed
    );

    if (messagesToMarkSeen.length > 0) {
      const timer = setTimeout(() => {
        messagesToMarkSeen.forEach(msg => {
          // Mark as processed to avoid duplicate requests
          seenMessagesRef.current.add(msg.id);
          
          socket.emit('message-seen', {
            roomCode,
            messageId: msg.id
          });
        });
      }, 1000);

      return () => clearTimeout(timer);
    }
  }, [messages, isJoined, roomCode]);

  // Generate or get persistent user ID
  const getUserId = () => {
    let userId = localStorage.getItem('userId');
    if (!userId) {
      userId = crypto.randomUUID();
      localStorage.setItem('userId', userId);
    }
    return userId;
  };

  useEffect(() => {
    // Set user ID on socket connection
    const userId = getUserId();
    socket.emit('set-user-id', userId);

    socket.on('room-joined', (data) => {
      setRoomCode(data.roomCode);
      setUsername(data.username);
      setAvatarColor(data.avatarColor);
      setUserStatus(data.status);
      setMessages(data.messages);
      setUserCount(data.userCount);
      setParticipants(data.participants);
      setIsJoined(true);
      setError('');
    });

    socket.on('new-message', (message) => {
      setMessages(prev => [...prev, message]);
      // Play notification sound for new messages
      if (message.senderId !== socket.id && message.type !== 'system') {
        playNotificationSound();
      }
    });

    socket.on('user-joined', (data) => {
      setUserCount(data.userCount);
      setParticipants(data.participants);
    });

    socket.on('user-left', (data) => {
      setUserCount(data.userCount);
    });

    socket.on('user-typing', (data) => {
      setTypingUsers(data.typingUsers.filter(user => user !== username));
    });

    socket.on('message-status-update', (data) => {
      setMessages(prev => prev.map(msg => 
        msg.id === data.messageId 
          ? { ...msg, status: data.status }
          : msg
      ));
    });

    socket.on('reaction-update', (data) => {
      setMessages(prev => prev.map(msg => 
        msg.id === data.messageId 
          ? { ...msg, reactions: data.reactions }
          : msg
      ));
    });

    socket.on('message-edited', (data) => {
      setMessages(prev => prev.map(msg => 
        msg.id === data.messageId 
          ? { ...msg, message: data.newMessage, edited: true, editedAt: data.editedAt }
          : msg
      ));
    });

    socket.on('message-deleted', (data) => {
      if (data.deletedForEveryone) {
        setMessages(prev => prev.map(msg => 
          msg.id === data.messageId 
            ? { ...msg, deleted: true, message: 'This message was deleted', type: 'deleted' }
            : msg
        ));
      } else {
        setMessages(prev => prev.filter(msg => msg.id !== data.messageId));
      }
    });

    socket.on('user-status-updated', (data) => {
      setParticipants(prev => prev.map(p => 
        p.username === data.username 
          ? { ...p, status: data.status }
          : p
      ));
    });

    socket.on('error', (errorMessage) => {
      setError(errorMessage);
    });

    return () => {
      socket.off('room-joined');
      socket.off('new-message');
      socket.off('user-joined');
      socket.off('user-left');
      socket.off('user-typing');
      socket.off('message-status-update');
      socket.off('reaction-update');
      socket.off('message-edited');
      socket.off('message-deleted');
      socket.off('user-status-updated');
      socket.off('error');
    };
  }, [roomCode, username]);

  const joinRoom = (e) => {
    e.preventDefault();
    if (inputRoomCode.length === 6 && /^\d+$/.test(inputRoomCode)) {
      const userId = getUserId();
      socket.emit('join-room', {
        roomCode: inputRoomCode,
        desiredUsername: desiredUsername,
        userId: userId
      });
    } else {
      setError('Please enter a valid 6-digit room code');
    }
  };

  const sendMessage = (e) => {
    e.preventDefault();
    if (newMessage.trim()) {
      if (editingMessage) {
        // Edit existing message
        socket.emit('edit-message', {
          roomCode,
          messageId: editingMessage.id,
          newMessage: newMessage
        });
        setEditingMessage(null);
      } else {
        // Send new message
        socket.emit('send-message', {
          roomCode,
          message: newMessage,
          type: 'text',
          replyTo: replyingTo
        });
      }
      setNewMessage('');
      setReplyingTo(null);
      handleTypingStop();
    }
  };

  const handleTypingStart = () => {
    if (!isTyping) {
      setIsTyping(true);
      socket.emit('typing-start', roomCode);
    }
    
    clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      handleTypingStop();
    }, 3000);
  };

  const handleTypingStop = () => {
    if (isTyping) {
      setIsTyping(false);
      socket.emit('typing-stop', roomCode);
    }
    clearTimeout(typingTimeoutRef.current);
  };

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const fileData = {
        name: file.name,
        type: file.type,
        size: file.size,
        data: e.target.result
      };

      let messageType = 'file';
      if (file.type.startsWith('image/')) {
        messageType = 'image';
      } else if (file.type.startsWith('video/')) {
        messageType = 'video';
      }

      socket.emit('send-message', {
        roomCode,
        message: file.name,
        type: messageType,
        media: fileData
      });
    };
    reader.readAsDataURL(file);
  };

  const addReaction = (messageId, emoji) => {
    socket.emit('add-reaction', {
      roomCode,
      messageId,
      emoji
    });
  };

  const onEmojiSelect = (emoji) => {
    setNewMessage(prev => prev + emoji.native);
    setShowEmojiPicker(false);
  };

  // Voice recording functions
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };

      mediaRecorderRef.current.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
        const reader = new FileReader();
        reader.onload = () => {
          socket.emit('send-voice-message', {
            roomCode,
            audioData: reader.result,
            duration: recordingTime
          });
        };
        reader.readAsDataURL(audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
      setRecordingTime(0);
      
      recordingIntervalRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } catch (error) {
      console.error('Error accessing microphone:', error);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      clearInterval(recordingIntervalRef.current);
    }
  };

  // Message actions
  const replyToMessage = (message) => {
    setReplyingTo(message);
    messageInputRef.current?.focus();
  };

  const editMessage = (message) => {
    if (message.senderId === socket.id && message.type === 'text') {
      setEditingMessage(message);
      setNewMessage(message.message);
      messageInputRef.current?.focus();
    }
  };

  const deleteMessage = (messageId, deleteForEveryone = false) => {
    socket.emit('delete-message', {
      roomCode,
      messageId,
      deleteForEveryone
    });
    setShowMessageMenu(null);
  };

  const forwardMessage = (messageId) => {
    // In a real app, this would open a contact/room selector
    const targetRoom = prompt('Enter room code to forward to:');
    if (targetRoom && /^\d{6}$/.test(targetRoom)) {
      socket.emit('forward-message', {
        fromRoomCode: roomCode,
        toRoomCode: targetRoom,
        messageId
      });
    }
  };

  const selectMessage = (messageId) => {
    const newSelected = new Set(selectedMessages);
    if (newSelected.has(messageId)) {
      newSelected.delete(messageId);
    } else {
      newSelected.add(messageId);
    }
    setSelectedMessages(newSelected);
  };

  const playNotificationSound = () => {
    // Create a simple notification sound
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.frequency.value = 800;
    oscillator.type = 'sine';
    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.5);
  };

  const searchMessages = (query) => {
    setSearchQuery(query);
    // In a real app, this would filter messages
  };

  const updateStatus = (newStatus) => {
    setUserStatus(newStatus);
    socket.emit('update-status', {
      roomCode,
      status: newStatus
    });
  };

  const leaveRoom = () => {
    handleTypingStop();
    setIsJoined(false);
    setRoomCode('');
    setUsername('');
    setDesiredUsername('');
    setAvatarColor('');
    setMessages([]);
    setInputRoomCode('');
    setUserCount(0);
    setTypingUsers([]);
    setShowEmojiPicker(false);
    setShowSidebar(false);
    setReplyingTo(null);
    setEditingMessage(null);
    setSelectedMessages(new Set());
    setShowMessageMenu(null);
    seenMessagesRef.current.clear(); // Clear seen messages tracking
    socket.disconnect();
    socket.connect();
  };

  const formatTime = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'sent': return <span style={{color: '#999'}}>✓</span>;
      case 'delivered': return <span style={{color: '#999'}}>✓✓</span>;
      case 'seen': return <span style={{color: '#4FC3F7'}}>✓✓</span>;
      default: return '';
    }
  };

  const getInitials = (name) => {
    return name.substring(0, 2).toUpperCase();
  };

  const renderMessage = (msg) => {
    const isOwn = msg.senderId === socket.id;
    const isSelected = selectedMessages.has(msg.id);
    
    if (msg.type === 'system') {
      return (
        <div key={msg.id} className="system-message">
          <span>{msg.message}</span>
        </div>
      );
    }
    
    return (
      <div 
        key={msg.id} 
        className={`message ${isOwn ? 'own-message' : 'other-message'} ${isSelected ? 'selected' : ''}`}
        onClick={() => selectedMessages.size > 0 && selectMessage(msg.id)}
        onContextMenu={(e) => {
          e.preventDefault();
          setShowMessageMenu(msg.id);
        }}
      >
        {!isOwn && (
          <div 
            className="avatar" 
            style={{ backgroundColor: msg.avatarColor }}
          >
            {getInitials(msg.username)}
          </div>
        )}
        <div className="message-bubble">
          {msg.replyTo && (
            <div className="reply-preview">
              <div className="reply-line"></div>
              <div className="reply-content">
                <div className="reply-username">{msg.replyTo.username}</div>
                <div className="reply-text">{msg.replyTo.message}</div>
              </div>
            </div>
          )}
          
          {msg.forwarded && (
            <div className="forwarded-label">
              <span>↪️ Forwarded from {msg.originalSender}</span>
            </div>
          )}
          
          {!isOwn && (
            <div className="message-username">{msg.username}</div>
          )}
          
          {msg.type === 'image' && (
            <div className="message-media">
              <img src={msg.media.data} alt={msg.message} className="message-image" />
            </div>
          )}
          
          {msg.type === 'video' && (
            <div className="message-media">
              <video controls className="message-video">
                <source src={msg.media.data} type={msg.media.type} />
              </video>
            </div>
          )}
          
          {msg.type === 'voice' && (
            <div className="voice-message">
              <button className="voice-play-btn">🎵</button>
              <div className="voice-waveform">
                <div className="voice-duration">{msg.media.duration}s</div>
              </div>
            </div>
          )}
          
          {msg.type === 'file' && (
            <div className="message-file">
              <a href={msg.media.data} download={msg.media.name} className="file-download-link">
                <div className="file-icon">📄</div>
                <div className="file-info">
                  <div className="file-name">{msg.message}</div>
                  <div className="file-size">{(msg.media.size / 1024).toFixed(1)} KB</div>
                </div>
              </a>
            </div>
          )}
          
          {msg.type === 'text' && !msg.deleted && (
            <div className="message-text">{msg.message}</div>
          )}
          
          {msg.deleted && (
            <div className="deleted-message">
              <em>🚫 This message was deleted</em>
            </div>
          )}
          
          <div className="message-footer">
            <span className="message-time">
              {formatTime(msg.timestamp)}
              {msg.edited && <span className="edited-indicator"> (edited)</span>}
            </span>
            {isOwn && <span className="message-status">{getStatusIcon(msg.status)}</span>}
          </div>
          
          {Object.keys(msg.reactions || {}).length > 0 && (
            <div className="message-reactions">
              {Object.entries(msg.reactions).map(([emoji, users]) => (
                <span key={emoji} className="reaction" title={users.join(', ')}>
                  {emoji} {users.length}
                </span>
              ))}
            </div>
          )}
        </div>
        
        {showMessageMenu === msg.id && (
          <div className="message-menu">
            <button onClick={() => replyToMessage(msg)}>Reply</button>
            <button onClick={() => forwardMessage(msg.id)}>Forward</button>
            <button onClick={() => selectMessage(msg.id)}>Select</button>
            {isOwn && msg.type === 'text' && (
              <button onClick={() => editMessage(msg)}>Edit</button>
            )}
            {isOwn && (
              <>
                <button onClick={() => deleteMessage(msg.id, false)}>Delete for me</button>
                <button onClick={() => deleteMessage(msg.id, true)}>Delete for everyone</button>
              </>
            )}
            <button onClick={() => setShowMessageMenu(null)}>Cancel</button>
          </div>
        )}
        
        <div className="message-actions">
          <button onClick={() => addReaction(msg.id, '👍')}>👍</button>
          <button onClick={() => addReaction(msg.id, '❤️')}>❤️</button>
          <button onClick={() => addReaction(msg.id, '😂')}>😂</button>
        </div>
      </div>
    );
  };

  if (!isJoined) {
    return (
      <div className="join-container">
        <div className="join-card">
          <h1>💬 WhatsApp Chat</h1>
          <p className="join-subtitle">Enter a 6-digit room code and your desired username</p>
          <p className="room-limit">⚠️ Maximum 2 participants per room</p>
          <form onSubmit={joinRoom}>
            <div className="input-group">
              <input
                type="text"
                placeholder="Your username (optional)"
                value={desiredUsername}
                onChange={(e) => setDesiredUsername(e.target.value)}
                maxLength="20"
                className="username-input"
              />
              <input
                type="text"
                placeholder="000000"
                value={inputRoomCode}
                onChange={(e) => setInputRoomCode(e.target.value.replace(/\D/g, ''))}
                maxLength="6"
                className="room-input"
              />
              <button type="submit" className="join-btn" disabled={inputRoomCode.length !== 6}>
                🚀 Join Room
              </button>
            </div>
          </form>
          {error && <div className="error">⚠️ {error}</div>}
        </div>
      </div>
    );
  }

  return (
    <div className="chat-container">
      <div className="chat-header">
        <div className="room-info">
          <div className="room-avatar">
            <div className="group-avatar">👥</div>
          </div>
          <div className="room-details">
            <h3>Room {roomCode}</h3>
            <span className="user-count">{userCount}/2 participants</span>
          </div>
        </div>
        <div className="header-actions">
          <button onClick={() => setShowSearch(!showSearch)} className="search-btn">
            🔍
          </button>
          <button onClick={() => setShowSidebar(!showSidebar)} className="sidebar-btn">
            ⋮
          </button>
          <button onClick={leaveRoom} className="leave-btn">
            ← Leave
          </button>
        </div>
      </div>

      {showSearch && (
        <div className="search-bar">
          <input
            type="text"
            placeholder="Search messages..."
            value={searchQuery}
            onChange={(e) => searchMessages(e.target.value)}
            className="search-input"
          />
        </div>
      )}

      {selectedMessages.size > 0 && (
        <div className="selection-bar">
          <div className="selection-info">
            <span>{selectedMessages.size} selected</span>
          </div>
          <div className="selection-actions">
            <button onClick={() => setSelectedMessages(new Set())}>Cancel</button>
            <button>Delete</button>
            <button>Forward</button>
          </div>
        </div>
      )}

      <div className="chat-body">
        <div className="messages-container">
          {messages.map(renderMessage)}
          
          {typingUsers.length > 0 && (
            <div className="typing-indicator">
              <div className="typing-avatar">
                <div className="typing-dots">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
              </div>
              <div className="typing-bubble">
                <span>{typingUsers.join(', ')} {typingUsers.length === 1 ? 'is' : 'are'} typing...</span>
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>

        {showSidebar && (
          <div className="sidebar">
            <div className="sidebar-header">
              <div className="sidebar-title">
                <h4>Group Info</h4>
                <button onClick={() => setShowSidebar(false)}>✕</button>
              </div>
              <div className="group-info">
                <div className="group-avatar-large">👥</div>
                <h3>Room {roomCode}</h3>
                <p>Created today</p>
              </div>
            </div>
            
            <div className="sidebar-section">
              <h5>Participants ({userCount}/2)</h5>
              <div className="participants-list">
                <div className="participant">
                  <div className="avatar" style={{ backgroundColor: avatarColor }}>
                    {getInitials(username)}
                  </div>
                  <div className="participant-info">
                    <span className="participant-name">{username} (You)</span>
                    <span className="participant-status">online</span>
                  </div>
                </div>
                {participants.filter(p => p.username !== username).map(participant => (
                  <div key={participant.username} className="participant">
                    <div className="avatar" style={{ backgroundColor: participant.avatarColor }}>
                      {getInitials(participant.username)}
                    </div>
                    <div className="participant-info">
                      <span className="participant-name">{participant.username}</span>
                      <span className="participant-status">{participant.status}</span>
                    </div>
                  </div>
                ))}
                {userCount < 2 && (
                  <div className="waiting-participant">
                    <div className="avatar waiting-avatar">
                      <span>?</span>
                    </div>
                    <div className="participant-info">
                      <span className="participant-name">Waiting for participant...</span>
                      <span className="participant-status">Share room code: {roomCode}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="message-input-container">
        {replyingTo && (
          <div className="reply-preview-container">
            <div className="reply-preview-content">
              <div className="reply-line"></div>
              <div>
                <div className="reply-username">Replying to {replyingTo.username}</div>
                <div className="reply-text">{replyingTo.message}</div>
              </div>
            </div>
            <button onClick={() => setReplyingTo(null)} className="cancel-reply">✕</button>
          </div>
        )}

        {editingMessage && (
          <div className="edit-preview-container">
            <div className="edit-preview-content">
              <span>✏️ Edit message</span>
            </div>
            <button onClick={() => {
              setEditingMessage(null);
              setNewMessage('');
            }} className="cancel-edit">✕</button>
          </div>
        )}

        {showEmojiPicker && (
          <div className="emoji-picker-container">
            <Picker data={data} onEmojiSelect={onEmojiSelect} theme="light" />
          </div>
        )}
        
        <form onSubmit={sendMessage} className="input-form">
          <button 
            type="button" 
            onClick={() => fileInputRef.current?.click()}
            className="attach-btn"
            title="Attach file"
          >
            📎
          </button>
          
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept="image/*,video/*,.pdf,.doc,.docx"
            style={{ display: 'none' }}
          />
          
          <div className="input-wrapper">
            <input
              ref={messageInputRef}
              type="text"
              placeholder={editingMessage ? "Edit message..." : "Type a message..."}
              value={newMessage}
              onChange={(e) => {
                setNewMessage(e.target.value);
                handleTypingStart();
              }}
              onBlur={handleTypingStop}
              className="message-input"
            />
            
            <button 
              type="button"
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              className="emoji-btn"
              title="Add emoji"
            >
              😊
            </button>
          </div>
          
          {newMessage.trim() ? (
            <button type="submit" className="send-btn" title="Send message">
              {editingMessage ? '✓' : '➤'}
            </button>
          ) : (
            <button 
              type="button" 
              className="voice-btn"
              onMouseDown={startRecording}
              onMouseUp={stopRecording}
              onMouseLeave={stopRecording}
              title="Hold to record voice message"
            >
              {isRecording ? `🔴 ${recordingTime}s` : '🎤'}
            </button>
          )}
        </form>
      </div>
    </div>
  );
}

export default App;