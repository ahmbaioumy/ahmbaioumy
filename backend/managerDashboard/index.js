const { CosmosClient } = require("@azure/cosmos");

const endpoint = process.env.COSMOS_DB_ENDPOINT;
const key = process.env.COSMOS_DB_KEY;
const databaseId = process.env.COSMOS_DB_DATABASE;
const containerId = process.env.COSMOS_DB_CONTAINER;

const cosmosClient = new CosmosClient({ endpoint, key });

module.exports = async function (context, req) {
  context.log('Manager dashboard function triggered');

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
    const timeRange = req.query.timeRange || '7d';
    const { database } = await cosmosClient.databases.createIfNotExists({ 
      id: databaseId 
    });
    const { container } = await database.containers.createIfNotExists({ 
      id: containerId 
    });

    // Calculate date range
    const dateRange = calculateDateRange(timeRange);

    // Query for chat logs in the specified time range
    const { resources: chatLogs } = await container.items
      .query({
        query: 'SELECT * FROM c WHERE c.type = "chat-log" AND c.timestamp >= @startDate AND c.timestamp <= @endDate',
        parameters: [
          { name: '@startDate', value: dateRange.start },
          { name: '@endDate', value: dateRange.end }
        ]
      })
      .fetchAll();

    // Calculate manager dashboard metrics
    const metrics = calculateManagerMetrics(chatLogs, timeRange);

    context.log('Manager dashboard metrics calculated:', metrics);

    context.res = {
      status: 200,
      body: metrics
    };

  } catch (error) {
    context.log.error('Error getting manager dashboard data:', error);
    
    context.res = {
      status: 500,
      body: { 
        error: 'Failed to get manager dashboard data',
        details: error.message 
      }
    };
  }
};

function calculateDateRange(timeRange) {
  const now = new Date();
  let startDate;

  switch (timeRange) {
    case '24h':
      startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      break;
    case '7d':
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case '30d':
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      break;
    case '90d':
      startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      break;
    default:
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  }

  return {
    start: startDate.toISOString(),
    end: now.toISOString()
  };
}

function calculateManagerMetrics(chatLogs, timeRange) {
  const totalChats = chatLogs.length;
  
  // NPS calculations
  const detractors = chatLogs.filter(chat => chat.npsData?.customerType === 'Detractor');
  const promoters = chatLogs.filter(chat => chat.npsData?.customerType === 'Promoter');
  const neutrals = chatLogs.filter(chat => chat.npsData?.customerType === 'Neutral');
  
  const detractorRate = totalChats > 0 ? Math.round((detractors.length / totalChats) * 100) : 0;
  const promoterRate = totalChats > 0 ? Math.round((promoters.length / totalChats) * 100) : 0;
  
  // Calculate NPS score
  const npsScore = promoterRate - detractorRate;
  
  // Sentiment analysis
  const sentimentCounts = chatLogs.reduce((acc, chat) => {
    const sentiment = chat.sentiment?.sentiment || 'unknown';
    acc[sentiment] = (acc[sentiment] || 0) + 1;
    return acc;
  }, {});

  const totalWithSentiment = Object.values(sentimentCounts).reduce((sum, count) => sum + count, 0);
  const positiveSentiment = totalWithSentiment > 0 ? 
    Math.round((sentimentCounts.positive || 0) / totalWithSentiment * 100) : 0;
  const neutralSentiment = totalWithSentiment > 0 ? 
    Math.round((sentimentCounts.neutral || 0) / totalWithSentiment * 100) : 0;
  const negativeSentiment = totalWithSentiment > 0 ? 
    Math.round((sentimentCounts.negative || 0) / totalWithSentiment * 100) : 0;

  // Calculate growth (mock data for now)
  const chatGrowth = calculateGrowth(totalChats, timeRange);
  const npsChange = calculateNpsChange(npsScore, timeRange);

  return {
    totalChats,
    averageNPS: npsScore,
    detractors: detractors.length,
    promoters: promoters.length,
    detractorRate,
    promoterRate,
    positiveSentiment,
    neutralSentiment,
    negativeSentiment,
    chatGrowth,
    npsChange,
    averageResponseTime: '2.3 min',
    resolutionRate: 87,
    customerSatisfaction: Math.round((positiveSentiment + promoterRate) / 2)
  };
}

function calculateGrowth(currentValue, timeRange) {
  // Mock growth calculation - in real implementation, compare with previous period
  const growthRates = {
    '24h': 5,
    '7d': 12,
    '30d': 25,
    '90d': 45
  };
  return growthRates[timeRange] || 10;
}

function calculateNpsChange(currentNPS, timeRange) {
  // Mock NPS change calculation - in real implementation, compare with previous period
  const npsChanges = {
    '24h': 2,
    '7d': 5,
    '30d': 8,
    '90d': 12
  };
  return npsChanges[timeRange] || 3;
}