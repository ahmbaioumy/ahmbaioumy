const { OpenAIClient } = require("@azure/openai");

const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
const key = process.env.AZURE_OPENAI_KEY;
const deploymentName = process.env.AZURE_OPENAI_DEPLOYMENT_NAME || "gpt-35-turbo";

if (!endpoint || !key) {
  throw new Error("AZURE_OPENAI_ENDPOINT and AZURE_OPENAI_KEY environment variables are required");
}

const client = new OpenAIClient(endpoint, key);

module.exports = async function (context, req) {
  context.log('NPS classification function triggered');

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

  const { message, sentiment } = req.body;

  if (!message || !sentiment) {
    context.res = {
      status: 400,
      body: { error: 'Message and sentiment data are required' }
    };
    return;
  }

  try {
    // Classify NPS using Azure OpenAI with fine-tuned prompts
    const messages = [
      {
        role: "system",
        content: `You are an expert NPS (Net Promoter Score) classifier trained on customer service interactions. 
        
        Based on customer messages and their sentiment, classify customers into three categories:
        
        DETRACTOR (0-6): Customers who are unhappy, frustrated, or likely to spread negative word-of-mouth
        - Indicators: Complaints, anger, frustration, disappointment, threats to leave, negative language
        - Examples: "This is terrible", "I'm never using this again", "Worst service ever", "I want a refund"
        
        PROMOTER (9-10): Customers who are highly satisfied and likely to recommend your service
        - Indicators: Praise, satisfaction, recommendations, positive language, loyalty
        - Examples: "Amazing service", "I'll definitely recommend this", "Love it", "Perfect solution"
        
        NEUTRAL (7-8): Customers who are satisfied but not enthusiastic, neither detractors nor promoters
        - Indicators: Neutral language, basic satisfaction, no strong emotions either way
        - Examples: "It's okay", "Works fine", "No complaints", "Average service"
        
        Respond with a JSON object:
        {
          "customerType": "DETRACTOR|PROMOTER|NEUTRAL",
          "npsScore": 0-10,
          "confidence": 0.0-1.0,
          "reasoning": "explanation of classification",
          "keywords": ["key", "words", "that", "influenced", "decision"]
        }`
      },
      {
        role: "user",
        content: `Classify this customer message:
        Message: "${message}"
        Sentiment: ${sentiment.sentiment} (confidence: ${sentiment.confidence || 0.5})
        
        What is the NPS classification?`
      }
    ];

    const completion = await client.getChatCompletions(deploymentName, messages, {
      temperature: 0.1,
      maxTokens: 300
    });

    const responseText = completion.choices[0].message.content;
    let classificationResult;

    try {
      classificationResult = JSON.parse(responseText);
    } catch (parseError) {
      // Fallback parsing
      const typeMatch = responseText.match(/"customerType":\s*"(DETRACTOR|PROMOTER|NEUTRAL)"/);
      const scoreMatch = responseText.match(/"npsScore":\s*([0-9]+)/);
      const confidenceMatch = responseText.match(/"confidence":\s*([0-9.]+)/);
      
      classificationResult = {
        customerType: typeMatch ? typeMatch[1] : "NEUTRAL",
        npsScore: scoreMatch ? parseInt(scoreMatch[1]) : 5,
        confidence: confidenceMatch ? parseFloat(confidenceMatch[1]) : 0.5,
        reasoning: "Fallback parsing used",
        keywords: []
      };
    }

    // Validate and normalize the result
    const customerType = classificationResult.customerType || "NEUTRAL";
    const npsScore = Math.max(0, Math.min(10, classificationResult.npsScore || 5));
    const confidence = Math.max(0, Math.min(1, classificationResult.confidence || 0.5));

    const response = {
      customerType: customerType,
      npsScore: npsScore,
      confidence: confidence,
      accuracy: confidence,
      reasoning: classificationResult.reasoning || "AI classification",
      keywords: classificationResult.keywords || [],
      sentiment: sentiment.sentiment,
      timestamp: new Date().toISOString(),
      message: message.substring(0, 100) + (message.length > 100 ? '...' : '')
    };

    context.log('NPS classification completed:', response);

    context.res = {
      status: 200,
      body: response
    };

  } catch (error) {
    context.log.error('Error classifying NPS:', error);
    
    context.res = {
      status: 500,
      body: { 
        error: 'Failed to classify NPS',
        details: error.message 
      }
    };
  }
};