const { CosmosClient } = require("@azure/cosmos");

const endpoint = process.env.COSMOS_DB_ENDPOINT;
const key = process.env.COSMOS_DB_KEY;
const databaseId = process.env.COSMOS_DB_DATABASE;
const containerId = process.env.COSMOS_DB_CONTAINER;

const cosmosClient = new CosmosClient({ endpoint, key });

// NPS calculation thresholds
const NPS_DETRACTOR_THRESHOLD = parseInt(process.env.NPS_DETRACTOR_THRESHOLD) || 6;
const NPS_PROMOTER_THRESHOLD = parseInt(process.env.NPS_PROMOTER_THRESHOLD) || 9;

module.exports = async function (context, req) {
  context.log('NPS prediction function triggered');

  // Enable CORS
  context.res.headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  };

  if (req.method === 'OPTIONS') {
    context.res.status = 200;
    return;
  }

  if (req.method !== 'POST') {
    context.res = {
      status: 405,
      body: { error: 'Method not allowed' }
    };
    return;
  }

  const { message, sentiment } = req.body;

  if (!message || !sentiment) {
    context.res = {
      status: 400,
      body: { error: 'Message and sentiment data are required' }
    };
    return;
  }

  try {
    // Calculate NPS score based on sentiment and message content
    const npsScore = calculateNpsScore(message, sentiment);
    const customerType = determineCustomerType(npsScore);
    const accuracy = calculateAccuracy(sentiment, npsScore);

    const prediction = {
      npsScore,
      customerType,
      accuracy,
      confidence: sentiment.confidenceScores[sentiment.sentiment.toLowerCase()],
      sentiment: sentiment.sentiment,
      timestamp: new Date().toISOString(),
      message: message.substring(0, 100) + (message.length > 100 ? '...' : '')
    };

    // Store prediction in Cosmos DB
    await storePrediction(prediction);

    context.log('NPS prediction completed:', prediction);

    context.res = {
      status: 200,
      body: prediction
    };

  } catch (error) {
    context.log.error('Error predicting NPS:', error);
    
    context.res = {
      status: 500,
      body: { 
        error: 'Failed to predict NPS',
        details: error.message 
      }
    };
  }
};

function calculateNpsScore(message, sentiment) {
  // Base score from sentiment
  let baseScore = 0;
  
  switch (sentiment.sentiment.toLowerCase()) {
    case 'positive':
      baseScore = 8;
      break;
    case 'neutral':
      baseScore = 5;
      break;
    case 'negative':
      baseScore = 2;
      break;
    default:
      baseScore = 5;
  }

  // Adjust based on confidence
  const confidence = sentiment.confidenceScores[sentiment.sentiment.toLowerCase()];
  const confidenceAdjustment = (confidence - 0.5) * 2; // -1 to +1 range
  
  // Adjust based on message content keywords
  const contentAdjustment = analyzeMessageContent(message);
  
  // Calculate final score (0-10 scale)
  const finalScore = Math.max(0, Math.min(10, baseScore + confidenceAdjustment + contentAdjustment));
  
  return Math.round(finalScore);
}

function analyzeMessageContent(message) {
  const positiveKeywords = [
    'excellent', 'amazing', 'great', 'wonderful', 'fantastic', 'love', 'perfect',
    'outstanding', 'brilliant', 'superb', 'exceptional', 'satisfied', 'happy',
    'pleased', 'impressed', 'recommend', 'best', 'awesome', 'incredible'
  ];
  
  const negativeKeywords = [
    'terrible', 'awful', 'horrible', 'disappointed', 'frustrated', 'angry',
    'hate', 'worst', 'bad', 'poor', 'unacceptable', 'disgusted', 'annoyed',
    'upset', 'displeased', 'unsatisfied', 'broken', 'failed', 'useless'
  ];

  const messageLower = message.toLowerCase();
  
  let adjustment = 0;
  
  // Check for positive keywords
  positiveKeywords.forEach(keyword => {
    if (messageLower.includes(keyword)) {
      adjustment += 0.5;
    }
  });
  
  // Check for negative keywords
  negativeKeywords.forEach(keyword => {
    if (messageLower.includes(keyword)) {
      adjustment -= 0.5;
    }
  });
  
  return Math.max(-2, Math.min(2, adjustment));
}

function determineCustomerType(npsScore) {
  if (npsScore <= NPS_DETRACTOR_THRESHOLD) {
    return 'Detractor';
  } else if (npsScore >= NPS_PROMOTER_THRESHOLD) {
    return 'Promoter';
  } else {
    return 'Neutral';
  }
}

function calculateAccuracy(sentiment, npsScore) {
  // Simple accuracy calculation based on consistency between sentiment and NPS
  const sentimentScore = sentiment.confidenceScores[sentiment.sentiment.toLowerCase()];
  
  // Check if NPS aligns with sentiment
  let alignment = 0;
  
  if (sentiment.sentiment.toLowerCase() === 'positive' && npsScore >= 7) {
    alignment = 1;
  } else if (sentiment.sentiment.toLowerCase() === 'negative' && npsScore <= 3) {
    alignment = 1;
  } else if (sentiment.sentiment.toLowerCase() === 'neutral' && npsScore >= 4 && npsScore <= 6) {
    alignment = 1;
  } else {
    alignment = 0.5; // Partial alignment
  }
  
  return (sentimentScore + alignment) / 2;
}

async function storePrediction(prediction) {
  try {
    const { database } = await cosmosClient.databases.createIfNotExists({ id: databaseId });
    const { container } = await database.containers.createIfNotExists({ id: containerId });
    
    const predictionDoc = {
      id: `nps-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: 'nps-prediction',
      ...prediction,
      createdAt: new Date().toISOString()
    };
    
    await container.items.create(predictionDoc);
  } catch (error) {
    context.log.error('Error storing prediction:', error);
    // Don't throw error to avoid breaking the main function
  }
}