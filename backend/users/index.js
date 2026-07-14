const { CosmosClient } = require("@azure/cosmos");

const endpoint = process.env.COSMOS_DB_ENDPOINT;
const key = process.env.COSMOS_DB_KEY;
const databaseId = process.env.COSMOS_DB_DATABASE;
const containerId = process.env.COSMOS_DB_CONTAINER;

const cosmosClient = new CosmosClient({ endpoint, key });

module.exports = async function (context, req) {
  context.log('Users function triggered');

  // Enable CORS
  context.res.headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  };

  if (req.method === 'OPTIONS') {
    context.res.status = 200;
    return;
  }

  try {
    const { database } = await cosmosClient.databases.createIfNotExists({ 
      id: databaseId 
    });
    const { container } = await database.containers.createIfNotExists({ 
      id: containerId 
    });

    if (req.method === 'GET') {
      // Get all users
      const { resources: users } = await container.items
        .query({
          query: 'SELECT * FROM c WHERE c.type = "user"'
        })
        .fetchAll();

      // If no users exist, create mock users
      if (users.length === 0) {
        const mockUsers = createMockUsers();
        context.res = {
          status: 200,
          body: mockUsers
        };
        return;
      }

      context.res = {
        status: 200,
        body: users
      };

    } else if (req.method === 'PUT') {
      // Update user role
      const userId = req.params.userId;
      const { role } = req.body;

      if (!userId || !role) {
        context.res = {
          status: 400,
          body: { error: 'User ID and role are required' }
        };
        return;
      }

      // In a real implementation, you would update the user in the database
      // For now, we'll return a success response
      context.res = {
        status: 200,
        body: { success: true, message: 'User role updated successfully' }
      };

    } else {
      context.res = {
        status: 405,
        body: { error: 'Method not allowed' }
      };
    }

  } catch (error) {
    context.log.error('Error in users function:', error);
    
    context.res = {
      status: 500,
      body: { 
        error: 'Failed to process users request',
        details: error.message 
      }
    };
  }
};

function createMockUsers() {
  return [
    {
      id: 'user-1',
      name: 'John Smith',
      email: 'john.smith@company.com',
      role: 'agent',
      status: 'active',
      lastActive: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
      joinDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString() // 30 days ago
    },
    {
      id: 'user-2',
      name: 'Sarah Johnson',
      email: 'sarah.johnson@company.com',
      role: 'manager',
      status: 'active',
      lastActive: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(), // 1 hour ago
      joinDate: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString() // 60 days ago
    },
    {
      id: 'user-3',
      name: 'Mike Wilson',
      email: 'mike.wilson@company.com',
      role: 'agent',
      status: 'active',
      lastActive: new Date(Date.now() - 30 * 60 * 1000).toISOString(), // 30 minutes ago
      joinDate: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString() // 15 days ago
    },
    {
      id: 'user-4',
      name: 'Emily Davis',
      email: 'emily.davis@company.com',
      role: 'admin',
      status: 'active',
      lastActive: new Date(Date.now() - 15 * 60 * 1000).toISOString(), // 15 minutes ago
      joinDate: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString() // 90 days ago
    },
    {
      id: 'user-5',
      name: 'David Brown',
      email: 'david.brown@company.com',
      role: 'agent',
      status: 'inactive',
      lastActive: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days ago
      joinDate: new Date(Date.now() - 120 * 24 * 60 * 60 * 1000).toISOString() // 120 days ago
    }
  ];
}