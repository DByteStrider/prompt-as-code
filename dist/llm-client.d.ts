/**
 * File: harness/llm-client.ts
 * Purpose: OpenAI API integration for executing prompts against language models
 * Handles API calls, error handling, and response processing
 */
import { PromptConfig } from './types';
export declare class LLMClient {
    private openai;
    constructor(apiKey: string);
    executePrompt(promptText: string, config: PromptConfig, modelOverride?: string): Promise<string>;
}
//# sourceMappingURL=llm-client.d.ts.map