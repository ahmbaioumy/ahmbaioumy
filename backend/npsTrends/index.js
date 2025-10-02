const { CosmosClient } = require("@azure/cosmos");

const endpoint = process.env.COSMOS_DB_ENDPOINT;
const key = process.env.COSMOS_DB_KEY;
const databaseId = process.env.COSMOS_DB_DATABASE;
const containerId = process.env.COSMOS_DB_CONTAINER;

const cosmosClient = new CosmosClient({ endpoint, key });

module.exports = async function (context, req) {
  context.log('NPS trends function triggered');

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

    // Calculate NPS trends
    const trends = calculateNpsTrends(chatLogs, timeRange);

    context.log(`NPS trends calculated for ${trends.length} data points`);

    context.res = {
      status: 200,
      body: trends
    };

  } catch (error) {
    context.log.error('Error getting NPS trends data:', error);
    
    context.res = {
      status: 500,
      body: { 
        error: 'Failed to get NPS trends data',
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

function calculateNpsTrends(chatLogs, timeRange) {
  // Group chats by time period
  const timeGroups = groupChatsByTimePeriod(chatLogs, timeRange);
  
  // Calculate NPS for each time period
  const trends = Object.keys(timeGroups).map(date => {
    const chats = timeGroups[date];
    const detractors = chats.filter(chat => chat.npsData?.customerType === 'Detractor').length;
    const promoters = chats.filter(chat => chat.npsData?.customerType === 'Promoter').length;
    const nps = promoters - detractors;
    
    return {
      date: date,
      nps: nps,
      detractors: detractors,
      promoters: promoters,
      totalChats: chats.length
    };
  });

  // Sort by date
  return trends.sort((a, b) => new Date(a.date) - new Date(b.date));
}

function groupChatsByTimePeriod(chatLogs, timeRange) {
  const groups = {};
  
  chatLogs.forEach(chat => {
    const chatDate = new Date(chat.timestamp);
    let groupKey;
    
    switch (timeRange) {
      case '24h':
        // Group by hour
        groupKey = chatDate.toISOString().substring(0, 13) + ':00:00';
        break;
      case '7d':
        // Group by day
        groupKey = chatDate.toISOString().substring(0, 10);
        break;
      case '30d':
        // Group by day
        groupKey = chatDate.toISOString().substring(0, 10);
        break;
      case '90d':
        // Group by week
        const weekStart = new Date(chatDate);
        weekStart.setDate(chatDate.getDate() - chatDate.getDay());
        groupKey = weekStart.toISOString().substring(0, 10);
        break;
      default:
        groupKey = chatDate.toISOString().substring(0, 10);
    }
    
    if (!groups[groupKey]) {
      groups[groupKey] = [];
    }
    groups[groupKey].push(chat);
  });
  
  return groups;
}