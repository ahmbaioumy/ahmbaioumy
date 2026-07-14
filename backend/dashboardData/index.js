const { CosmosClient } = require("@azure/cosmos");

const endpoint = process.env.COSMOS_DB_ENDPOINT;
const key = process.env.COSMOS_DB_KEY;
const databaseId = process.env.COSMOS_DB_DATABASE;
const containerId = process.env.COSMOS_DB_CONTAINER;

const cosmosClient = new CosmosClient({ endpoint, key });

module.exports = async function (context, req) {
  context.log('Dashboard data function triggered');

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

    // Get today's date range
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);

    // Query for today's chat logs
    const { resources: todayChats } = await container.items
      .query({
        query: 'SELECT * FROM c WHERE c.type = "chat-log" AND c.timestamp >= @startDate AND c.timestamp < @endDate',
        parameters: [
          { name: '@startDate', value: startOfDay.toISOString() },
          { name: '@endDate', value: endOfDay.toISOString() }
        ]
      })
      .fetchAll();

    // Query for all chat logs (for total count)
    const { resources: allChats } = await container.items
      .query({
        query: 'SELECT * FROM c WHERE c.type = "chat-log"'
      })
      .fetchAll();

    // Calculate metrics
    const metrics = calculateDashboardMetrics(todayChats, allChats);

    context.log('Dashboard metrics calculated:', metrics);

    context.res = {
      status: 200,
      body: metrics
    };

  } catch (error) {
    context.log.error('Error getting dashboard data:', error);
    
    context.res = {
      status: 500,
      body: { 
        error: 'Failed to get dashboard data',
        details: error.message 
      }
    };
  }
};

function calculateDashboardMetrics(todayChats, allChats) {
  // Today's metrics
  const totalChatsToday = todayChats.length;
  const detractorsToday = todayChats.filter(chat => 
    chat.npsData?.customerType === 'Detractor'
  ).length;
  const promotersToday = todayChats.filter(chat => 
    chat.npsData?.customerType === 'Promoter'
  ).length;

  // Sentiment analysis
  const sentimentCounts = todayChats.reduce((acc, chat) => {
    const sentiment = chat.sentiment?.sentiment || 'unknown';
    acc[sentiment] = (acc[sentiment] || 0) + 1;
    return acc;
  }, {});

  const totalWithSentiment = Object.values(sentimentCounts).reduce((sum, count) => sum + count, 0);
  const positiveSentiment = totalWithSentiment > 0 ? 
    Math.round((sentimentCounts.positive || 0) / totalWithSentiment * 100) : 0;

  // NPS calculation
  const npsScores = todayChats
    .filter(chat => chat.npsData?.npsScore !== undefined)
    .map(chat => chat.npsData.npsScore);

  const averageNPS = npsScores.length > 0 ? 
    Math.round(npsScores.reduce((sum, score) => sum + score, 0) / npsScores.length) : 0;

  // Performance metrics
  const averageResponseTime = calculateAverageResponseTime(todayChats);
  const resolutionRate = calculateResolutionRate(todayChats);
  const customerSatisfaction = calculateCustomerSatisfaction(todayChats);

  return {
    totalChats: allChats.length,
    totalChatsToday,
    averageNPS,
    positiveSentiment,
    detractors: detractorsToday,
    promoters: promotersToday,
    averageResponseTime,
    resolutionRate,
    customerSatisfaction,
    sentimentBreakdown: {
      positive: sentimentCounts.positive || 0,
      neutral: sentimentCounts.neutral || 0,
      negative: sentimentCounts.negative || 0
    }
  };
}

function calculateAverageResponseTime(chats) {
  // Mock calculation - in real implementation, you'd track actual response times
  return '2.5 min';
}

function calculateResolutionRate(chats) {
  // Mock calculation - assume 85% resolution rate
  return 85;
}

function calculateCustomerSatisfaction(chats) {
  const satisfiedChats = chats.filter(chat => 
    chat.sentiment?.sentiment === 'positive' || 
    chat.npsData?.customerType === 'Promoter'
  ).length;
  
  return chats.length > 0 ? Math.round(satisfiedChats / chats.length * 100) : 0;
}