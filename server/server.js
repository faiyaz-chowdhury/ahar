const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const authRoutes = require('./routes/authRoutes');
const menuRoutes = require('./routes/menuRoutes');
const orderRoutes = require('./routes/orderRoutes');
const inventoryRoutes = require('./routes/inventoryRoutes');
const reservationRoutes = require('./routes/reservationRoutes');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.NODE_ENV === "production" ? false : "http://localhost:5173", // Replace with your frontend URL in development
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"]
  }
});

const PORT = process.env.PORT || 8000;

// CORS configuration - more restrictive in production
if (process.env.NODE_ENV === "production") {
  app.use(cors({
    origin: process.env.CLIENT_URL || true,
    credentials: true
  }));
} else {
  app.use(cors()); // More permissive in development
}

app.use(express.json());

// MongoDB Connection
const dbUrl = process.env.MONGODB_URL;
if (!dbUrl) {
    console.error('MONGODB_URI is not defined in environment variables.');
    process.exit(1); 
}

mongoose.connect(dbUrl)
    .then(() => console.log('MongoDB Connected'))
    .catch(err => {
        console.error('MongoDB connection error:', err);
        process.exit(1); 
    });

// Routes - define API routes before static file serving
app.use('/api/auth', authRoutes);
app.use('/api/menu', menuRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/reservations', reservationRoutes);

// Socket.IO Connection
io.on('connection', (socket) => {
    console.log('A user connected');

    socket.on('disconnect', () => {
        console.log('User disconnected');
    });

    // Example of emitting an event to the client
    socket.emit('message', 'Welcome to AharConnect!');

    // Example of listening to an event from the client
    socket.on('chat message', (msg) => {
        console.log('message: ' + msg);
        // Example of broadcasting a message to all clients
        io.emit('chat message', msg);
    });
    
    // Example: Broadcasting order updates
    socket.on('orderUpdate', (order) => {
        io.emit('orderUpdated', order);
    });
});

// Serve static assets in production
if (process.env.NODE_ENV === "production") {
  app.use(express.static(path.join(__dirname, "../client/dist")));
  app.get("*", (req, res) => {
      res.sendFile(path.resolve(__dirname, "../client/dist/index.html"));
  });
}

// Start server
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});