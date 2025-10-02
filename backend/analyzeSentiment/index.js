const { OpenAIClient } = require("@azure/openai");

const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
const key = process.env.AZURE_OPENAI_KEY;
const deploymentName = process.env.AZURE_OPENAI_DEPLOYMENT_NAME || "gpt-35-turbo";

if (!endpoint || !key) {
  throw new Error("AZURE_OPENAI_ENDPOINT and AZURE_OPENAI_KEY environment variables are required");
}

const client = new OpenAIClient(endpoint, key);

module.exports = async function (context, req) {
  context.log('Sentiment analysis function triggered');

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

  const { text } = req.body;

  if (!text || typeof text !== 'string') {
    context.res = {
      status: 400,
      body: { error: 'Text is required and must be a string' }
    };
    return;
  }

  try {
    // Analyze sentiment using Azure OpenAI
    const messages = [
      {
        role: "system",
        content: `You are an expert sentiment analysis AI. Analyze the sentiment of customer messages and classify them as:
        - "positive": Happy, satisfied, pleased, excited, grateful
        - "negative": Angry, frustrated, disappointed, upset, annoyed
        - "neutral": Neither positive nor negative, factual, indifferent
        
        Respond with a JSON object containing:
        {
          "sentiment": "positive|negative|neutral",
          "confidence": 0.0-1.0,
          "reasoning": "brief explanation"
        }`
      },
      {
        role: "user",
        content: `Analyze the sentiment of this customer message: "${text}"`
      }
    ];

    const completion = await client.getChatCompletions(deploymentName, messages, {
      temperature: 0.1,
      maxTokens: 200
    });

    const responseText = completion.choices[0].message.content;
    let analysisResult;

    try {
      analysisResult = JSON.parse(responseText);
    } catch (parseError) {
      // Fallback parsing if JSON is malformed
      const sentimentMatch = responseText.match(/"sentiment":\s*"(positive|negative|neutral)"/);
      const confidenceMatch = responseText.match(/"confidence":\s*([0-9.]+)/);
      
      analysisResult = {
        sentiment: sentimentMatch ? sentimentMatch[1] : "neutral",
        confidence: confidenceMatch ? parseFloat(confidenceMatch[1]) : 0.5,
        reasoning: "Fallback parsing used"
      };
    }

    // Convert to expected format
    const sentiment = analysisResult.sentiment.toLowerCase();
    const confidence = analysisResult.confidence || 0.5;

    const response = {
      sentiment: sentiment,
      confidenceScores: {
        positive: sentiment === 'positive' ? confidence : (1 - confidence) / 2,
        negative: sentiment === 'negative' ? confidence : (1 - confidence) / 2,
        neutral: sentiment === 'neutral' ? confidence : (1 - confidence) / 2
      },
      confidence: confidence,
      reasoning: analysisResult.reasoning,
      text: text.substring(0, 100) + (text.length > 100 ? '...' : ''),
      timestamp: new Date().toISOString()
    };

    context.log('Sentiment analysis completed:', response);

    context.res = {
      status: 200,
      body: response
    };

  } catch (error) {
    context.log.error('Error analyzing sentiment:', error);
    
    context.res = {
      status: 500,
      body: { 
        error: 'Failed to analyze sentiment',
        details: error.message 
      }
    };
  }
};