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
const portalRoutes = require('./routes/portal');
const readinessRoutes = require('./routes/readiness');
const recommendationRoutes = require('./routes/recommendations');
const intelRoutes = require('./routes/intel');

const app = express();
const httpServer = http.createServer(app);

// Reuse one Mongoose connection across warm Vercel function invocations.
const mongoCache = global.__careerPilotMongoCache || {
  connection: null,
  promise: null,
};
global.__careerPilotMongoCache = mongoCache;

async function connectMongo(uri) {
  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  // Discard a stale resolved promise after a connection was dropped.
  if (mongoose.connection.readyState === 0 && mongoCache.connection) {
    mongoCache.connection = null;
    mongoCache.promise = null;
  }

  if (!mongoCache.promise) {
    mongoCache.promise = mongoose.connect(uri, {
      serverSelectionTimeoutMS: 10000,
      maxPoolSize: 10,
      minPoolSize: 0,
      maxIdleTimeMS: 60000,
    }).then(() => {
      mongoCache.connection = mongoose.connection;
      return mongoose.connection;
    }).catch((error) => {
      mongoCache.promise = null;
      mongoCache.connection = null;
      throw error;
    });
  }

  return mongoCache.promise;
}

async function connectDatabase() {
  const mongoUri = process.env.MONGO_URI;

  if (!mongoUri && process.env.NODE_ENV === 'production') {
    throw new Error('MONGO_URI is required in production. Configure it in Vercel Environment Variables.');
  }

  return connectMongo(mongoUri || 'mongodb://127.0.0.1:27017/resumeflow');
}

// Vercel provides VERCEL_URL for the active deployment. CLIENT_URL can be
// set to the stable production domain; localhost remains available in dev.
function normalizeOrigin(value) {
  if (!value) return null;
  const candidate = /^https?:\/\//i.test(value) ? value : `https://${value}`;
  try {
    return new URL(candidate).origin;
  } catch (_) {
    return null;
  }
}

const allowedOrigins = new Set([
  normalizeOrigin(process.env.CLIENT_URL),
  normalizeOrigin(process.env.VERCEL_URL),
  normalizeOrigin(process.env.VERCEL_BRANCH_URL),
  'http://localhost:5173',
].filter(Boolean));

const corsOptions = {
  origin(origin, callback) {
    if (!origin || allowedOrigins.has(origin)) return callback(null, true);
    return callback(new Error('Origin is not allowed by CORS.'));
  },
  credentials: true,
};

app.use(helmet());
app.use(cors(corsOptions));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});
app.use('/api/', limiter);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Every API request waits for MongoDB. This prevents Mongoose from silently
// buffering writes while the serverless function has no database connection.
app.use('/api', async (req, res, next) => {
  try {
    await connectDatabase();
    next();
  } catch (error) {
    console.error('MongoDB connection failed:', error.message);
    res.status(503).json({
      error: 'Database is temporarily unavailable. Check the MONGO_URI setting and MongoDB Atlas network access.',
    });
  }
});

// Health check also verifies the database connection because it follows the
// database middleware above.
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    time: new Date(),
    instance: process.env.VERCEL_URL || process.env.HOSTNAME || 'local',
  });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/jobs', jobRoutes);
app.use('/api/interview', interviewRoutes);
app.use('/api/resume', resumeRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/reminders', reminderRoutes);
app.use('/api/portal', portalRoutes);
app.use('/api/readiness', readinessRoutes);
app.use('/api/recommendations', recommendationRoutes);
app.use('/api/intel', intelRoutes);

// Socket.IO is attached to the HTTP server and the HTTP server is exported
// below. Vercel Functions support WebSocket connections; Redis is optional
// and is used only when REDIS_URL is configured.
let io;
try {
  const { Server } = require('socket.io');
  const jwt = require('jsonwebtoken');

  io = new Server(httpServer, {
    cors: corsOptions,
    transports: ['websocket', 'polling'],
  });

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('Authentication required'));

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = decoded.id;
      return next();
    } catch (_) {
      return next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    socket.join(`user:${socket.userId}`);
    socket.on('disconnect', () => {
      console.log(`Socket disconnected: user ${socket.userId}`);
    });
  });

  app.set('io', io);

  // Attach the Redis adapter only when a managed Redis URL is configured.
  try {
    if (process.env.REDIS_URL) {
      const { createAdapter } = require('@socket.io/redis-adapter');
      const { getRedis } = require('./utils/redis');
      const pub = getRedis();

      if (pub) {
        const sub = pub.duplicate();
        let adapterAttached = false;
        const attachAdapter = () => {
          if (adapterAttached || pub.status !== 'ready' || sub.status !== 'ready') return;
          io.adapter(createAdapter(pub, sub));
          adapterAttached = true;
          console.log('Socket.IO Redis adapter attached');
        };
        pub.on('ready', attachAdapter);
        sub.on('ready', attachAdapter);
        pub.on('error', (error) => console.warn('Redis publisher:', error.message));
        sub.on('error', (error) => console.warn('Redis subscriber:', error.message));
        attachAdapter();
      }
    }
  } catch (error) {
    console.warn('Socket.IO Redis adapter unavailable:', error.message);
  }
} catch (error) {
  console.error('Socket.IO initialization failed:', error.message);
}

// Centralized error handler.
app.use((err, req, res, next) => {
  console.error(err.stack || err.message);

  if (res.headersSent) return next(err);

  if (err.name === 'ValidationError') {
    const message = Object.values(err.errors).map((item) => item.message).join(', ');
    return res.status(400).json({ error: message });
  }
  if (err.name === 'CastError') {
    return res.status(400).json({ error: 'Invalid ID format.' });
  }
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    return res.status(409).json({ error: `${field} already exists.` });
  }

  const status = err.status || 500;
  return res.status(status).json({
    error: process.env.NODE_ENV === 'production' && status >= 500
      ? 'Internal server error'
      : (err.message || 'Internal server error'),
  });
});

// Local development keeps the normal persistent HTTP listener and local
// MongoDB fallback. Production exports the HTTP server to Vercel and never
// calls listen() or starts an in-memory database.
async function startServer() {
  try {
    await connectDatabase();
    console.log('MongoDB connected');
  } catch (primaryError) {
    if (process.env.NODE_ENV === 'production') throw primaryError;

    console.warn('Primary MongoDB unavailable:', primaryError.message);
    try {
      await connectMongo('mongodb://mongo:27017/resumeflow');
      console.log('Connected to Docker MongoDB');
    } catch (_) {
      const { MongoMemoryServer } = require('mongodb-memory-server');
      const memoryServer = await MongoMemoryServer.create();
      await connectMongo(memoryServer.getUri());
      console.log('Connected to in-memory MongoDB (development only; data resets on restart)');
    }
  }

  const port = process.env.PORT || 5000;
  httpServer.listen(port, () => {
    console.log(`CareerPilot API listening on port ${port}`);
  });
}

if (require.main === module) {
  startServer().catch((error) => {
    console.error('Unable to start CareerPilot API:', error);
    process.exit(1);
  });
}

// Export the HTTP server (not a manually-listening process) so Vercel can
// handle HTTP requests and Socket.IO WebSocket upgrades in its function runtime.
module.exports = httpServer;
module.exports.app = app;
module.exports.httpServer = httpServer;
module.exports.getIo = () => io;
module.exports.connectDatabase = connectDatabase;
