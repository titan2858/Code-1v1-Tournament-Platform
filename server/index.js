const express = require("express");
const mongoose = require("mongoose");
const bodyParser = require("body-parser");
const session = require("express-session");
const MongoStore = require('connect-mongo');
const cors = require("cors");
const dotenv = require('dotenv');

// CONTROLLERS
const authController = require("./controllers/authController");
const roomController = require("./controllers/roomController");
const tourController = require("./controllers/tourController");
const matchController = require("./controllers/matchController");

dotenv.config();

// Initialize Express app
const app = express();

// --- START: CORRECT MIDDLEWARE ORDER ---

// 1. CORS Configuration - UPDATED WITH YOUR NEW FRONTEND URL
app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    const allowedOrigins = [
      'https://code-1v1-tournament-platform-frontend-icpzxz3v6.vercel.app', // YOUR NEW FRONTEND URL
      'https://code-1v1-tournament-platform-frontend-8jj7krknp.vercel.app', // OLD URL (in case)
      'http://localhost:3000',
      'http://localhost:5173',
      'http://localhost:5000'
    ];
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      // For testing, allow all origins
      callback(null, true);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Cookie', 'X-Requested-With'],
  exposedHeaders: ['Set-Cookie']
}));

// Handles preflight 'OPTIONS' requests
app.options('*', cors());

// 2. Body Parsers and Static Files
app.use(express.static(__dirname + "/public"));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// 3. Session Configuration
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'fallback-secret-key-change-in-production',
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
      mongoUrl: process.env.DB_URI,
      collectionName: 'sessions'
    }),
    cookie: {
      maxAge: 1000 * 60 * 60 * 24, // 1 day
      httpOnly: true,
      secure: true, // Always true for Vercel (HTTPS)
      sameSite: 'none' // Required for cross-origin
    }
  })
);

// --- END: CORRECT MIDDLEWARE ORDER ---

// Connect to MongoDB
mongoose.connect(process.env.DB_URI)
  .then(() => {
    console.log('MongoDB connected');
  })
  .catch((err) => {
    console.error('MongoDB connection error:', err);
  });

// --- ROUTES ---
// Auth routes
app.post("/api/auth/signup", authController.signup);
app.post("/api/auth/login", authController.login);
app.get("/api/auth/getUserName", authController.getUserName);

// Routes for room operations
app.post("/api/rooms/create", roomController.createRoom);
app.post("/api/rooms/join", roomController.joinRoom);
app.post("/api/rooms/leave", roomController.leaveRoom);
app.get("/api/rooms/getRoomDetails", roomController.getRoomDetails);
app.delete("/api/rooms/deleteRoom", roomController.deleteRoom);

// Routes for tournament
app.post("/api/tournament/startTournament", tourController.startTournament);
app.get("/api/tournament/getTournamentDetails", tourController.getTournamentDetails);
app.post("/api/tournament/startRound", tourController.startRound);
app.post("/api/tournament/leaveTournament", tourController.leaveTournament);
app.post("/api/tournament/endTournament", tourController.endTournament);
app.post("/api/tournament/declareResult", tourController.declareResult);
app.get("/api/tournament/getTime", tourController.getTime);

// Routes for match
app.get("/api/tournament/match/getProblemID", matchController.getProblemID);
app.post("/api/tournament/match/submitCode", matchController.submitCode);
app.post("/api/tournament/match/calculateResult", matchController.calculateResult);

// Health check route
app.get('/', (req, res) => {
  res.status(200).json({ 
    message: 'Code 1v1 Tournament Platform API is running',
    timestamp: new Date().toISOString(),
    cors: 'enabled'
  });
});

// Default 404 route
app.all('*', (req, res) => {
  res.status(404).json({ 
    message: 'Route not found',
    path: req.path 
  });
});

// Export app for Vercel
module.exports = app;