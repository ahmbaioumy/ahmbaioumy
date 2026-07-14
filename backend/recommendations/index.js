const { CosmosClient } = require("@azure/cosmos");

const endpoint = process.env.COSMOS_DB_ENDPOINT;
const key = process.env.COSMOS_DB_KEY;
const databaseId = process.env.COSMOS_DB_DATABASE;
const containerId = process.env.COSMOS_DB_CONTAINER;

const cosmosClient = new CosmosClient({ endpoint, key });

module.exports = async function (context, req) {
  context.log('Recommendations function triggered');

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

  if (req.method !== 'GET') {
    context.res = {
      status: 405,
      body: { error: 'Method not allowed' }
    };
    return;
  }

  try {
    const { database } = await cosmosClient.databases.createIfNotExists({ 
      id: databaseId 
    });
    const { container } = await database.containers.createIfNotExists({ 
      id: containerId 
    });

    // Get recent chat logs for analysis
    const { resources: recentChats } = await container.items
      .query({
        query: 'SELECT * FROM c WHERE c.type = "chat-log" ORDER BY c.timestamp DESC',
        parameters: []
      })
      .fetchAll();

    // Generate recommendations based on chat patterns
    const recommendations = generateRecommendations(recentChats);

    context.log(`Generated ${recommendations.length} recommendations`);

    context.res = {
      status: 200,
      body: recommendations
    };

  } catch (error) {
    context.log.error('Error generating recommendations:', error);
    
    context.res = {
      status: 500,
      body: { 
        error: 'Failed to generate recommendations',
        details: error.message 
      }
    };
  }
};

function generateRecommendations(chats) {
  const recommendations = [];

  // Analyze chat patterns
  const detractors = chats.filter(chat => chat.npsData?.customerType === 'Detractor');
  const negativeSentiment = chats.filter(chat => chat.sentiment?.sentiment === 'negative');
  const recentChats = chats.slice(0, 10); // Last 10 chats

  // Recommendation 1: Detractor Management
  if (detractors.length > 0) {
    const recentDetractors = detractors.slice(0, 3);
    recentDetractors.forEach((chat, index) => {
      recommendations.push({
        id: `detractor-${index + 1}`,
        title: 'Immediate Detractor Follow-up Required',
        description: `Customer "${chat.customer}" expressed dissatisfaction. Immediate intervention needed to prevent churn.`,
        sentiment: 'negative',
        npsType: 'Detractor',
        confidence: 0.95,
        impact: 'High',
        actions: [
          'Schedule immediate follow-up call',
          'Offer personalized solution or compensation',
          'Escalate to senior management if needed',
          'Document resolution steps for future reference'
        ],
        chatId: chat.id,
        timestamp: chat.timestamp
      });
    });
  }

  // Recommendation 2: Negative Sentiment Patterns
  if (negativeSentiment.length > 2) {
    recommendations.push({
      id: 'negative-pattern',
      title: 'Negative Sentiment Trend Detected',
      description: 'Multiple customers showing negative sentiment. Review common issues and improve processes.',
      sentiment: 'negative',
      npsType: 'Detractor',
      confidence: 0.85,
      impact: 'Medium',
      actions: [
        'Analyze common complaint themes',
        'Review agent training materials',
        'Implement proactive customer outreach',
        'Update FAQ and knowledge base'
      ],
      chatId: 'pattern-analysis',
      timestamp: new Date().toISOString()
    });
  }

  // Recommendation 3: Positive Opportunities
  const promoters = chats.filter(chat => chat.npsData?.customerType === 'Promoter');
  if (promoters.length > 0) {
    recommendations.push({
      id: 'promoter-opportunity',
      title: 'Promoter Engagement Opportunity',
      description: 'Several satisfied customers identified. Perfect time to request testimonials and referrals.',
      sentiment: 'positive',
      npsType: 'Promoter',
      confidence: 0.90,
      impact: 'Medium',
      actions: [
        'Request customer testimonials',
        'Ask for referrals to similar businesses',
        'Invite to case study participation',
        'Offer early access to new features'
      ],
      chatId: 'promoter-outreach',
      timestamp: new Date().toISOString()
    });
  }

  // Recommendation 4: Response Time Optimization
  recommendations.push({
    id: 'response-time',
    title: 'Response Time Optimization',
    description: 'Average response times could be improved. Consider implementing automated responses for common queries.',
    sentiment: 'neutral',
    npsType: 'Neutral',
    confidence: 0.75,
    impact: 'Medium',
    actions: [
      'Implement chatbot for common questions',
      'Create response templates',
      'Set up automated acknowledgments',
      'Train agents on quick resolution techniques'
    ],
    chatId: 'response-optimization',
    timestamp: new Date().toISOString()
  });

  // Recommendation 5: Proactive Support
  recommendations.push({
    id: 'proactive-support',
    title: 'Proactive Customer Support',
    description: 'Implement proactive outreach to customers who haven\'t contacted support recently.',
    sentiment: 'neutral',
    npsType: 'Neutral',
    confidence: 0.70,
    impact: 'Low',
    actions: [
      'Create customer health scoring system',
      'Schedule regular check-in calls',
      'Send satisfaction surveys',
      'Monitor usage patterns for early warning signs'
    ],
    chatId: 'proactive-outreach',
    timestamp: new Date().toISOString()
  });

  return recommendations.slice(0, 10); // Return top 10 recommendations
}