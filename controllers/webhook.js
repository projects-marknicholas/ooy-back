import fetch from 'node-fetch';
import { GoogleGenerativeAI } from "@google/generative-ai";
import { getServices } from './service.js';
import { getProducts } from './products.js';
import { getNotes } from './notes.js';

export const PAGE_ACCESS_TOKEN = "EAAJdrm7dv8gBO2TkcdqnBXqeigAMCfJvE4f4LBUItFeekQshDFRyCHZAYU1oXIUMB6OIjZCSyvRwi1tBQ8h4otYmzPQtXmxQxPVyVadjVrHvK4plr6ZCEvjzAZBxLed9OZB4ORjLv3uEZAJF98gP2d7xB5svI2pMfFRKyqo42wspQiFfnonjkLTgV0iDagdbpmqtj4rDuaWq4XTAZDZD";
export const PAGE_ID = "148356005577403";
export const GEMINI_API_KEY = "AIzaSyBwZ3cj3e1tJv-ZqSQcL-GKh8gW_HgvCAk";

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ 
  model: "gemini-1.5-flash"  
});

class FacebookMessengerPoller {
  constructor() {
    this.pollingInterval = 5000; 
    this.conversationStates = new Map(); 
    this.isRunning = false;
    this.messageHistory = new Map(); 
  }

  async checkButtonState() {
    try {
      const response = await fetch('https://rantonme-5875c-default-rtdb.firebaseio.com/buttonState.json');
      const state = await response.json();
      return state === "on"; 
    } catch (error) {
      console.error('Error checking button state:', error);
      return false; 
    }
  }

  async start() {
    if (this.isRunning) return;
    this.isRunning = true;
    console.log('🚀 Starting Facebook Messenger poller');
    await this.pollMessages();
  }

  async pollMessages() {
    if (!this.isRunning) return;

    try {
      const isActive = await this.checkButtonState();
      if (!isActive) {
        console.log('⏸️ Polling paused - button state is off');
        if (this.isRunning) {
          setTimeout(() => this.pollMessages(), this.pollingInterval);
        }
        return;
      }
      
      console.log('\n🔍 Checking for new messages...');
      const conversations = await this.getConversations();
      
      if (conversations.length > 0) {
        await this.processConversations(conversations);
      } else {
        console.log('ℹ️ No active conversations found');
      }
    } catch (error) {
      console.error('❌ Polling error:', error.message);
    } finally {
      if (this.isRunning) {
        setTimeout(() => this.pollMessages(), this.pollingInterval);
      }
    }
  }

  async getConversations() {
    try {
      const response = await fetch(
        `https://graph.facebook.com/v12.0/me/conversations?fields=participants,updated_time&access_token=${PAGE_ACCESS_TOKEN}`
      );
      const data = await response.json();
      return data.data || [];
    } catch (error) {
      console.error('Error fetching conversations:', error.message);
      return [];
    }
  }

  async processConversations(conversations) {
    for (const conversation of conversations) {
      try {
        const messages = await this.getConversationMessages(conversation.id);
        if (messages.length > 0) {
          await this.analyzeConversation(conversation.id, messages);
        }
      } catch (error) {
        console.error(`Error processing conversation ${conversation.id}:`, error.message);
      }
    }
  }

  async getConversationMessages(conversationId) {
    try {
      const response = await fetch(
        `https://graph.facebook.com/v12.0/${conversationId}/messages?fields=id,message,created_time,from&access_token=${PAGE_ACCESS_TOKEN}`
      );
      const data = await response.json();
      return data.data || [];
    } catch (error) {
      console.error('Error fetching messages:', error.message);
      return [];
    }
  }

  async analyzeConversation(conversationId, messages) {
    // Initialize conversation state if not exists
    if (!this.conversationStates.has(conversationId)) {
      this.conversationStates.set(conversationId, {
        lastUserMessageId: null,
        lastReplyTime: null,
        needsReply: false
      });
    }

    const state = this.conversationStates.get(conversationId);
    const userMessages = messages.filter(msg => msg.from.id !== PAGE_ID);
    const ourMessages = messages.filter(msg => msg.from.id === PAGE_ID);

    // Find the latest user message we haven't replied to
    const unrepliedMessages = userMessages.filter(userMsg => 
      !ourMessages.some(ourMsg => 
        new Date(ourMsg.created_time) > new Date(userMsg.created_time)
      )
    );

    if (unrepliedMessages.length > 0) {
      const latestUnreplied = unrepliedMessages[0];
      
      // Only proceed if this is a new message we haven't processed
      if (state.lastUserMessageId !== latestUnreplied.id) {
        state.lastUserMessageId = latestUnreplied.id;
        state.needsReply = true;
        
        console.log(`📩 New unreplied message in conversation ${conversationId}:`, latestUnreplied.message);
        await this.sendReply(conversationId, latestUnreplied);
      }
    } else {
      state.needsReply = false;
    }
  }

