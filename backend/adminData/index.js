const { CosmosClient } = require("@azure/cosmos");

const endpoint = process.env.COSMOS_DB_ENDPOINT;
const key = process.env.COSMOS_DB_KEY;
const databaseId = process.env.COSMOS_DB_DATABASE;
const containerId = process.env.COSMOS_DB_CONTAINER;

const cosmosClient = new CosmosClient({ endpoint, key });

module.exports = async function (context, req) {
  context.log('Admin data function triggered');

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

    // Get all chat logs
    const { resources: allChats } = await container.items
      .query({
        query: 'SELECT * FROM c WHERE c.type = "chat-log"'
      })
      .fetchAll();

    // Calculate admin metrics
    const adminData = calculateAdminMetrics(allChats);

    context.log('Admin data calculated:', adminData);

    context.res = {
      status: 200,
      body: adminData
    };

  } catch (error) {
    context.log.error('Error getting admin data:', error);
    
    context.res = {
      status: 500,
      body: { 
        error: 'Failed to get admin data',
        details: error.message 
      }
    };
  }
};

function calculateAdminMetrics(allChats) {
  const totalChats = allChats.length;
  
  // User metrics (mock data - in real implementation, you'd have a users table)
  const totalUsers = 25; // Mock total users
  const activeUsers = 18; // Mock active users (users who have chatted in last 7 days)
  
  // Role distribution (mock data)
  const roleCounts = {
    agents: 15,
    managers: 5,
    admins: 3
  };
  
  // System health metrics
  const systemHealth = {
    apiStatus: 'healthy',
    dbStatus: 'connected',
    signalRStatus: 'connected'
  };
  
  // Performance metrics
  const performanceMetrics = {
    avgResponseTime: '2.1 min',
    apiCallsPerMinute: 45,
    errorRate: '0.5%',
    dailyActiveUsers: 12,
    monthlyChats: totalChats,
    peakConcurrentUsers: 8
  };
  
  // System uptime (mock)
  const systemUptime = '99.9%';

  return {
    totalUsers,
    activeUsers,
    totalChats,
    systemUptime,
    roleCounts,
    systemHealth,
    performanceMetrics
  };
}