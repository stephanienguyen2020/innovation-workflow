// API endpoint configuration
const API_BASE_URL = "/api"; // Using Next.js API proxy route instead of direct backend URL

// Types for our API requests and responses
export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
  time?: string;
  metadata?: Record<string, any>;
}

export interface ChatHistory {
  messages: ChatMessage[];
  session_id: string;
}

export interface ChatRequest {
  text: string;
}

export interface ChatResponse {
  messages: string[];
}

export interface SessionResponse {
  session_id: string;
}

// API functions for chat interactions
export const api = {
  // Create a new chat session
  createChatSession: async (): Promise<string> => {
    try {
      const response = await fetch(`${API_BASE_URL}/chat/new`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to create session: ${response.status}`);
      }

      const data: SessionResponse = await response.json();
      return data.session_id;
    } catch (error) {
      console.error("Error creating chat session:", error);
      throw error;
    }
  },

  // Send a message to the chat session
  sendMessage: async (
    sessionId: string,
    message: string
  ): Promise<ChatResponse> => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/chat/${sessionId}/message`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ text: message }),
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to send message: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error("Error sending message:", error);
      throw error;
    }
  },

  // Get chat history for a session
  getChatHistory: async (sessionId: string): Promise<ChatHistory> => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/chat/${sessionId}/history`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to get chat history: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error("Error getting chat history:", error);
      throw error;
    }
  },

  // Delete a chat session
  deleteChatSession: async (sessionId: string): Promise<void> => {
    try {
      const response = await fetch(`${API_BASE_URL}/chat/${sessionId}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to delete session: ${response.status}`);
      }
    } catch (error) {
      console.error("Error deleting chat session:", error);
      throw error;
    }
  },
};
