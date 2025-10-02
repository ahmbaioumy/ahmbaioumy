const { app } = require('@azure/functions');
const { SignalRServiceUtils } = require('@azure/signalr');

const connectionString = process.env.SIGNALR_CONNECTION_STRING;

if (!connectionString) {
  throw new Error('SIGNALR_CONNECTION_STRING environment variable is required');
}

const signalRServiceUtils = new SignalRServiceUtils(connectionString);

module.exports = async function (context, req) {
  context.log('SignalR hub function triggered');

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

  try {
    const { action, userId, message, data } = req.body;

    switch (action) {
      case 'negotiate':
        return await handleNegotiate(context, userId);
      case 'notify':
        return await handleNotify(context, userId, message, data);
      case 'broadcast':
        return await handleBroadcast(context, message, data);
      default:
        context.res = {
          status: 400,
          body: { error: 'Invalid action' }
        };
        return;
    }

  } catch (error) {
    context.log.error('SignalR hub error:', error);
    
    context.res = {
      status: 500,
      body: { 
        error: 'SignalR hub error',
        details: error.message 
      }
    };
  }
};

async function handleNegotiate(context, userId) {
  try {
    const token = await signalRServiceUtils.generateAccessToken(userId, ['chat']);
    
    context.res = {
      status: 200,
      body: {
        url: signalRServiceUtils.getClientEndpoint(),
        accessToken: token
      }
    };
  } catch (error) {
    context.log.error('Negotiate error:', error);
    throw error;
  }
}

async function handleNotify(context, userId, message, data) {
  try {
    await signalRServiceUtils.sendToUser(userId, 'notification', {
      message,
      data,
      timestamp: new Date().toISOString()
    });
    
    context.res = {
      status: 200,
      body: { success: true }
    };
  } catch (error) {
    context.log.error('Notify error:', error);
    throw error;
  }
}

async function handleBroadcast(context, message, data) {
  try {
    await signalRServiceUtils.broadcast('notification', {
      message,
      data,
      timestamp: new Date().toISOString()
    });
    
    context.res = {
      status: 200,
      body: { success: true }
    };
  } catch (error) {
    context.log.error('Broadcast error:', error);
    throw error;
  }
}