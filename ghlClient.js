const axios = require('axios');
const logger = require('./logger');

class GHLClient {
  constructor() {
    this.apiToken = process.env.GHL_PRIVATE_TOKEN;
    this.baseURL = 'https://services.leadconnectorhq.com';
    this.headers = {
      'Authorization': `Bearer ${this.apiToken}`,
      'Version': '2021-07-28',
      'Content-Type': 'application/json'
    };
    this.maxRetries = parseInt(process.env.MAX_RETRIES) || 3;
    this.retryDelay = parseInt(process.env.RETRY_DELAY) || 3000;
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

  async getContact(contactId) {
    logger.info(`Fetching contact: ${contactId}`);
    return await this.makeRequest('GET', `/contacts/${contactId}`);
  }

  async createSubAccount(data) {
    logger.info('Creating sub-account', { email: data.email });
    return await this.makeRequest('POST', '/locations/', data);
  }

  async updateOpportunity(opportunityId, data) {
    logger.info(`Updating opportunity: ${opportunityId}`);
    return await this.makeRequest('PUT', `/opportunities/${opportunityId}`, data);
  }

  async addNote(opportunityId, noteBody) {
    logger.info(`Adding note to opportunity: ${opportunityId}`);
    return await this.makeRequest('POST', `/opportunities/${opportunityId}/notes`, {
      body: noteBody
    });
  }

  async updateContactCustomFields(contactId, customFields) {
    logger.info(`Updating contact custom fields: ${contactId}`);
    return await this.makeRequest('PUT', `/contacts/${contactId}`, {
      customFields
    });
  }

  async addTagToContact(contactId, tag) {
    logger.info(`Adding tag to contact: ${contactId}`, { tag });
    return await this.makeRequest('POST', `/contacts/${contactId}/tags`, {
      tags: [tag]
    });
  }
}

module.exports = new GHLClient();
