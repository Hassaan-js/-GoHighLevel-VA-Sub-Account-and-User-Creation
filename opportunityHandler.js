const ghlClient = require('./ghlClient');
const logger = require('./utils/logger');

class OpportunityHandler {
  async handleStageChange(webhookData) {
    const startTime = Date.now();
    
    logger.info('Processing opportunity stage change', {
      opportunityId: webhookData.opportunityId,
      contactEmail: webhookData.contactEmail
    });

    try {
      // Step 1: Prepare sub-account data
      const subAccountData = {
        name: `${webhookData.contactFirstName || ''} ${webhookData.contactLastName || ''}`.trim() || 'New Client',
        email: webhookData.contactEmail,
        phone: webhookData.contactPhone || '',
        address: webhookData.contactAddress || '',
        city: webhookData.contactCity || '',
        state: webhookData.contactState || '',
        postalCode: webhookData.contactPostalCode || '',
        country: webhookData.contactCountry || 'US',
        companyName: webhookData.companyName || `${webhookData.contactFirstName || ''} ${webhookData.contactLastName || ''}`.trim() || 'New Company',
        website: 'https://example.com',
        timezone: 'America/New_York',
        snapshotId: process.env.GHL_SNAPSHOT_ID
      };

      // Step 2: Create sub-account
      const subAccountResponse = await ghlClient.createSubAccount(subAccountData);
      const subAccountId = subAccountResponse.location?.id;
      const subAccountName = subAccountResponse.location?.name;

      if (!subAccountId) {
        throw new Error('Sub-account creation failed - no ID returned');
      }

      logger.info('Sub-account created successfully', {
        subAccountId,
        subAccountName
      });

      // Step 3: Create user ON the new sub-account (location-scoped)
      const userData = {
        firstName: webhookData.contactFirstName || 'User',
        lastName: webhookData.contactLastName || 'Admin',
        email: webhookData.contactEmail,
        phone: webhookData.contactPhone || '',
        role: "admin",
        permissions: {
          campaignsEnabled: true,
          campaignsReadOnly: false,
          contactsEnabled: true,
          workflowsEnabled: true,
          triggersEnabled: true,
          funnelsEnabled: true,
          websitesEnabled: true,
          opportunitiesEnabled: true,
          dashboardStatsEnabled: true,
          bulkRequestsEnabled: true,
          appointmentsEnabled: true,
          reviewsEnabled: true,
          onlineListingsEnabled: true,
          phoneCallEnabled: true,
          conversationsEnabled: true,
          assignedDataOnly: false,
          adwordsReportingEnabled: true,
          membershipEnabled: true,
          facebookAdsReportingEnabled: true,
          attributionsReportingEnabled: true,
          settingsEnabled: true,
          tagsEnabled: true,
          leadValueEnabled: true,
          marketingEnabled: true,
          agentReportingEnabled: true,
          botService: true,
          socialPlanner: true,
          bloggingEnabled: true,
          invoiceEnabled: true,
          affiliateManagerEnabled: true,
          contentAiEnabled: true,
          refundsEnabled: true,
          recordPaymentEnabled: true,
          cancelSubscriptionEnabled: true,
          paymentsEnabled: true,
          communitiesEnabled: true,
          exportPaymentsEnabled: true
        }
      };

      // ✅ KEY FIX: User is created directly ON the location
      const userResponse = await ghlClient.createUserOnLocation(subAccountId, userData);
      const userId = userResponse.user?.id;

      if (!userId) {
        throw new Error('User creation failed - no ID returned');
      }

      logger.info('User created successfully on location', {
        userId,
        userEmail: webhookData.contactEmail,
        locationId: subAccountId
      });

      const duration = Date.now() - startTime;

      // Return success response to GHL workflow
      return {
        success: true,
        subAccountId: subAccountId,
        subAccountName: subAccountName,
        userId: userId,
        userEmail: webhookData.contactEmail,
        userName: `${webhookData.contactFirstName} ${webhookData.contactLastName}`,
        timestamp: new Date().toISOString(),
        duration: duration
      };

    } catch (error) {
      const duration = Date.now() - startTime;
      
      logger.error('Process failed', {
        opportunityId: webhookData.opportunityId,
        error: error.message,
        stack: error.stack,
        response: error.response?.data,
        duration: `${duration}ms`
      });

      return {
        success: false,
        error: error.message,
        errorDetails: error.response?.data || null,
        timestamp: new Date().toISOString(),
        duration: duration
      };
    }
  }
}

module.exports = new OpportunityHandler();
