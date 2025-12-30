require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const opportunityHandler = require('./opportunityHandler');
const logger = require('./utils/logger');

const app = express();
const PORT = process.env.PORT || 3000;

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
app.post('/webhook/ghl-workflow', async (req, res) => {
  const webhookData = req.body;
  
  logger.info('Webhook received from GHL workflow', {
    opportunityId: webhookData.opportunityId,
    contactEmail: webhookData.contactEmail
  });

  try {
    const result = await opportunityHandler.handleStageChange(webhookData);
    res.status(200).json(result);
  } catch (error) {
    logger.error('Webhook processing failed', {
      error: error.message,
      stack: error.stack
    });

    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error('Unhandled error', {
    error: err.message,
    stack: err.stack
  });
  
  res.status(500).json({ 
    success: false,
    error: 'Internal server error',
    timestamp: new Date().toISOString()
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ 
    success: false,
    error: 'Endpoint not found',
    path: req.path 
  });
});

// Start server
app.listen(PORT, () => {
  logger.info(`Server started on port ${PORT}`);
  logger.info('Environment:', process.env.NODE_ENV);
  logger.info('Ready to receive GHL workflow webhooks');
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
