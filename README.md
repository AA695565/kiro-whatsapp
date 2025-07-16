# 💬 WhatsApp Clone - Advanced Real-time Chat

A comprehensive WhatsApp clone with advanced features built with React and Socket.io. This application replicates most of WhatsApp's core functionality including real-time messaging, media sharing, voice messages, message reactions, and much more.

## 🚀 Features

### 💬 Core Chat Features
- ✅ **Real-time messaging** with Socket.io
- ✅ **Message status indicators** (✓ Sent, ✓✓ Delivered, ✓✓ Blue = Seen)
- ✅ **Typing indicators** ("User is typing...")
- ✅ **Message timestamps** with WhatsApp-like formatting
- ✅ **Auto-scroll** to latest messages
- ✅ **Message bubbles** (right for self, left for others)

### 😄 Emoji & Reactions
- ✅ **Emoji picker** with full emoji support
- ✅ **Message reactions** (👍❤️😂 and more)
- ✅ **Emoji in messages** with native emoji rendering

### 📎 Media & File Sharing
- ✅ **Image sharing** (JPEG, PNG) with preview
- ✅ **Video sharing** (MP4) with inline player
- ✅ **File sharing** (PDF, DOCX) with file info
- ✅ **Voice messages** (hold to record)
- ✅ **Media preview** before sending

### 💬 Advanced Messaging
- ✅ **Reply to messages** with quote preview
- ✅ **Edit messages** (for text messages)
- ✅ **Delete messages** (for self or everyone)
- ✅ **Forward messages** between rooms
- ✅ **Message selection** (multi-select)
- ✅ **Search messages** with real-time filtering

### 👥 User & Room Management
- ✅ **6-digit room codes** for easy joining
- ✅ **Random usernames** (CoolTiger123 format)
- ✅ **User avatars** with initials and colors
- ✅ **Participant list** with online status
- ✅ **User status messages** ("Hey there! I am using WhatsApp")
- ✅ **Room expiry** (30 minutes of inactivity)

### 🎨 UI/UX Features
- ✅ **WhatsApp-like design** with green theme
- ✅ **Mobile-responsive** layout
- ✅ **Smooth animations** and transitions
- ✅ **Dark mode support** (system preference)
- ✅ **Accessibility features** (high contrast, reduced motion)
- ✅ **Sound notifications** for new messages

### 🔧 Technical Features
- ✅ **No authentication** required
- ✅ **In-memory storage** (no database needed)
- ✅ **Real-time synchronization** across all users
- ✅ **Automatic room cleanup**
- ✅ **Error handling** and reconnection
- ✅ **Print-friendly** message history

## 🛠️ Technical Stack

- **Frontend:** React 19, CSS3, Emoji Mart
- **Backend:** Node.js, Express, Socket.io
- **Real-time:** WebSocket connections
- **Storage:** In-memory (Map-based)
- **Media:** Base64 encoding for files

## 🚀 Quick Start

### 1. Install Dependencies
```bash
# Install server dependencies
npm install

# Install client dependencies
cd client && npm install --legacy-peer-deps
```

### 2. Start the Application
```bash
# Option 1: Run both server and client together (Recommended)
npm run dev

# Option 2: Run separately
# Terminal 1: Start server
npm start

# Terminal 2: Start client
cd client && npm start
```

### 3. Open Your Browser
- Navigate to `http://localhost:3000`
- Enter a 6-digit room code (e.g., `123456`)
- Start chatting with WhatsApp-like features!

## 📱 How to Use

### Basic Usage
1. **Join Room:** Enter any 6-digit number (123456, 999999, etc.)
2. **Send Messages:** Type and press Enter or click Send
3. **Share Media:** Click 📎 to attach images, videos, or files
4. **Voice Messages:** Hold 🎤 button to record voice messages
5. **Reactions:** Click message actions (👍❤️😂) to react

### Advanced Features
- **Reply:** Right-click message → Reply
- **Edit:** Right-click your text message → Edit
- **Delete:** Right-click message → Delete (for me/everyone)
- **Forward:** Right-click message → Forward
- **Search:** Click 🔍 to search messages
- **Participants:** Click ⋮ to view room info and participants

### Keyboard Shortcuts
- `Enter` - Send message
- `Shift + Enter` - New line
- `Esc` - Cancel reply/edit
- `Ctrl + F` - Search messages

## 🎯 Room Codes

- **Format:** Exactly 6 digits (000000-999999)
- **Examples:** 123456, 555555, 000001
- **Auto-creation:** Rooms created when first user joins
- **Auto-cleanup:** Rooms deleted after 30 minutes of inactivity
- **Sharing:** Share room code with others to chat together

## 🔊 Voice Messages

- **Record:** Hold the 🎤 button to record
- **Duration:** Shows recording time in real-time
- **Playback:** Click ▶️ to play voice messages
- **Format:** WebM/WAV audio format

## 📱 Mobile Experience

- **Responsive Design:** Optimized for mobile devices
- **Touch Gestures:** Tap to select, long-press for menu
- **Mobile Keyboard:** Proper input handling
- **Viewport Optimization:** Full-screen chat experience

## 🎨 Customization

### Themes
- **Light Mode:** Default WhatsApp-like green theme
- **Dark Mode:** Automatic based on system preference
- **High Contrast:** Accessibility support

### Colors
- **Primary:** #25d366 (WhatsApp Green)
- **Secondary:** #128c7e (Dark Green)
- **Background:** Gradient with subtle patterns
- **Bubbles:** Green for own, white for others

## 🔒 Privacy & Security

- **No Registration:** No personal information required
- **Temporary Storage:** Messages stored in memory only
- **Auto-Cleanup:** Rooms and messages automatically deleted
- **No Persistence:** Data not saved to disk
- **Local Processing:** Media processed client-side

## 🚀 Performance

- **Real-time:** Sub-100ms message delivery
- **Efficient:** Optimized React rendering
- **Scalable:** Handles multiple concurrent rooms
- **Memory Management:** Automatic cleanup of inactive rooms
- **Bandwidth:** Optimized for low-bandwidth connections

## 🐛 Known Limitations

- **Storage:** Messages lost on server restart (by design)
- **File Size:** 50MB limit for media files
- **Voice Quality:** Depends on browser support
- **Concurrent Users:** Optimized for small groups (2-20 users)

## 🔮 Future Enhancements

- [ ] **Message encryption** (end-to-end)
- [ ] **Push notifications** (service worker)
- [ ] **Message persistence** (optional database)
- [ ] **Video calls** (WebRTC integration)
- [ ] **Screen sharing** capability
- [ ] **Message scheduling** feature
- [ ] **Custom themes** and wallpapers
- [ ] **Message translation** (auto-translate)

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

This project is open source and available under the [MIT License](LICENSE).

## 🎉 Enjoy Your WhatsApp Clone!

Experience the full power of modern real-time communication with this comprehensive WhatsApp clone. Perfect for teams, friends, or anyone who wants a private, temporary chat solution without the need for accounts or data persistence.

**Happy Chatting!** 💬🚀