  async sendReply(conversationId, message) {
    try {
      const state = this.conversationStates.get(conversationId);
      
      // Get raw Gemini response
      const geminiResponse = await this.getGeminiResponse(message.message);
      
      console.log(`💬 Gemini response for message ${message.id}:`, geminiResponse);
      
      // Send the raw Gemini response as the reply
      const response = await fetch('https://graph.facebook.com/v12.0/me/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipient: { id: message.from.id },
          message: { text: geminiResponse },
          messaging_type: 'RESPONSE',
          access_token: PAGE_ACCESS_TOKEN
        })
      });

      const data = await response.json();
      
      if (data.error) {
        throw new Error(data.error.message);
      }
      
      // Update conversation state
      state.lastReplyTime = new Date().toISOString();
      state.needsReply = false;
      
      console.log(`✅ Successfully replied to ${message.from.id}`);
      return data;
    } catch (error) {
      console.error('Error sending reply:', error.message);
      throw error;
    }
  }

  async getGeminiResponse(messageText) {
    const prompt = `
      Analyze the following message for a beauty clinic/salon specializing in:
      - Botox treatments
      - Diamond peel facials  
      - Silk peel facials
      - Other cosmetic skin services
      - Professional beauty products
  
      CATEGORIZATION INSTRUCTIONS:
      1. "services" - If primarily about clinical/cosmetic procedures or appointments:
        • "I need botox for my forehead wrinkles"
        • "How much for diamond peel?"
        • "Available slots for silk peel next week"
  
      2. "products" - If specifically asking about purchasable beauty items:
        • "Do you sell vitamin C serum?"
        • "Price list for your haircare line"
        • "Available shades of your foundation"
  
      3. "notes" - For non-treatment/product administrative inquiries:
        • "What are your operating hours?"
        • "Do you accept credit cards?"
        • "Clinic location and parking info"
  
      4. "redirect" - If message is:
        • Unrelated to beauty services ("Do you sell phones?")
        • Unsatisfied clients ("I don't want to talk to this AI, can you direct me on someone?")
  
      DECISION RULES:
      • Prefer "services" when treatment and product are both mentioned
      • Consider product+service bundles as "services"
      • "redirect" takes priority over all other categories
      • Default to "notes" for ambiguous but relevant messages
  
      RESPONSE FORMAT:
      Respond with ONLY one word:
      services
      products
      notes
      redirect
  
      Message to analyze: "${messageText}"
    `;
  
    try {
      // First determine the intent/category
      const result = await model.generateContent({
        contents: [{
          role: "user",
          parts: [{ text: prompt }]
        }]
      });
      
      const response = await result.response;
      const text = response.text().trim().toLowerCase();
      
      // Validate the response
      const validResponses = new Set(['services', 'products', 'notes', 'redirect']);
      const category = validResponses.has(text) ? text : 'notes';
  
      // Handle each category with specific follow-up
      switch(category) {
        case 'services':
          const servicesData = await getServices({ limit: 100 }); // Get your services data
          const servicesPrompt = `
            Based on the following services data, respond to the customer's inquiry about services.
            Available Services:
            ${JSON.stringify(servicesData, null, 2)}
            
            Customer Message: "${messageText}"
            
            Respond in a friendly, professional manner suitable for a beauty clinic.
            If they're asking about specific treatments, provide details.
            If they're asking about availability, suggest booking a consultation.
          `;
          
          const servicesResponse = await model.generateContent({
            contents: [{
              role: "user",
              parts: [{ text: servicesPrompt }]
            }]
          });
          return (await servicesResponse.response).text();
  
        case 'products':
          const productsData = await getProducts({ limit: 100 }); // Get your products data
          const productsPrompt = `
            Based on the following products data, respond to the customer's inquiry about products.
            Available Products:
            ${JSON.stringify(productsData, null, 2)}
            
            Customer Message: "${messageText}"
            
            Respond helpfully with product details, prices if available.
            If they're asking about something specific, provide that information.
            Keep it professional but friendly.
          `;
          
          const productsResponse = await model.generateContent({
            contents: [{
              role: "user",
              parts: [{ text: productsPrompt }]
            }]
          });
          return (await productsResponse.response).text();
  
        case 'notes':
          const notesData = await getNotes({ limit: 100 }); // Get your notes data
          const notesPrompt = `
            Based on the following information, respond to the customer's general inquiry.
            Clinic Information:
            ${JSON.stringify(notesData, null, 2)}
            
            Customer Message: "${messageText}"
            
            Provide clear, concise information about operating hours, location, payment methods, etc.
            Be polite and professional.
          `;
          
          const notesResponse = await model.generateContent({
            contents: [{
              role: "user",
              parts: [{ text: notesPrompt }]
            }]
          });
          return (await notesResponse.response).text();
  
        case 'redirect':
          return "For personal assistance, please message Dr. Lizbeth directly: https://web.facebook.com/carantolizbeth";
        
        default:
          return "Thank you for your message. We'll get back to you soon.";
      }
      
    } catch (error) {
      console.error('Gemini API Error:', error);
      return error;
    }
  }

  // Clean up old conversations to prevent memory leaks
  cleanOldConversations() {
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    for (const [conversationId, state] of this.conversationStates) {
      if (state.lastReplyTime && new Date(state.lastReplyTime) < oneWeekAgo) {
        this.conversationStates.delete(conversationId);
        this.messageHistory.delete(conversationId);
      }
    }
  }
}

