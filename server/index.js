const express = require("express");
const mongoose = require("mongoose");
const bodyParser = require("body-parser");
const session = require("express-session");
const MongoStore = require('connect-mongo'); // For production sessions
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

// 1. CORS Configuration
// This MUST come before sessions and routes to handle preflight requests.
app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    const allowedOrigins = [
      'https://code-1v1-tournament-platform-frontend-8jj7krknp.vercel.app',
      'http://localhost:3000',
      'http://localhost:5173',
      'http://localhost:5000'
    ];
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      // For now, allow all origins for testing
      // In production, you should change this to: callback(new Error('Not allowed by CORS'));
      callback(null, true);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Cookie']
}));

// Handles preflight 'OPTIONS' requests
app.options('*', cors());

// 2. Body Parsers and Static Files
app.use(express.static(__dirname + "/public"));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// 3. Session Configuration (with MongoStore)
// This MUST come after parsers but before routes.
app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false, // Don't save session if unmodified
    saveUninitialized: false, // Don't create session until something stored
    store: MongoStore.create({
      mongoUrl: process.env.DB_URI, // Use your existing DB_URI
      collectionName: 'sessions' // Name of the collection to store sessions
    }),
    cookie: {
      maxAge: 1000 * 60 * 60 * 24, // 1 day
      httpOnly: true, // Prevents client-side JavaScript from accessing the cookie
      secure: process.env.NODE_ENV === 'production', // Use secure cookies in production (HTTPS only)
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax' // 'none' required for cross-origin in production
    }
  })
);

// --- END: CORRECT MIDDLEWARE ORDER ---


// Connect to MongoDB
mongoose.connect(process.env.DB_URI) // Removed deprecated options
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

// Health check route (useful for Vercel)
app.get('/', (req, res) => {
  res.status(200).json({ 
    message: 'Code 1v1 Tournament Platform API is running',
    timestamp: new Date().toISOString()
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