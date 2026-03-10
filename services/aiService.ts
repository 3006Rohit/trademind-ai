import { GoogleGenAI, Type } from "@google/genai";
import { SentimentAnalysisResult, OHLCData, MarketReport, FundamentalsReport } from "../types";

// Initialize the Gemini API client safely
const getAIClient = () => {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY || '';

  if (!apiKey) {
    console.warn("API_KEY not found in environment. AI features will be disabled.");
    return null;
  }

  try {
    return new GoogleGenAI({ apiKey });
  } catch (e) {
    console.error("Failed to initialize GoogleGenAI:", e);
    return null;
  }
};

export const analyzeStockSentiment = async (symbol: string): Promise<SentimentAnalysisResult> => {
  const ai = getAIClient();
  
  if (!ai) {
    return {
      text: "API Key missing or invalid. Please configure your API_KEY in .env or environment variables to enable AI Sentiment Analysis.",
      groundingChunks: [],
      timestamp: Date.now(),
    };
  }

  try {
    const model = "gemini-2.5-flash";
    const prompt = `Analyze the latest market news and events for ${symbol} stock.
    
    CRITICAL INSTRUCTION: Start your response with exactly "Sentiment Score: X" where X is a number between 0 (Extremely Bearish) and 100 (Extremely Bullish).
    
    Then provide a response covering:
    1. Overall Sentiment (Bullish, Bearish, or Neutral).
    2. A list of key recent news/events affecting the stock.
    3. Detailed explanation of how each event impacts the price or market perception.
    4. Any analyst upgrades/downgrades or earnings reports mentioned recently.
    
    Keep the tone professional and analytical.`;

    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
      },
    });

    let text = response.text || "No analysis available.";
    let score: number | undefined;

    // Parse Score
    const scoreMatch = text.match(/Sentiment Score:\s*(\d+)/i);
    if (scoreMatch && scoreMatch[1]) {
        score = parseInt(scoreMatch[1], 10);
        // Remove the score line from the display text to avoid duplication
        text = text.replace(/Sentiment Score:\s*\d+\s*/i, '').trim();
    }

    const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];

    return {
      text,
      score,
      groundingChunks,
      timestamp: Date.now(),
    };
  } catch (error) {
    console.error("Error analyzing sentiment:", error);
    return {
      text: "Failed to retrieve analysis. Please check your network connection or API quota.",
      groundingChunks: [],
      timestamp: Date.now(),
    };
  }
};

export const generateMarketReport = async (symbol: string, data: OHLCData[]): Promise<MarketReport | null> => {
  const ai = getAIClient();
  if (!ai) return null;

  try {
    // 1. Prepare Data
    const recentData = data.slice(-15); // Last 15 candles
    const dataString = recentData.map(d => 
        `Time: ${new Date(d.time).toLocaleTimeString()}, Open: ${d.open.toFixed(2)}, High: ${d.high.toFixed(2)}, Low: ${d.low.toFixed(2)}, Close: ${d.close.toFixed(2)}, Vol: ${d.volume}`
    ).join('\n');

    // 2. Configure Model
    const model = "gemini-2.5-flash";
    
    const prompt = `You are an expert quantitative financial analyst.
    
    I will provide you with the recent OHLCV (Open, High, Low, Close, Volume) data for ${symbol}.
    
    DATA (Last 15 Periods):
    ${dataString}
    
    YOUR TASK:
    1. Technical Pattern Recognition: Analyze the provided data for specific candlestick patterns (e.g., Doji, Hammer, Engulfing, Harami) and trend indicators (Volume spikes, price momentum).
    2. Sentiment Analysis: Use Google Search to find real-time social media sentiment (Reddit, X/Twitter) and financial news for ${symbol}.
    3. Synthesis: Combine the technical signals with the social sentiment to form a "Market Mood".
    
    Return the result in the specified JSON format.
    `;

    const response = await ai.models.generateContent({
        model,
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    mood: { type: Type.STRING, enum: ["Bullish", "Bearish", "Neutral"] },
                    technical_analysis: { type: Type.STRING },
                    sentiment_analysis: { type: Type.STRING },
                    conclusion: { type: Type.STRING }
                },
                required: ["mood", "technical_analysis", "sentiment_analysis", "conclusion"]
            }
        }
    });

    const result = JSON.parse(response.text || "{}");
    
    return {
        mood: result.mood || "Neutral",
        technical_analysis: result.technical_analysis || "Analysis failed.",
        sentiment_analysis: result.sentiment_analysis || "Sentiment check failed.",
        conclusion: result.conclusion || "No conclusion derived.",
        timestamp: Date.now()
    };

  } catch (error) {
      console.error("Error generating Gemini 3 Pro Report:", error);
      return null;
  }
};

export const generateFundamentalsReport = async (symbol: string, documentUrls: string[] = []): Promise<FundamentalsReport | null> => {
    const ai = getAIClient();
    if (!ai) return null;
  
    try {
      const model = "gemini-2.5-flash";
      
      const prompt = `Act as a senior financial auditor.
      Target Stock: ${symbol}
      
      Tasks:
      1. Find the latest 10-K (Annual Report) or Annual Financial Statements for ${symbol}.
      ${documentUrls.length > 0 ? `Please prioritize extraction from these provided URLs: ${documentUrls.join(', ')}` : 'Since no URLs were provided, use Google Search to find the most recent official financial reports.'}
      
      2. Extract the following specific metrics from the Income Statement or Cash Flow Statement:
         - Gross Profit (Revenue - Cost of Goods Sold)
         - Depreciation and Amortization (D&A)
  
      3. Summarize the findings in a natural language paragraph, noting the fiscal year and any year-over-year trends if visible.
  
      Return a clean JSON object.
      `;
  
      const response = await ai.models.generateContent({
          model,
          contents: prompt,
          config: {
              responseMimeType: "application/json",
              responseSchema: {
                  type: Type.OBJECT,
                  properties: {
                      symbol: { type: Type.STRING },
                      fiscal_year: { type: Type.STRING, description: "e.g. 2023 or 2024" },
                      gross_profit: {
                          type: Type.OBJECT,
                          properties: {
                              value: { type: Type.STRING, description: "The numeric value with currency, e.g. $96.4 Billion" },
                              context: { type: Type.STRING, description: "Brief explanation of this number" }
                          }
                      },
                      depreciation_amortization: {
                          type: Type.OBJECT,
                          properties: {
                              value: { type: Type.STRING, description: "The numeric value with currency, e.g. $12.3 Billion" },
                              context: { type: Type.STRING, description: "Brief explanation or location in report" }
                          }
                      },
                      summary: { type: Type.STRING, description: "Analysis of these numbers" }
                  },
                  required: ["symbol", "fiscal_year", "gross_profit", "depreciation_amortization", "summary"]
              }
          }
      });
  
      const result = JSON.parse(response.text || "{}");
      
      // Extract source URLs from grounding metadata
      const sourceUrls: string[] = [];
      const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
      chunks.forEach(chunk => {
          if (chunk.web?.uri) sourceUrls.push(chunk.web.uri);
      });
  
      return {
          symbol: result.symbol || symbol,
          fiscal_year: result.fiscal_year || "N/A",
          gross_profit: result.gross_profit || { value: "N/A", context: "Data not found" },
          depreciation_amortization: result.depreciation_amortization || { value: "N/A", context: "Data not found" },
          summary: result.summary || "No summary generated.",
          source_urls: sourceUrls,
          timestamp: Date.now()
      };
  
    } catch (error) {
        console.error("Error generating Fundamentals Report:", error);
        return null;
    }
  };