export const verifyWebhook = (req, res) => {
  const VERIFY_TOKEN = 'oceanofyouthbot'; 

  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log('✅ Webhook verified!');
    res.status(200).send(challenge);
  } else {
    console.log('❌ Webhook verification failed.');
    res.sendStatus(403);
  }
};

export const messengerPoller = new FacebookMessengerPoller();











// import { GoogleGenerativeAI } from "@google/generative-ai";
// import { getServices } from './service.js';
// import { getProducts } from './products.js';
// import { getNotes } from './notes.js';
// import { getDatabase, ref, get } from "firebase/database";
// import { app } from './config.js';

// export const PAGE_ACCESS_TOKEN = "EAAJdrm7dv8gBO2TkcdqnBXqeigAMCfJvE4f4LBUItFeekQshDFRyCHZAYU1oXIUMB6OIjZCSyvRwi1tBQ8h4otYmzPQtXmxQxPVyVadjVrHvK4plr6ZCEvjzAZBxLed9OZB4ORjLv3uEZAJF98gP2d7xB5svI2pMfFRKyqo42wspQiFfnonjkLTgV0iDagdbpmqtj4rDuaWq4XTAZDZD";
// export const GEMINI_API_KEY = "AIzaSyBwZ3cj3e1tJv-ZqSQcL-GKh8gW_HgvCAk";
// const VERIFY_TOKEN = "your_verify_token"; 

// // Initialize Gemini AI
// const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
// const model = genAI.getGenerativeModel({ 
//   model: "gemini-1.5-flash"  
// });

// // Initialize Firebase
// const db = getDatabase(app);

// class FacebookMessengerHandler {
//   constructor() {
//     this.messageCache = new Map();
//     this.cacheCleanupInterval = setInterval(() => {
//       this.messageCache.clear();
//     }, 3600000); // Clear cache every hour
//   }

//   async checkButtonState() {
//     try {
//       const snapshot = await get(ref(db, 'buttonState'));
//       return snapshot.val() === "on";
//     } catch (error) {
//       console.error('Error checking button state:', error);
//       return false;
//     }
//   }

//   async handleWebhookEvent(event) {
//     try {
//       if (!event.sender || !event.message || !event.message.text) {
//         console.log('Invalid message event');
//         return;
//       }

//       const messageId = event.message.mid;
//       if (this.messageCache.has(messageId)) {
//         console.log('Duplicate message, skipping');
//         return;
//       }
//       this.messageCache.set(messageId, true);

//       // Check if AI is enabled
//       const isActive = await this.checkButtonState();
//       if (!isActive) {
//         console.log('AI is currently disabled');
//         return;
//       }

