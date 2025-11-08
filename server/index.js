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

// --- CORS Configuration ---
app.use(cors({
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Cookie', 'X-Requested-With'],
  exposedHeaders: ['Set-Cookie'],
  preflightContinue: false,
  optionsSuccessStatus: 204
}));

app.options('*', cors());

// Body Parsers
app.use(express.static(__dirname + "/public"));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// Session Configuration
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
      maxAge: 1000 * 60 * 60 * 24,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'none'
    }
  })
);

// Connect to MongoDB
mongoose.connect(process.env.DB_URI)
  .then(() => {
    console.log('MongoDB connected');
  })
  .catch((err) => {
    console.error('MongoDB connection error:', err);
  });

// ============== ROUTES ==============

// Health check - MUST BE FIRST
app.get('/', (req, res) => {
  res.status(200).json({ 
    message: 'Code 1v1 Tournament Platform API is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    routes: {
      health: '/',
      testJdoodle: '/api/tournament/match/test-jdoodle'
    }
  });
});

// Test endpoint - MUST BE BEFORE other match routes
app.get('/api/tournament/match/test-jdoodle', async (req, res) => {
  try {
    console.log('=== JDoodle Test Endpoint Hit ===');
    console.log('CLIENT_ID exists:', !!process.env.CLIENT_ID);
    console.log('CLIENT_SECRET exists:', !!process.env.CLIENT_SECRET);
    
    if (!process.env.CLIENT_ID || !process.env.CLIENT_SECRET) {
      return res.status(500).json({
        success: false,
        error: 'JDoodle credentials not configured',
        hasClientId: !!process.env.CLIENT_ID,
        hasClientSecret: !!process.env.CLIENT_SECRET
      });
    }
    
    const testPayload = {
      clientId: process.env.CLIENT_ID,
      clientSecret: process.env.CLIENT_SECRET,
      script: "print('Hello World')",
      language: "python3",
      stdin: "",
      versionIndex: "0"
    };
    
    console.log('Sending test request to JDoodle...');
    
    const response = await fetch("https://api.jdoodle.com/v1/execute", {
      method: 'POST',
      body: JSON.stringify(testPayload),
      headers: { 'Content-Type': 'application/json' },
    });
    
    console.log('Response status:', response.status);
    
    const data = await response.json();
    console.log('JDoodle Response:', JSON.stringify(data, null, 2));
    
    res.json({
      success: !data.error && data.output,
      status: response.status,
      output: data.output,
      error: data.error,
      statusCode: data.statusCode,
      memory: data.memory,
      cpuTime: data.cpuTime,
      credentials: {
        hasClientId: !!process.env.CLIENT_ID,
        hasClientSecret: !!process.env.CLIENT_SECRET,
        clientIdPrefix: process.env.CLIENT_ID?.substring(0, 8) + '...'
      }
    });
  } catch (error) {
    console.error('Test endpoint error:', error);
    res.status(500).json({ 
      success: false,
      error: error.message,
      stack: error.stack
    });
  }
});

// Auth routes
app.post("/api/auth/signup", authController.signup);
app.post("/api/auth/login", authController.login);
app.get("/api/auth/getUserName", authController.getUserName);

// Room routes
app.post("/api/rooms/create", roomController.createRoom);
app.post("/api/rooms/join", roomController.joinRoom);
app.post("/api/rooms/leave", roomController.leaveRoom);
app.get("/api/rooms/getRoomDetails", roomController.getRoomDetails);
app.delete("/api/rooms/deleteRoom", roomController.deleteRoom);

// Tournament routes
app.post("/api/tournament/startTournament", tourController.startTournament);
app.get("/api/tournament/getTournamentDetails", tourController.getTournamentDetails);
app.post("/api/tournament/startRound", tourController.startRound);
app.post("/api/tournament/leaveTournament", tourController.leaveTournament);
app.post("/api/tournament/endTournament", tourController.endTournament);
app.post("/api/tournament/declareResult", tourController.declareResult);
app.get("/api/tournament/getTime", tourController.getTime);

// Match routes
app.get("/api/tournament/match/getProblemID", matchController.getProblemID);
app.post("/api/tournament/match/submitCode", matchController.submitCode);
app.post("/api/tournament/match/calculateResult", matchController.calculateResult);

// 404 handler - MUST BE LAST
app.all('*', (req, res) => {
  console.log('404 - Route not found:', req.method, req.path);
  res.status(404).json({ 
    message: 'Route not found',
    method: req.method,
    path: req.path,
    availableRoutes: [
      'GET /',
      'GET /api/tournament/match/test-jdoodle',
      'POST /api/auth/signup',
      'POST /api/auth/login',
      'POST /api/tournament/match/submitCode'
    ]
  });
});

// Error handler
app.use((error, req, res, next) => {
  console.error('Server error:', error);
  res.status(500).json({
    message: 'Internal server error',
    error: error.message
  });
});

module.exports = app;