const express = require('express');
const cors    = require('cors');
const path    = require('path');

const endpointRoutes = require('./routes/endpoints');
const mockRoutes     = require('./routes/mock');
const generateRoutes = require('./routes/generate');

const app  = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '5mb' }));
app.use(express.static(path.join(__dirname, '../public')));

// API Routes
app.use('/api/endpoints', endpointRoutes);
app.use('/api', generateRoutes);
app.use('/mock', mockRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Serve frontend for all other routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`No-Code API Builder running on http://localhost:${PORT}`);
  });
}

module.exports = app;
