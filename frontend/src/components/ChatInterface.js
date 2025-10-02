import React, { useState, useEffect, useRef } from 'react';
import { useMsal } from '@azure/msal-react';
import { HubConnectionBuilder } from '@microsoft/signalr';
import { sendMessage, analyzeSentiment, getNPSPrediction, saveChatLog } from '../services/api';
import './ChatInterface.css';

function ChatInterface() {
  const [message, setMessage] = useState('');
  const [chatHistory, setChatHistory] = useState([]);
  const [sentiment, setSentiment] = useState(null);
  const [npsData, setNpsData] = useState(null);
  const [isTyping, setIsTyping] = useState(false);
  const [connection, setConnection] = useState(null);
  const chatEndRef = useRef(null);
  const { instance, accounts } = useMsal();

  useEffect(() => {
    // Initialize SignalR connection
    const newConnection = new HubConnectionBuilder()
      .withUrl('/api/chatHub')
      .build();

    newConnection.start()
      .then(() => {
        console.log('SignalR Connected');
        setConnection(newConnection);
      })
      .catch(err => console.error('SignalR Connection Error: ', err));

    return () => {
      if (newConnection) {
        newConnection.stop();
      }
    };
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory]);

  const handleSendMessage = async () => {
    if (!message.trim()) return;

    const userMessage = {
      id: Date.now(),
      text: message,
      sender: 'user',
      timestamp: new Date(),
      user: accounts[0]?.name || 'User'
    };

    setChatHistory(prev => [...prev, userMessage]);
    setIsTyping(true);

    try {
      // Analyze sentiment
      const sentimentAnalysis = await analyzeSentiment(message);
      setSentiment(sentimentAnalysis);

      // Get NPS prediction
      const npsPrediction = await getNPSPrediction(message, sentimentAnalysis);
      setNpsData(npsPrediction);

      // Create agent response
      const agentResponse = {
        id: Date.now() + 1,
        text: generateAgentResponse(sentimentAnalysis, npsPrediction),
        sender: 'agent',
        timestamp: new Date(),
        sentiment: sentimentAnalysis,
        npsData: npsPrediction
      };

      setChatHistory(prev => [...prev, agentResponse]);

      // Save chat log
      await saveChatLog({
        userMessage,
        agentResponse,
        sentiment: sentimentAnalysis,
        npsData: npsPrediction
      });

      // Send real-time notification if detractor
      if (npsPrediction.customerType === 'Detractor' && connection) {
        await connection.invoke('NotifyManager', {
          customerType: 'Detractor',
          message: message,
          timestamp: new Date(),
          agent: accounts[0]?.name || 'Unknown'
        });
      }

    } catch (error) {
      console.error('Error processing message:', error);
      const errorResponse = {
        id: Date.now() + 1,
        text: 'Sorry, I encountered an error processing your message. Please try again.',
        sender: 'agent',
        timestamp: new Date(),
        isError: true
      };
      setChatHistory(prev => [...prev, errorResponse]);
    } finally {
      setIsTyping(false);
      setMessage('');
    }
  };

  const generateAgentResponse = (sentiment, npsData) => {
    const responses = {
      positive: [
        "Thank you for your positive feedback! We're delighted to hear about your experience.",
        "We're thrilled that you're happy with our service! Is there anything else we can help you with?",
        "Your positive feedback means a lot to us! We're here to continue providing excellent service."
      ],
      neutral: [
        "Thank you for reaching out. We're here to help improve your experience.",
        "We appreciate your feedback. Let us know how we can better assist you.",
        "We're committed to providing the best service possible. How can we help you today?"
      ],
      negative: [
        "I'm sorry to hear about your concerns. Let's work together to resolve this issue.",
        "We take your feedback seriously and want to make things right. How can we help?",
        "I understand your frustration. Let me help you with this issue right away."
      ]
    };

    const sentimentType = sentiment.sentiment.toLowerCase();
    const responseArray = responses[sentimentType] || responses.neutral;
    return responseArray[Math.floor(Math.random() * responseArray.length)];
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="chat-interface">
      <div className="chat-header">
        <h2>Customer Service Chat</h2>
        <div className="user-info">
          Welcome, {accounts[0]?.name || 'Agent'}
        </div>
      </div>

      <div className="chat-container">
        <div className="chat-messages">
          {chatHistory.map((chat) => (
            <div key={chat.id} className={`message ${chat.sender}`}>
              <div className="message-content">
                <div className="message-text">{chat.text}</div>
                <div className="message-meta">
                  <span className="timestamp">
                    {chat.timestamp.toLocaleTimeString()}
                  </span>
                  {chat.sentiment && (
                    <span className={`sentiment sentiment-${chat.sentiment.sentiment.toLowerCase()}`}>
                      Sentiment: {chat.sentiment.sentiment} ({Math.round(chat.sentiment.confidenceScores[chat.sentiment.sentiment.toLowerCase()] * 100)}%)
                    </span>
                  )}
                  {chat.npsData && (
                    <span className={`nps nps-${chat.npsData.customerType.toLowerCase()}`}>
                      NPS: {chat.npsData.customerType} (Score: {chat.npsData.npsScore})
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
          
          {isTyping && (
            <div className="message agent">
              <div className="typing-indicator">
                <span></span>
                <span></span>
                <span></span>
              </div>
            </div>
          )}
          
          <div ref={chatEndRef} />
        </div>

        <div className="chat-input">
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Type your message here..."
            rows="3"
            disabled={isTyping}
          />
          <button 
            onClick={handleSendMessage} 
            disabled={!message.trim() || isTyping}
            className="send-button"
          >
            Send
          </button>
        </div>
      </div>

      {sentiment && (
        <div className="sentiment-panel">
          <h3>Real-time Analysis</h3>
          <div className="analysis-grid">
            <div className="analysis-item">
              <label>Sentiment:</label>
              <span className={`sentiment-${sentiment.sentiment.toLowerCase()}`}>
                {sentiment.sentiment}
              </span>
            </div>
            <div className="analysis-item">
              <label>Confidence:</label>
              <span>{Math.round(sentiment.confidenceScores[sentiment.sentiment.toLowerCase()] * 100)}%</span>
            </div>
            {npsData && (
              <>
                <div className="analysis-item">
                  <label>Customer Type:</label>
                  <span className={`nps-${npsData.customerType.toLowerCase()}`}>
                    {npsData.customerType}
                  </span>
                </div>
                <div className="analysis-item">
                  <label>NPS Score:</label>
                  <span>{npsData.npsScore}</span>
                </div>
                <div className="analysis-item">
                  <label>Accuracy:</label>
                  <span>{Math.round(npsData.accuracy * 100)}%</span>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default ChatInterface;