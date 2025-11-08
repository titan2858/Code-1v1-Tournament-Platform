const express = require("express");
const mongoose = require("mongoose");
const bodyParser = require("body-parser");
const session = require("express-session");
const authController = require("./controllers/authController");
const roomController = require("./controllers/roomController");
const tourController = require("./controllers/tourController");
const matchController = require("./controllers/matchController");
const cors = require("cors");
// const { Mutex } = require('async-mutex'); // <-- REMOVED
const dotenv = require('dotenv');

dotenv.config();

// Initialize Express app
const app = express();
// --- New CORS Configuration ---

// List all the frontend URLs that are allowed to make requests
// --- New, Permanent CORS Configuration ---

// List all the frontend URLs that are allowed to make requests
const allowedOrigins = [
  'https://code-1v1-frontend.vercel.app', // Your main production frontend
  'http://localhost:3000', // For your local development

  // This new line is a "wildcard" (Regular Expression)
  // It will match all URLs that start with 'code-1v1-tournament-platform-frontend-'
  new RegExp(/^https?:\/\/code-1v1-tournament-platform-frontend-.*\.vercel\.app$/)
];

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);

    // Check if origin is in our list OR matches our regex
    const isAllowed = allowedOrigins.some(allowedOrigin => {
      if (typeof allowedOrigin === 'string') {
        return allowedOrigin === origin;
      }
      if (allowedOrigin instanceof RegExp) {
        return allowedOrigin.test(origin);
      }
      return false;
    });

    if (isAllowed) {
      return callback(null, true);
    } else {
      const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
      return callback(new Error(msg), false);
    }
  },
  credentials: true // This allows sessions/cookies
}));

// This part stays the same
app.options('*', cors()); 

// --- End of New CORS Configuration ---

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);

    if (allowedOrigins.indexOf(origin) === -1) {
      const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
      return callback(new Error(msg), false);
    }
    return callback(null, true);
  },
  credentials: true // This allows sessions/cookies
}));

// This next line is important!
// It handles the "preflight" OPTIONS request that browsers send
// before a POST, PUT, or DELETE request.
app.options('*', cors()); 

// --- End of New CORS Configuration ---

// Define Express middleware
app.use(express.static(__dirname + "/public"));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: true,
    saveUninitialized: true,
  })
);

// Connect to MongoDB
// Removed deprecated options
mongoose.connect(process.env.DB_URI)
  .then(() => {
    console.log('MongoDB connected');
  })
  .catch((err) => {
    console.error('MongoDB connection error:', err);
  });

// const mutex = new Mutex(); // <-- REMOVED

// Routes for user authentication
// Mutex wrapper removed
app.post("/api/auth/signup", authController.signup);
app.post("/api/auth/login", authController.login);
app.get("/api/auth/getUserName", authController.getUserName);

// Routes for room operations
// Mutex wrapper removed
app.post("/api/rooms/create", roomController.createRoom);
app.post("/api/rooms/join", roomController.joinRoom);
app.post("/api/rooms/leave", roomController.leaveRoom);
app.get("/api/rooms/getRoomDetails", roomController.getRoomDetails);
app.delete("/api/rooms/deleteRoom", roomController.deleteRoom);

//Routes for tournament
// Mutex wrapper removed
app.post("/api/tournament/startTournament", tourController.startTournament);
app.get("/api/tournament/getTournamentDetails", tourController.getTournamentDetails);
app.post("/api/tournament/startRound", tourController.startRound);
app.post("/api/tournament/leaveTournament", tourController.leaveTournament);
app.post("/api/tournament/endTournament", tourController.endTournament);
app.post("/api/tournament/declareResult", tourController.declareResult);
app.get("/api/tournament/getTime", tourController.getTime);

//Routes for match
// Mutex wrapper removed
app.get("/api/tournament/match/getProblemID", matchController.getProblemID);
app.post("/api/tournament/match/submitCode", matchController.submitCode);
app.post("/api/tournament/match/calculateResult", matchController.calculateResult);

// Define the default route
app.all('*', (req, res) => {
  res.status(404).send({ message: 'Route not found' });
});

// Start server
// const PORT = process.env.PORT || 5000; // <-- VERCEL IGNORES THIS
// app.listen(PORT, () => { // <-- REMOVED for Vercel
//   console.log(`Server is running on port ${PORT}`);
// });

// ADD THIS LINE FOR VERCEL:
module.exports = app;