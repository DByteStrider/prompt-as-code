/**
 * File: harness/runner.ts
 * Purpose: Core orchestration engine for executing prompts against test samples
 * Handles loading prompts, matching with samples, LLM execution, and assertion validation
 */
import { TestResult, RunnerConfig } from './types';
export declare class PromptRunner {
    private config;
    private llmClient;
    constructor(config: RunnerConfig);
    run(): Promise<TestResult[]>;
    private loadPrompts;
    private loadSamples;
    private matchPromptsWithSamples;
    private executeTestPair;
    private processTemplate;
    private runAssertions;
    private allAssertionsPassed;
}
//# sourceMappingURL=runner.d.ts.map