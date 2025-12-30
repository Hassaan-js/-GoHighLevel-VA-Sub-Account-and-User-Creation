const axios = require('axios');
const logger = require('./utils/logger');

class GHLClient {
  constructor() {
    this.apiToken = process.env.GHL_PRIVATE_TOKEN;
    this.baseURL = 'https://services.leadconnectorhq.com';
    this.headers = {
      'Authorization': `Bearer ${this.apiToken}`,
      'Version': '2021-07-28',
      'Content-Type': 'application/json'
    };
    this.maxRetries = 3;
    this.retryDelay = 3000;
  }

  async makeRequest(method, endpoint, data = null, retries = 0) {
    try {
      const config = {
        method,
        url: `${this.baseURL}${endpoint}`,
        headers: this.headers
      };

      if (data) {
        config.data = data;
      }

      const response = await axios(config);
      return response.data;
    } catch (error) {
      logger.error(`API Request Failed: ${method} ${endpoint}`, {
        error: error.message,
        response: error.response?.data,
        status: error.response?.status,
        retries
      });

      if (retries < this.maxRetries) {
        logger.info(`Retrying... Attempt ${retries + 1}/${this.maxRetries}`);
        await this.sleep(this.retryDelay);
        return this.makeRequest(method, endpoint, data, retries + 1);
      }

      throw error;
    }
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async createSubAccount(data) {
    logger.info('Creating sub-account', { email: data.email });
    return await this.makeRequest('POST', '/locations/', data);
  }

  // ✅ FIXED: Create user ON the location (location-scoped)
  async createUserOnLocation(locationId, userData) {
    logger.info('Creating user on location', { 
      email: userData.email,
      locationId: locationId
    });
    // THIS IS THE FIX: /locations/{locationId}/users
    return await this.makeRequest('POST', `/locations/${locationId}/users`, userData);
  }
}

module.exports = new GHLClient();
