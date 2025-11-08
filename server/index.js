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
  origin: '*', // Allows all origins
  credentials: true 
}));
app.options('*', cors()); // Handles preflight 'OPTIONS' requests

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
      maxAge: 1000 * 60 * 60 * 24 // 1 day
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
// (We already removed the 'async-mutex' wrappers from these)
app.post("/api/auth/signup", authController.signup);
app.post("/api/auth/login", authController.login);
app.get("/api/auth/getUserName", authController.getUserName);

// Routes for room operations
app.post("/api/rooms/create", roomController.createRoom);
app.post("/api/rooms/join", roomController.joinRoom);
app.post("/api/rooms/leave", roomController.leaveRoom);
app.get("/api/rooms/getRoomDetails", roomController.getRoomDetails);
app.delete("/api/rooms/deleteRoom", roomController.deleteRoom);

//Routes for tournament
app.post("/api/tournament/startTournament", tourController.startTournament);
app.get("/api/tournament/getTournamentDetails", tourController.getTournamentDetails);
app.post("/api/tournament/startRound", tourController.startRound);
app.post("/api/tournament/leaveTournament", tourController.leaveTournament);
app.post("/api/tournament/endTournament", tourController.endTournament);
app.post("/api/tournament/declareResult", tourController.declareResult);
app.get("/api/tournament/getTime", tourController.getTime);

//Routes for match
app.get("/api/tournament/match/getProblemID", matchController.getProblemID);
app.post("/api/tournament/match/submitCode", matchController.submitCode);
app.post("/api/tournament/match/calculateResult", matchController.calculateResult);

// Default 404 route
app.all('*', (req, res) => {
  res.status(404).send({ message: 'Route not found' });
});

// Export app for Vercel
module.exports = app;