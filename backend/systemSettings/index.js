const { CosmosClient } = require("@azure/cosmos");

const endpoint = process.env.COSMOS_DB_ENDPOINT;
const key = process.env.COSMOS_DB_KEY;
const databaseId = process.env.COSMOS_DB_DATABASE;
const containerId = process.env.COSMOS_DB_CONTAINER;

const cosmosClient = new CosmosClient({ endpoint, key });

module.exports = async function (context, req) {
  context.log('System settings function triggered');

  // Enable CORS
  context.res.headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  };

  if (req.method === 'OPTIONS') {
    context.res.status = 200;
    return;
  }

  try {
    const { database } = await cosmosClient.databases.createIfNotExists({ 
      id: databaseId 
    });
    const { container } = await database.containers.createIfNotExists({ 
      id: containerId 
    });

    if (req.method === 'GET') {
      // Get system settings
      const settings = getDefaultSettings();
      
      context.res = {
        status: 200,
        body: settings
      };

    } else if (req.method === 'PUT') {
      // Update system settings
      const newSettings = req.body;
      
      // Validate settings
      const validatedSettings = validateSettings(newSettings);
      
      // In a real implementation, you would save these to the database
      // For now, we'll return a success response
      context.res = {
        status: 200,
        body: { 
          success: true, 
          message: 'Settings updated successfully',
          settings: validatedSettings
        }
      };

    } else {
      context.res = {
        status: 405,
        body: { error: 'Method not allowed' }
      };
    }

  } catch (error) {
    context.log.error('Error in system settings function:', error);
    
    context.res = {
      status: 500,
      body: { 
        error: 'Failed to process system settings request',
        details: error.message 
      }
    };
  }
};

function getDefaultSettings() {
  return {
    npsDetractorThreshold: parseInt(process.env.NPS_DETRACTOR_THRESHOLD) || 6,
    npsPromoterThreshold: parseInt(process.env.NPS_PROMOTER_THRESHOLD) || 9,
    sentimentThreshold: parseFloat(process.env.SENTIMENT_CONFIDENCE_THRESHOLD) || 0.7,
    autoNotifyDetractors: process.env.AUTO_NOTIFY_DETRACTORS === 'true',
    chatRetentionDays: parseInt(process.env.CHAT_RETENTION_DAYS) || 90,
    maxConcurrentChats: 5,
    responseTimeThreshold: 300, // 5 minutes in seconds
    escalationThreshold: 3, // Number of negative interactions before escalation
    workingHours: {
      start: '09:00',
      end: '17:00',
      timezone: 'UTC'
    },
    notifications: {
      email: true,
      sms: false,
      push: true
    },
    features: {
      sentimentAnalysis: true,
      npsPrediction: true,
      realTimeNotifications: true,
      multilingualSupport: false
    }
  };
}

function validateSettings(settings) {
  const validated = { ...settings };
  
  // Validate NPS thresholds
  if (validated.npsDetractorThreshold !== undefined) {
    validated.npsDetractorThreshold = Math.max(0, Math.min(10, validated.npsDetractorThreshold));
  }
  
  if (validated.npsPromoterThreshold !== undefined) {
    validated.npsPromoterThreshold = Math.max(0, Math.min(10, validated.npsPromoterThreshold));
  }
  
  // Ensure promoter threshold is higher than detractor threshold
  if (validated.npsDetractorThreshold >= validated.npsPromoterThreshold) {
    validated.npsPromoterThreshold = validated.npsDetractorThreshold + 1;
  }
  
  // Validate sentiment threshold
  if (validated.sentimentThreshold !== undefined) {
    validated.sentimentThreshold = Math.max(0, Math.min(1, validated.sentimentThreshold));
  }
  
  // Validate chat retention days
  if (validated.chatRetentionDays !== undefined) {
    validated.chatRetentionDays = Math.max(1, Math.min(365, validated.chatRetentionDays));
  }
  
  // Validate max concurrent chats
  if (validated.maxConcurrentChats !== undefined) {
    validated.maxConcurrentChats = Math.max(1, Math.min(50, validated.maxConcurrentChats));
  }
  
  // Validate response time threshold
  if (validated.responseTimeThreshold !== undefined) {
    validated.responseTimeThreshold = Math.max(60, Math.min(3600, validated.responseTimeThreshold));
  }
  
  return validated;
}