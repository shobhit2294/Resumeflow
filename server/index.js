const http = require('http');
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
require('dotenv').config({ path: path.join(__dirname, '../.env') });
require('dotenv').config();

const authRoutes = require('./routes/auth');
const jobRoutes = require('./routes/jobs');
const interviewRoutes = require('./routes/interview');
const resumeRoutes = require('./routes/resume');
const analyticsRoutes = require('./routes/analytics');
const reminderRoutes = require('./routes/reminders');
const jobsSearchRoutes = require('./routes/jobs-search');
const portalRoutes = require('./routes/portal');
const readinessRoutes = require('./routes/readiness');
const recommendationRoutes = require('./routes/recommendations');
const intelRoutes = require('./routes/intel');

const app = express();
const httpServer = http.createServer(app);

// ─── Socket.io ────────────────────────────────────────────────────────────────
let io;
(async () => {
  try {
    const { Server } = require('socket.io');
    const jwt = require('jsonwebtoken');

    io = new Server(httpServer, {
      cors: {
        origin: process.env.CLIENT_URL || 'http://localhost:5173',
        credentials: true,
      },
      transports: ['websocket', 'polling'],
    });

    // Try Redis adapter for multi-instance pub/sub
    try {
      const { createAdapter } = require('@socket.io/redis-adapter');
      const { getRedis } = require('./utils/redis');
      const pub = getRedis();
      if (pub) {
        const sub = pub.duplicate();
        pub.on('error', (e) => console.warn('⚠️  Redis pub notice:', e.message));
        sub.on('error', (e) => console.warn('⚠️  Redis sub notice:', e.message));
        let adapterAttached = false;
        const attachRedisAdapter = () => {
          if (adapterAttached || pub.status !== 'ready' || sub.status !== 'ready') return;
          try {
            io.adapter(createAdapter(pub, sub));
            adapterAttached = true;
            console.log('✅ Socket.io using Redis adapter');
          } catch (adapterErr) {
            console.warn('⚠️  Socket.io Redis adapter unavailable:', adapterErr.message);
          }
        };
        pub.on('ready', attachRedisAdapter);
        sub.on('ready', attachRedisAdapter);
        attachRedisAdapter();
      }
    } catch (adapterErr) {
      console.log('ℹ️  Socket.io using in-memory adapter:', adapterErr.message);
    }

    // Auth middleware
    io.use((socket, next) => {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error('Authentication required'));
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        socket.userId = decoded.id;
        next();
      } catch (_) {
        next(new Error('Invalid token'));
      }
    });

    io.on('connection', (socket) => {
      console.log(`🔌 Socket connected: user ${socket.userId}`);
      socket.join(`user:${socket.userId}`);

      socket.on('disconnect', () => {
        console.log(`🔌 Socket disconnected: user ${socket.userId}`);
      });
    });

    app.set('io', io);
  } catch (err) {
    console.warn('⚠️  Socket.io init failed:', err.message);
  }
})();

// ─── Security & Parsing ───────────────────────────────────────────────────────
app.use(helmet());
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true,
}));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: 'Too many requests, please try again later.' },
});
app.use('/api/', limiter);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/jobs', jobRoutes);
app.use('/api/interview', interviewRoutes);
app.use('/api/resume', resumeRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/reminders', reminderRoutes);
app.use('/api/jobs-search', jobsSearchRoutes);
app.use('/api/portal', portalRoutes);
app.use('/api/readiness', readinessRoutes);
app.use('/api/recommendations', recommendationRoutes);
app.use('/api/intel', intelRoutes);

// Health check
app.get('/api/health', (req, res) =>
  res.json({ status: 'ok', time: new Date(), instance: process.env.HOSTNAME || 'local' })
);

// ─── Global Error Handler ─────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error(err.stack);

  if (err.name === 'ValidationError') {
    const msg = Object.values(err.errors).map((e) => e.message).join(', ');
    return res.status(400).json({ error: msg });
  }
  if (err.name === 'CastError') {
    return res.status(400).json({ error: 'Invalid ID format.' });
  }
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    return res.status(409).json({ error: `${field} already exists.` });
  }

  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
  });
});

// ─── MongoDB + Server Start ───────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;

async function startServer() {
  let mongoUri = process.env.MONGO_URI || 'mongodb://mongo:27017/resumeflow';

  let connected = false;
  try {
    await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 4000 });
    console.log(`✅ MongoDB connected to ${mongoUri.includes('@') ? 'Atlas' : mongoUri}`);
    connected = true;
  } catch (err) {
    console.warn('⚠️  Primary MongoDB unreachable:', err.message.split('\n')[0]);
  }

  // If primary failed, try local docker mongo container
  if (!connected && !mongoUri.includes('mongo:27017')) {
    try {
      console.log('🔄 Trying Docker MongoDB at mongodb://mongo:27017/resumeflow ...');
      await mongoose.connect('mongodb://mongo:27017/resumeflow', { serverSelectionTimeoutMS: 3000 });
      console.log('✅ Connected to Docker MongoDB');
      connected = true;
    } catch (_) {
      // Continue to in-memory fallback
    }
  }

  // In-memory fallback
  if (!connected) {
    console.log('🔄 Falling back to in-memory MongoDB for local dev...');
    try {
      const { MongoMemoryServer } = require('mongodb-memory-server');
      const memServer = await MongoMemoryServer.create();
      const memUri = memServer.getUri();
      await mongoose.connect(memUri);
      console.log('✅ MongoDB connected (in-memory, dev only — data resets on restart)');
      connected = true;
    } catch (memErr) {
      console.error('❌ Could not start in-memory MongoDB:', memErr.message);
      process.exit(1);
    }
  }

  httpServer.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
  httpServer.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`❌ Port ${PORT} is already in use.`);
      console.error(`   Run this to free it:  npx kill-port ${PORT}`);
    } else {
      console.error('❌ Server error:', err.message);
    }
    process.exit(1);
  });
}

startServer();

module.exports = { app, httpServer, getIo: () => io };
