import OpenAI from 'openai';
import { env } from '../../config/env';
import { CallContext, AIResponse } from '../../types';

class OpenAIService {
  private client: OpenAI;

  constructor() {
    this.client = new OpenAI({
      apiKey: env.OPENAI_API_KEY,
    });
  }

  /**
   * General chat completion with context
   */
  async chat(context: CallContext, userMessage: string): Promise<AIResponse> {
    try {
      const messages = this.buildMessages(context, userMessage);

      const completion = await this.client.chat.completions.create({
        model: env.OPENAI_MODEL,
        messages,
        temperature: 0.7,
        max_tokens: 150,
      });

      const responseText = completion.choices[0]?.message?.content || 
        "I'm sorry, I didn't understand that.";

      return {
        message: responseText,
        nextState: context.state,
        shouldGather: true,
      };
    } catch (error) {
      console.error('OpenAI API error:', error);
      return {
        message: "I apologize, I'm having trouble processing that. Could you repeat?",
        nextState: context.state,
        shouldGather: true,
      };
    }
  }

  /**
   * Summarize call transcript
   */
  async summarizeCall(transcript: string): Promise<{
    summary: string;
    intent: string;
    sentiment: string;
    actionItems: string[];
  }> {
    try {
      const completion = await this.client.chat.completions.create({
        model: env.OPENAI_MODEL,
        messages: [
          {
            role: 'system',
            content: `You are an expert at analyzing phone call transcripts. 
            Provide a concise summary, identify the caller's intent, determine sentiment (positive/neutral/negative), 
            and list any action items. Return as JSON with keys: summary, intent, sentiment, actionItems (array).`,
          },
          {
            role: 'user',
            content: transcript,
          },
        ],
        temperature: 0.3,
        response_format: { type: 'json_object' },
      });

      const result = JSON.parse(completion.choices[0]?.message?.content || '{}');

      return {
        summary: result.summary || 'Call completed',
        intent: result.intent || 'general inquiry',
        sentiment: result.sentiment || 'neutral',
        actionItems: result.actionItems || [],
      };
    } catch (error) {
      console.error('OpenAI summarization error:', error);
      return {
        summary: 'Call completed',
        intent: 'unknown',
        sentiment: 'neutral',
        actionItems: [],
      };
    }
  }

  /**
   * Build message array for OpenAI
   */
  private buildMessages(context: CallContext, userMessage: string): OpenAI.ChatCompletionMessageParam[] {
    const messages: OpenAI.ChatCompletionMessageParam[] = [
      {
        role: 'system',
        content: `You are a professional, friendly, and helpful AI receptionist. 
        You answer questions clearly and concisely. 
        If you don't know something, offer to connect the caller with someone who can help.
        Keep responses brief (1-2 sentences).
        Current state: ${context.state}`,
      },
    ];

    // Add conversation history (last 6 turns max)
    const recentHistory = context.conversationHistory.slice(-6);
    
    for (const turn of recentHistory) {
      messages.push({
        role: turn.speaker === 'user' ? 'user' : 'assistant',
        content: turn.text,
      });
    }

    // Add current user message if not already in history
    if (recentHistory.length === 0 || recentHistory[recentHistory.length - 1].text !== userMessage) {
      messages.push({
        role: 'user',
        content: userMessage,
      });
    }

    return messages;
  }
}

export const openAIService = new OpenAIService();
