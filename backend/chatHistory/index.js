const { CosmosClient } = require("@azure/cosmos");

const endpoint = process.env.COSMOS_DB_ENDPOINT;
const key = process.env.COSMOS_DB_KEY;
const databaseId = process.env.COSMOS_DB_DATABASE;
const containerId = process.env.COSMOS_DB_CONTAINER;

const cosmosClient = new CosmosClient({ endpoint, key });

module.exports = async function (context, req) {
  context.log('Chat history function triggered');

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
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;
    const customer = req.query.customer;
    const agent = req.query.agent;
    const startDate = req.query.startDate;
    const endDate = req.query.endDate;

    // Build query
    let query = 'SELECT * FROM c WHERE c.type = "chat-log"';
    const parameters = [];

    if (customer) {
      query += ' AND c.customer = @customer';
      parameters.push({ name: '@customer', value: customer });
    }

    if (agent) {
      query += ' AND c.agent = @agent';
      parameters.push({ name: '@agent', value: agent });
    }

    if (startDate) {
      query += ' AND c.timestamp >= @startDate';
      parameters.push({ name: '@startDate', value: startDate });
    }

    if (endDate) {
      query += ' AND c.timestamp <= @endDate';
      parameters.push({ name: '@endDate', value: endDate });
    }

    query += ' ORDER BY c.timestamp DESC';
    query += ` OFFSET ${offset} LIMIT ${limit}`;

    const { database } = await cosmosClient.databases.createIfNotExists({ 
      id: databaseId 
    });
    const { container } = await database.containers.createIfNotExists({ 
      id: containerId 
    });

    const { resources: chatLogs } = await container.items
      .query({
        query,
        parameters
      })
      .fetchAll();

    // Transform data for frontend
    const transformedLogs = chatLogs.map(log => ({
      id: log.id,
      customer: log.customer,
      agent: log.agent,
      timestamp: log.timestamp,
      sentiment: log.sentiment?.sentiment || 'unknown',
      npsType: log.npsData?.customerType || 'unknown',
      npsScore: log.npsData?.npsScore || 0,
      userMessage: log.userMessage?.text || '',
      agentResponse: log.agentResponse?.text || ''
    }));

    context.log(`Retrieved ${transformedLogs.length} chat logs`);

    context.res = {
      status: 200,
      body: transformedLogs
    };

  } catch (error) {
    context.log.error('Error retrieving chat history:', error);
    
    context.res = {
      status: 500,
      body: { 
        error: 'Failed to retrieve chat history',
        details: error.message 
      }
    };
  }
};