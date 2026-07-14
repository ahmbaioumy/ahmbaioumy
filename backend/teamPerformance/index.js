const { CosmosClient } = require("@azure/cosmos");

const endpoint = process.env.COSMOS_DB_ENDPOINT;
const key = process.env.COSMOS_DB_KEY;
const databaseId = process.env.COSMOS_DB_DATABASE;
const containerId = process.env.COSMOS_DB_CONTAINER;

const cosmosClient = new CosmosClient({ endpoint, key });

module.exports = async function (context, req) {
  context.log('Team performance function triggered');

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

    // Calculate team performance metrics
    const teamPerformance = calculateTeamPerformance(chatLogs);

    context.log(`Team performance calculated for ${teamPerformance.length} agents`);

    context.res = {
      status: 200,
      body: teamPerformance
    };

  } catch (error) {
    context.log.error('Error getting team performance data:', error);
    
    context.res = {
      status: 500,
      body: { 
        error: 'Failed to get team performance data',
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

function calculateTeamPerformance(chatLogs) {
  // Group chats by agent
  const agentChats = {};
  
  chatLogs.forEach(chat => {
    const agent = chat.agent || 'Unknown Agent';
    if (!agentChats[agent]) {
      agentChats[agent] = [];
    }
    agentChats[agent].push(chat);
  });

  // Calculate performance metrics for each agent
  const teamPerformance = Object.keys(agentChats).map((agentName, index) => {
    const chats = agentChats[agentName];
    
    // Calculate NPS for this agent
    const detractors = chats.filter(chat => chat.npsData?.customerType === 'Detractor').length;
    const promoters = chats.filter(chat => chat.npsData?.customerType === 'Promoter').length;
    const npsScore = chats.length > 0 ? promoters - detractors : 0;
    
    // Calculate satisfaction rate
    const positiveChats = chats.filter(chat => 
      chat.sentiment?.sentiment === 'positive' || 
      chat.npsData?.customerType === 'Promoter'
    ).length;
    const satisfaction = chats.length > 0 ? Math.round((positiveChats / chats.length) * 100) : 0;
    
    // Determine role based on performance
    let role = 'Agent';
    if (satisfaction >= 90 && chats.length >= 20) {
      role = 'Senior Agent';
    } else if (satisfaction >= 80 && chats.length >= 10) {
      role = 'Agent';
    } else if (chats.length < 5) {
      role = 'Trainee';
    }

    return {
      id: `agent-${index + 1}`,
      name: agentName,
      role: role,
      totalChats: chats.length,
      averageNPS: npsScore,
      satisfaction: satisfaction,
      detractors: detractors,
      promoters: promoters,
      lastActive: chats.length > 0 ? chats[chats.length - 1].timestamp : new Date().toISOString()
    };
  });

  // Sort by performance (satisfaction + NPS)
  return teamPerformance.sort((a, b) => (b.satisfaction + b.averageNPS) - (a.satisfaction + a.averageNPS));
}