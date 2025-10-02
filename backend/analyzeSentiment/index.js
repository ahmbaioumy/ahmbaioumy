const { TextAnalyticsClient, AzureKeyCredential } = require("@azure/ai-text-analytics");

const endpoint = process.env.TEXT_ANALYTICS_ENDPOINT;
const key = process.env.TEXT_ANALYTICS_KEY;

if (!endpoint || !key) {
  throw new Error("TEXT_ANALYTICS_ENDPOINT and TEXT_ANALYTICS_KEY environment variables are required");
}

const client = new TextAnalyticsClient(endpoint, new AzureKeyCredential(key));

module.exports = async function (context, req) {
  context.log('Sentiment analysis function triggered');

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

  const { text } = req.body;

  if (!text || typeof text !== 'string') {
    context.res = {
      status: 400,
      body: { error: 'Text is required and must be a string' }
    };
    return;
  }

  try {
    // Analyze sentiment
    const [result] = await client.analyzeSentiment([text]);
    
    if (!result) {
      throw new Error('No sentiment analysis result returned');
    }

    const response = {
      sentiment: result.sentiment,
      confidenceScores: result.confidenceScores,
      text: text.substring(0, 100) + (text.length > 100 ? '...' : ''), // Truncate for response
      timestamp: new Date().toISOString()
    };

    context.log('Sentiment analysis completed:', response);

    context.res = {
      status: 200,
      body: response
    };

  } catch (error) {
    context.log.error('Error analyzing sentiment:', error);
    
    context.res = {
      status: 500,
      body: { 
        error: 'Failed to analyze sentiment',
        details: error.message 
      }
    };
  }
};