//       const response = await this.getGeminiResponse(event.message.text);
//       await this.sendReply(event.sender.id, response);
//     } catch (error) {
//       console.error('Error handling message:', error);
//     }
//   }

//   async sendReply(recipientId, text) {
//     try {
//       const response = await fetch('https://graph.facebook.com/v19.0/me/messages', {
//         method: 'POST',
//         headers: { 'Content-Type': 'application/json' },
//         body: JSON.stringify({
//           recipient: { id: recipientId },
//           message: { text },
//           messaging_type: 'RESPONSE',
//           access_token: PAGE_ACCESS_TOKEN
//         })
//       });

//       const data = await response.json();
//       if (data.error) {
//         throw new Error(data.error.message);
//       }
//       console.log('Successfully sent reply to', recipientId);
//     } catch (error) {
//       console.error('Error sending reply:', error);
//       throw error;
//     }
//   }

//   async getGeminiResponse(messageText) {
//     const prompt = `
//       Analyze the following message for a beauty clinic/salon specializing in:
//       - Botox treatments
//       - Diamond peel facials  
//       - Silk peel facials
//       - Other cosmetic skin services
//       - Professional beauty products
  
//       CATEGORIZATION INSTRUCTIONS:
//       1. "services" - If primarily about clinical/cosmetic procedures or appointments
//       2. "products" - If specifically asking about purchasable beauty items
//       3. "notes" - For non-treatment/product administrative inquiries
//       4. "redirect" - If unrelated to beauty services or client wants human help
  
//       RESPONSE FORMAT:
//       Respond with ONLY one word:
//       services
//       products
//       notes
//       redirect
  
//       Message: "${messageText}"
//     `;
  
//     try {
//       // Determine intent/category
//       const result = await model.generateContent({ contents: [{ role: "user", parts: [{ text: prompt }] }] });
//       const response = await result.response;
//       const text = response.text().trim().toLowerCase();
      
//       const validResponses = new Set(['services', 'products', 'notes', 'redirect']);
//       const category = validResponses.has(text) ? text : 'notes';

//       switch(category) {
//         case 'services':
//           const servicesData = await getServices({ limit: 100 });
//           const servicesPrompt = `Respond to this beauty service inquiry: "${messageText}". 
//             Available Services: ${JSON.stringify(servicesData)}. 
//             Be professional but friendly, provide details if asked.`;
//           const servicesResponse = await model.generateContent({ contents: [{ role: "user", parts: [{ text: servicesPrompt }] }] });
//           return (await servicesResponse.response).text();

//         case 'products':
//           const productsData = await getProducts({ limit: 100 });
//           const productsPrompt = `Respond to this product inquiry: "${messageText}". 
//             Available Products: ${JSON.stringify(productsData)}. 
//             Provide product details and prices if available.`;
//           const productsResponse = await model.generateContent({ contents: [{ role: "user", parts: [{ text: productsPrompt }] }] });
//           return (await productsResponse.response).text();

//         case 'notes':
//           const notesData = await getNotes({ limit: 100 });
//           const notesPrompt = `Respond to this general inquiry: "${messageText}". 
//             Clinic Info: ${JSON.stringify(notesData)}. 
//             Provide clear information about hours, location, payments etc.`;
//           const notesResponse = await model.generateContent({ contents: [{ role: "user", parts: [{ text: notesPrompt }] }] });
//           return (await notesResponse.response).text();

//         case 'redirect':
//           return "For personal assistance, please message Dr. Lizbeth directly: https://web.facebook.com/carantolizbeth";
        
//         default:
//           return "Thank you for your message. We'll get back to you soon.";
//       }
//     } catch (error) {
//       console.error('Gemini API Error:', error);
//       return "We're experiencing technical difficulties. Please try again later.";
//     }
//   }

//   verifyWebhook(req, res) {
//     const mode = req.query['hub.mode'];
//     const token = req.query['hub.verify_token'];
//     const challenge = req.query['hub.challenge'];

//     if (mode && token === VERIFY_TOKEN) {
//       res.status(200).send(challenge);
//     } else {
//       res.sendStatus(403);
//     }
//   }

//   cleanup() {
//     clearInterval(this.cacheCleanupInterval);
//   }
// }

// export const messengerHandler = new FacebookMessengerHandler();