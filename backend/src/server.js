require('dotenv').config();

const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');
const contractRoutes = require('./routes/contractRoutes');
const ApiError = require('./utils/ApiError');

const app = express();
const PORT = process.env.PORT || 5000;

// ── Database ─────────────────────────────────────────────────────────────────
connectDB();

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json({ limit: '11mb' }));
app.use(express.urlencoded({ extended: true, limit: '11mb' }));

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/api/contracts', contractRoutes);

// Health check endpoint
app.get('/health', (_req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'LexGuard API',
    version: '1.0.0',
    phase: 'Phase 1 – Core Backend & Parsing',
  });
});

// ── 404 Handler ───────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.method} ${req.originalUrl} not found.`,
  });
});

// ── Global Error Handler ──────────────────────────────────────────────────────
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  // Multer file size exceeded
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({
      success: false,
      message: 'File too large. Maximum allowed upload size is 10 MB.',
    });
  }

  // Multer fileFilter rejection (plain Error with statusCode)
  if (err.statusCode && !(err instanceof ApiError)) {
    return res.status(err.statusCode).json({
      success: false,
      message: err.message,
    });
  }

  // Known application errors
  if (err instanceof ApiError) {
    return res.status(err.statusCode).json({
      success: false,
      message: err.message,
      errors: err.errors,
    });
  }

  // Unknown/unexpected errors
  console.error('Unhandled error:', err);
  return res.status(500).json({
    success: false,
    message: 'An unexpected internal error occurred. Please try again later.',
  });
});

// ── Start Server ──────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`🚀 LexGuard API running at http://localhost:${PORT}`);
  console.log(`📋 Health check: http://localhost:${PORT}/health`);
});

module.exports = app;
