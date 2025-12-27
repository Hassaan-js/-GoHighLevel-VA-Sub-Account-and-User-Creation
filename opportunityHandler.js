const ghlClient = require('./ghlClient');
const logger = require('./utils/logger');

class OpportunityHandler {
  async handleStageChange(webhookData) {
    const startTime = Date.now();
    logger.info('Processing opportunity stage change', {
      opportunityId: webhookData.id,
      stage: webhookData.pipeline_stage
    });

    try {
      // Step 1: Validate Stage
      if (webhookData.pipeline_stage !== 'Agreement Signed') {
        logger.info('Stage is not Agreement Signed, skipping');
        return { success: true, skipped: true };
      }

      // Step 2: Get Full Contact Details
      const contactId = webhookData.contact?.id;
      if (!contactId) {
        throw new Error('Contact ID not found in webhook data');
      }

      const contactResponse = await ghlClient.getContact(contactId);
      const contact = contactResponse.contact;

      // Step 3: Prepare Sub-Account Data
      const subAccountData = this.prepareSubAccountData(contact);

      // Step 4: Create Sub-Account
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

      // Step 5: Update Opportunity Stage
      await ghlClient.updateOpportunity(webhookData.id, {
        pipelineStageId: process.env.STAGE_SUBACCOUNT_CREATED,
        status: 'open'
      });

      // Step 6: Add Note to Opportunity
      const noteBody = this.createNoteBody(subAccountId, subAccountName);
      await ghlClient.addNote(webhookData.id, noteBody);

      // Step 7: Update Contact Custom Fields
      const customFields = this.createCustomFields(subAccountId);
      await ghlClient.updateContactCustomFields(contactId, customFields);

      // Step 8: Add Tag to Contact
      await ghlClient.addTagToContact(contactId, 'Sub-Account Created');

      const duration = Date.now() - startTime;
      logger.info('Workflow completed successfully', {
        opportunityId: webhookData.id,
        subAccountId,
        duration: `${duration}ms`
      });

      return {
        success: true,
        subAccountId,
        subAccountName,
        duration
      };

    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('Workflow failed', {
        opportunityId: webhookData.id,
        error: error.message,
        stack: error.stack,
        duration: `${duration}ms`
      });

      throw error;
    }
  }

  prepareSubAccountData(contact) {
    return {
      name: `${contact.firstName || ''} ${contact.lastName || ''}`.trim(),
      email: contact.email,
      phone: contact.phone || '',
      address: contact.address1 || '',
      city: contact.city || '',
      state: contact.state || '',
      postalCode: contact.postalCode || '',
      country: contact.country || 'US',
      companyName: contact.companyName || `${contact.firstName || ''} ${contact.lastName || ''}`.trim(),
      website: contact.website || 'https://example.com',
      timezone: contact.timezone || 'America/New_York',
      snapshotId: process.env.GHL_SNAPSHOT_ID
    };
  }

  createNoteBody(subAccountId, subAccountName) {
    const now = new Date().toISOString();
    return `Sub-account created successfully!

Sub-Account ID: ${subAccountId}
Sub-Account Name: ${subAccountName}
Created: ${now}

Automated by Node.js workflow.`;
  }

  createCustomFields(subAccountId) {
    const now = new Date().toISOString().split('T')[0];
    return [
      {
        key: process.env.CUSTOM_FIELD_SUBACCOUNT_ID,
        value: subAccountId
      },
      {
        key: process.env.CUSTOM_FIELD_CREATED_DATE,
        value: now
      }
    ];
  }
}

module.exports = new OpportunityHandler();
