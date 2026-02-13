import OpenAI from 'openai';
import { env } from '../../config/env';
import { CallContext, AIResponse } from '../../types';
import { searchFAQs, lookupKnowledgeBase, getBusinessHoursStatus } from './toolFunctions';
import { ragService } from './ragService';

class OpenAIService {
  private client: OpenAI;

  constructor() {
    this.client = new OpenAI({
      apiKey: env.OPENAI_API_KEY,
    });
  }

  /**
   * Define available tools/functions for the AI
   */
  private getTools(): OpenAI.ChatCompletionTool[] {
    return [
      {
        type: 'function',
        function: {
          name: 'search_faqs',
          description: 'Search frequently asked questions for quick answers about common topics like pricing, hours, services, etc.',
          parameters: {
            type: 'object',
            properties: {
              query: {
                type: 'string',
                description: 'The question or topic to search for in FAQs',
              },
            },
            required: ['query'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'search_knowledge_base',
          description: 'Search the detailed knowledge base for in-depth information about products, services, policies, or procedures.',
          parameters: {
            type: 'object',
            properties: {
              query: {
                type: 'string',
                description: 'The topic or question to look up in the knowledge base',
              },
            },
            required: ['query'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'check_business_hours',
          description: 'Check if the business is currently open and get the operating hours.',
          parameters: {
            type: 'object',
            properties: {},
            required: [],
          },
        },
      },
    ];
  }

  /**
   * Execute a tool/function call
   */
  private async executeTool(
    functionName: string,
    args: any,
    context: CallContext
  ): Promise<string> {
    try {
      switch (functionName) {
        case 'search_faqs': {
          const result = await searchFAQs(context.tenantId, args.query);
          if (result.found) {
            return `FAQ Match - Q: ${result.question}\nA: ${result.answer}${result.category ? `\nCategory: ${result.category}` : ''}`;
          }
          return 'No matching FAQ found. Try searching the knowledge base or ask me to connect you with someone who can help.';
        }

        case 'search_knowledge_base': {
          const result = await lookupKnowledgeBase(context.tenantId, args.query);
          if (result.found) {
            return `Knowledge Base: ${result.answer}${result.category ? `\nCategory: ${result.category}` : ''}`;
          }
          return 'No information found in knowledge base. I can connect you with someone who can help with this.';
        }

        case 'check_business_hours': {
          const result = await getBusinessHoursStatus(context.tenantId);
          let response = `Business is currently ${result.isOpen ? 'OPEN' : 'CLOSED'}. Today's hours: ${result.hours}.`;
          if (result.fullSchedule) {
            response += ` Full schedule: ${result.fullSchedule}`;
          }
          return response;
        }

        default:
          return `Unknown function: ${functionName}`;
      }
    } catch (error) {
      console.error(`Error executing tool ${functionName}:`, error);
      return `Error executing ${functionName}`;
    }
  }

  /**
   * General chat completion with context and tool calling
   */
  async chat(context: CallContext, userMessage: string): Promise<AIResponse> {
    try {
      const messages = await this.buildMessages(context, userMessage);
      const tools = this.getTools();

      // First completion - may request function calls
      let completion = await this.client.chat.completions.create({
        model: env.OPENAI_MODEL,
        messages,
        tools,
        tool_choice: 'auto', // Let AI decide when to use tools
        temperature: 0.7,
        max_tokens: 150,
      });

      let responseMessage = completion.choices[0].message;

      // Handle function calls if AI requested them
      if (responseMessage.tool_calls && responseMessage.tool_calls.length > 0) {
        // Add AI's response with tool calls to messages
        messages.push(responseMessage);

        // Execute each tool call
        for (const toolCall of responseMessage.tool_calls) {
          const functionName = toolCall.function.name;
          const functionArgs = JSON.parse(toolCall.function.arguments);

          console.log(`🔧 AI calling tool: ${functionName}`, functionArgs);

          const functionResult = await this.executeTool(
            functionName,
            functionArgs,
            context
          );

          // Add function result to messages
          messages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: functionResult,
          });
        }

        // Get final response from AI using function results
        completion = await this.client.chat.completions.create({
          model: env.OPENAI_MODEL,
          messages,
          temperature: 0.7,
          max_tokens: 150,
        });

        responseMessage = completion.choices[0].message;
      }

      const responseText = responseMessage.content || 
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
  private async buildMessages(context: CallContext, userMessage: string): Promise<OpenAI.ChatCompletionMessageParam[]> {
    const personality = context.config?.personality || 'professional, friendly, and helpful';
    
    // Get relevant website context using RAG
    let websiteContext = '';
    try {
      const relevantContext = await ragService.getRelevantContext(userMessage, context.tenantId, 3);
      if (relevantContext) {
        websiteContext = `\n\nWEBSITE CONTEXT (relevant information from the business website):\n${relevantContext}\n`;
      }
    } catch (error) {
      console.error('Error fetching website context:', error);
    }
    
    const messages: OpenAI.ChatCompletionMessageParam[] = [
      {
        role: 'system',
        content: `You are an AI voice receptionist with a ${personality} personality. You are on a phone call, so keep responses concise and natural.

IMPORTANT CONVERSATION RULES:
- Keep responses SHORT (1-2 sentences max) - this is a phone call, not a chat
- Be conversational and natural - sound human, not robotic
- DON'T say "I'll search the database" or mention technical operations
- DON'T repeat what the caller just said unless asking for confirmation
- If someone asks about hours, USE the check_business_hours tool to get the current complete schedule
- Listen carefully to what the caller says - don't confuse their responses

YOUR TOOLS:
1. search_faqs - Quick answers to common questions (hours, pricing, services, policies)
2. search_knowledge_base - Detailed information about products, services, procedures
3. check_business_hours - Get current open/closed status AND full weekly schedule

SMART BEHAVIOR:
- When asked about business hours, ALWAYS use check_business_hours tool
- When asked about services, products, or policies, search for them
- If you find information, share it naturally without mentioning your search
- If you don't know something, offer to connect them with someone who can help
- Be proactive: anticipate what they might need
${websiteContext}
CURRENT CONTEXT:
- Call state: ${context.state}
- Previous conversation: ${context.conversationHistory.length} turns
${context.metadata?.ivrSelection ? `- Caller selected option: ${context.metadata?.ivrLabel || 'Unknown'}` : ''}

Remember: You're talking to someone on the phone. Be helpful, brief, and natural!`,
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
