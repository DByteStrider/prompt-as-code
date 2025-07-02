/**
 * File: harness/types.ts
 * Purpose: TypeScript interfaces and types for the prompt-as-code harness
 * Defines data structures for prompts, samples, results, and configuration
 */
/**
 * Structure of a prompt YAML file
 */
export interface PromptConfig {
    name: string;
    version: string;
    description: string;
    template: string;
    model?: string;
    temperature?: number;
    max_tokens?: number;
}
/**
 * Individual test case within a sample file
 */
export interface TestCase {
    name: string;
    input: Record<string, any>;
    assertions: {
        should_contain?: string[];
        should_not_contain?: string[];
    };
}
/**
 * Collection of test cases for a prompt
 */
export interface SampleData {
    prompt_name?: string;
    test_cases: TestCase[];
}
/**
 * Result of running a single test case
 */
export interface TestResult {
    prompt_name: string;
    test_case_name: string;
    model_used: string;
    passed: boolean;
    response: string;
    assertions_checked: {
        should_contain: AssertionResult[];
        should_not_contain: AssertionResult[];
    };
    execution_time_ms: number;
    error?: string;
}
/**
 * Result of a single assertion check
 */
export interface AssertionResult {
    assertion: string;
    passed: boolean;
    found_in_response?: boolean;
}
/**
 * Configuration for the PromptRunner
 */
export interface RunnerConfig {
    promptDir: string;
    samplesDir: string;
    modelOverride?: string;
    apiKey: string;
    reporter: Reporter;
    filter?: string;
}
/**
 * Interface for output formatting (console vs JSON)
 */
export interface Reporter {
    report(results: TestResult[]): void;
}
//# sourceMappingURL=types.d.ts.map