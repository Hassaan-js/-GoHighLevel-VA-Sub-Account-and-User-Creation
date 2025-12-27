require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
// Fixed path: opportunityHandler.js is in root, not in /webhooks
const opportunityHandler = require('./opportunityHandler');
const logger = require('./utils/logger');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Create logs directory if it doesn't exist
if (!fs.existsSync('logs')) {
  fs.mkdirSync('logs');
}

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Main webhook endpoint
app.post('/webhook/ghl-opportunity-stage', async (req, res) => {
  const webhookData = req.body;

  logger.info('Webhook received', {
    type: webhookData.type,
    opportunityId: webhookData.id,
    stage: webhookData.pipeline_stage
  });

  try {
    // Respond immediately to GHL
    res.status(200).json({
      received: true,
      timestamp: new Date().toISOString()
    });

    // Process asynchronously
    const result = await opportunityHandler.handleStageChange(webhookData);

    if (result.skipped) {
      logger.info('Webhook processed - skipped (wrong stage)');
    } else {
      logger.info('Webhook processed successfully', {
        subAccountId: result.subAccountId,
        duration: result.duration
      });
    }
  } catch (error) {
    logger.error('Webhook processing failed', {
      error: error.message,
      stack: error.stack,
      webhookData
    });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error('Unhandled error', {
    error: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method
  });

  res.status(500).json({
    error: 'Internal server error',
    timestamp: new Date().toISOString()
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Endpoint not found',
    path: req.path
  });
});

// Start server
app.listen(PORT, () => {
  logger.info(`Server started on port ${PORT}`);
  logger.info('Environment:', process.env.NODE_ENV);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  process.exit(0);
});
process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  process.exit(0);
});
