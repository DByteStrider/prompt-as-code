/**
 * File: harness/llm-client.ts
 * Purpose: OpenAI API integration for executing prompts against language models
 * Handles API calls, error handling, and response processing
 */

import OpenAI from 'openai';
import { PromptConfig } from './types';

// =============================================================================
// LLM Client Class
// =============================================================================

export class LLMClient {
  private openai: OpenAI;

  // ---------------------------------------------------------------------------
  // Constructor - Initialize OpenAI client
  // ---------------------------------------------------------------------------
  constructor(apiKey: string) {
    this.openai = new OpenAI({
      apiKey: apiKey,
    });
  }

  // ---------------------------------------------------------------------------
  // Execute Prompt - Main method for running prompts against OpenAI API
  // ---------------------------------------------------------------------------
  async executePrompt(
    promptText: string, 
    config: PromptConfig, 
    modelOverride?: string
  ): Promise<string> {
    try {
      // Model selection with CLI override support
      const model = modelOverride || config.model || 'gpt-3.5-turbo';
      
      // API call with configuration from YAML + overrides
      const response = await this.openai.chat.completions.create({
        model,
        messages: [
          {
            role: 'user',
            content: promptText
          }
        ],
        temperature: config.temperature || 0.1,
        max_tokens: config.max_tokens || 500,
      });

      // Extract response content
      return response.choices[0]?.message?.content || '';
    } catch (error) {
      // Enhanced error handling for debugging
      throw new Error(`OpenAI API error: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}