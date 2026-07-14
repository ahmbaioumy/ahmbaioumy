const { CosmosClient } = require("@azure/cosmos");
const { BlobServiceClient } = require("@azure/storage-blob");

const cosmosEndpoint = process.env.COSMOS_DB_ENDPOINT;
const cosmosKey = process.env.COSMOS_DB_KEY;
const cosmosDatabaseId = process.env.COSMOS_DB_DATABASE;
const cosmosContainerId = process.env.COSMOS_DB_CONTAINER;
const storageConnectionString = process.env.STORAGE_CONNECTION_STRING;

const cosmosClient = new CosmosClient({ endpoint: cosmosEndpoint, key: cosmosKey });
const blobServiceClient = BlobServiceClient.fromConnectionString(storageConnectionString);

module.exports = async function (context, req) {
  context.log('Save chat function triggered');

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

  const chatData = req.body;

  if (!chatData || !chatData.userMessage || !chatData.agentResponse) {
    context.res = {
      status: 400,
      body: { error: 'Chat data with userMessage and agentResponse is required' }
    };
    return;
  }

  try {
    const chatId = `chat-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Prepare chat log for storage
    const chatLog = {
      id: chatId,
      type: 'chat-log',
      userMessage: chatData.userMessage,
      agentResponse: chatData.agentResponse,
      sentiment: chatData.sentiment,
      npsData: chatData.npsData,
      timestamp: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      customer: chatData.userMessage.user || 'Unknown',
      agent: chatData.agentResponse.sender || 'Agent'
    };

    // Store in Cosmos DB
    await storeChatInCosmos(chatLog);
    
    // Store detailed log in Blob Storage
    await storeChatInBlob(chatLog);

    context.log('Chat saved successfully:', chatId);

    context.res = {
      status: 200,
      body: {
        success: true,
        chatId,
        timestamp: chatLog.timestamp
      }
    };

  } catch (error) {
    context.log.error('Error saving chat:', error);
    
    context.res = {
      status: 500,
      body: { 
        error: 'Failed to save chat',
        details: error.message 
      }
    };
  }
};

async function storeChatInCosmos(chatLog) {
  try {
    const { database } = await cosmosClient.databases.createIfNotExists({ 
      id: cosmosDatabaseId 
    });
    const { container } = await database.containers.createIfNotExists({ 
      id: cosmosContainerId 
    });
    
    await container.items.create(chatLog);
  } catch (error) {
    context.log.error('Error storing chat in Cosmos DB:', error);
    throw error;
  }
}

async function storeChatInBlob(chatLog) {
  try {
    const containerName = 'chat-logs';
    const containerClient = blobServiceClient.getContainerClient(containerName);
    
    // Create container if it doesn't exist
    await containerClient.createIfNotExists();
    
    // Create blob name with date structure
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    
    const blobName = `${year}/${month}/${day}/${chatLog.id}.json`;
    
    const blockBlobClient = containerClient.getBlockBlobClient(blobName);
    
    // Convert chat log to JSON string
    const chatLogJson = JSON.stringify(chatLog, null, 2);
    
    await blockBlobClient.upload(chatLogJson, chatLogJson.length, {
      blobHTTPHeaders: {
        blobContentType: 'application/json'
      }
    });
    
  } catch (error) {
    context.log.error('Error storing chat in Blob Storage:', error);
    // Don't throw error to avoid breaking the main function
  }
}