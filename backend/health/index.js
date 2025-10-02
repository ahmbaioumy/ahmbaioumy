module.exports = async function (context, req) {
  context.log('Health check function triggered');

  // Enable CORS
  context.res.headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
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
    // Check environment variables
    const requiredEnvVars = [
      'TEXT_ANALYTICS_ENDPOINT',
      'TEXT_ANALYTICS_KEY',
      'COSMOS_DB_ENDPOINT',
      'COSMOS_DB_KEY',
      'STORAGE_CONNECTION_STRING',
      'SIGNALR_CONNECTION_STRING'
    ];

    const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);
    
    const healthStatus = {
      status: missingEnvVars.length === 0 ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      checks: {
        environmentVariables: {
          status: missingEnvVars.length === 0 ? 'healthy' : 'unhealthy',
          missing: missingEnvVars
        },
        azureServices: {
          textAnalytics: process.env.TEXT_ANALYTICS_ENDPOINT ? 'configured' : 'not configured',
          cosmosDb: process.env.COSMOS_DB_ENDPOINT ? 'configured' : 'not configured',
          storage: process.env.STORAGE_CONNECTION_STRING ? 'configured' : 'not configured',
          signalR: process.env.SIGNALR_CONNECTION_STRING ? 'configured' : 'not configured'
        }
      }
    };

    const statusCode = healthStatus.status === 'healthy' ? 200 : 503;

    context.res = {
      status: statusCode,
      body: healthStatus
    };

  } catch (error) {
    context.log.error('Health check error:', error);
    
    context.res = {
      status: 503,
      body: { 
        status: 'unhealthy',
        error: 'Health check failed',
        details: error.message,
        timestamp: new Date().toISOString()
      }
    };
  }
};