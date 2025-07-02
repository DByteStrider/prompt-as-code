/**
 * File: harness/runner.ts
 * Purpose: Core orchestration engine for executing prompts against test samples
 * Handles loading prompts, matching with samples, LLM execution, and assertion validation
 */

import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { LLMClient } from './llm-client';
import { 
  PromptConfig, 
  SampleData, 
  TestCase, 
  TestResult, 
  RunnerConfig, 
  AssertionResult 
} from './types';

// =============================================================================
// Core Prompt Runner Class
// =============================================================================

export class PromptRunner {
  private llmClient: LLMClient;

  // ---------------------------------------------------------------------------
  // Constructor - Initialize with configuration
  // ---------------------------------------------------------------------------
  constructor(private config: RunnerConfig) {
    this.llmClient = new LLMClient(config.apiKey);
  }

  // ---------------------------------------------------------------------------
  // Main Execution Method
  // ---------------------------------------------------------------------------
  async run(): Promise<TestResult[]> {
    const startTime = Date.now();
    console.log('🚀 Starting prompt execution...\n');

    try {
      // Load all prompts and samples
      const prompts = await this.loadPrompts();
      const samples = await this.loadSamples();
      
      // Match prompts with their corresponding samples
      const testPairs = this.matchPromptsWithSamples(prompts, samples);
      
      if (testPairs.length === 0) {
        console.log('⚠️  No matching prompt-sample pairs found');
        return [];
      }

      console.log(`📝 Found ${testPairs.length} test(s) to execute\n`);

      // Execute all tests
      const results: TestResult[] = [];
      for (const pair of testPairs) {
        const testResults = await this.executeTestPair(pair);
        results.push(...testResults);
      }

      // Report results
      this.config.reporter.report(results);

      const totalTime = Date.now() - startTime;
      console.log(`\n⏱️  Total execution time: ${totalTime}ms`);

      return results;

    } catch (error) {
      console.error('❌ Fatal error during execution:', error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  // ---------------------------------------------------------------------------
  // Prompt Loading - Load and parse all YAML prompt files
  // ---------------------------------------------------------------------------
  private async loadPrompts(): Promise<PromptConfig[]> {
    const promptsDir = this.config.promptDir;
    
    if (!fs.existsSync(promptsDir)) {
      throw new Error(`Prompts directory not found: ${promptsDir}`);
    }

    const files = fs.readdirSync(promptsDir)
      .filter(file => file.endsWith('.yaml') || file.endsWith('.yml'));

    if (files.length === 0) {
      throw new Error(`No YAML files found in: ${promptsDir}`);
    }

    const prompts: PromptConfig[] = [];

    for (const file of files) {
      try {
        const filePath = path.join(promptsDir, file);
        const content = fs.readFileSync(filePath, 'utf8');
        const prompt = yaml.load(content) as PromptConfig;
        
        // Validate required fields
        if (!prompt.name || !prompt.template) {
          console.warn(`⚠️  Skipping invalid prompt file: ${file} (missing name or template)`);
          continue;
        }

        prompts.push(prompt);
        console.log(`✅ Loaded prompt: ${prompt.name} (${file})`);

      } catch (error) {
        console.warn(`⚠️  Failed to load prompt file ${file}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    return prompts;
  }

  // ---------------------------------------------------------------------------
  // Sample Loading - Load and parse all JSON sample files
  // ---------------------------------------------------------------------------
  private async loadSamples(): Promise<Map<string, SampleData>> {
    const samplesDir = this.config.samplesDir;
    
    if (!fs.existsSync(samplesDir)) {
      throw new Error(`Samples directory not found: ${samplesDir}`);
    }

    const files = fs.readdirSync(samplesDir)
      .filter(file => file.endsWith('.json'));

    const samplesMap = new Map<string, SampleData>();

    for (const file of files) {
      try {
        const filePath = path.join(samplesDir, file);
        const content = fs.readFileSync(filePath, 'utf8');
        const sampleData = JSON.parse(content) as TestCase[] | SampleData;
        
        // Handle both array format and object format
        let samples: SampleData;
        if (Array.isArray(sampleData)) {
          samples = { test_cases: sampleData };
        } else {
          samples = sampleData;
        }

        // Extract prompt name from filename or sample data
        const promptName = samples.prompt_name || path.basename(file, '.json').replace('_samples', '');
        samplesMap.set(promptName, samples);
        
        console.log(`✅ Loaded ${samples.test_cases.length} sample(s) for: ${promptName} (${file})`);

      } catch (error) {
        console.warn(`⚠️  Failed to load sample file ${file}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    return samplesMap;
  }

  // ---------------------------------------------------------------------------
  // Matching Logic - Pair prompts with their corresponding samples
  // ---------------------------------------------------------------------------
  private matchPromptsWithSamples(
    prompts: PromptConfig[], 
    samples: Map<string, SampleData>
  ): Array<{ prompt: PromptConfig; samples: SampleData }> {
    const pairs: Array<{ prompt: PromptConfig; samples: SampleData }> = [];

    for (const prompt of prompts) {
      // Apply filter if specified
      if (this.config.filter && prompt.name !== this.config.filter) {
        continue;
      }

      const sampleData = samples.get(prompt.name);
      if (sampleData) {
        pairs.push({ prompt, samples: sampleData });
      } else {
        console.warn(`⚠️  No samples found for prompt: ${prompt.name}`);
      }
    }

    return pairs;
  }

  // ---------------------------------------------------------------------------
  // Test Execution - Execute a prompt against its sample data
  // ---------------------------------------------------------------------------
  private async executeTestPair(pair: { 
    prompt: PromptConfig; 
    samples: SampleData 
  }): Promise<TestResult[]> {
    const { prompt, samples } = pair;
    const results: TestResult[] = [];

    console.log(`🔄 Executing prompt: ${prompt.name}`);

    for (const testCase of samples.test_cases) {
      const startTime = Date.now();
      
      try {
        // Substitute variables in template
        const processedPrompt = this.processTemplate(prompt.template, testCase.input);
        
        // Execute against LLM
        const response = await this.llmClient.executePrompt(
          processedPrompt,
          prompt,
          this.config.modelOverride
        );

        // Run assertions
        const assertionResults = this.runAssertions(response, testCase.assertions);
        const passed = this.allAssertionsPassed(assertionResults);

        const result: TestResult = {
          prompt_name: prompt.name,
          test_case_name: testCase.name,
          model_used: this.config.modelOverride || prompt.model || 'gpt-3.5-turbo',
          passed,
          response,
          assertions_checked: assertionResults,
          execution_time_ms: Date.now() - startTime
        };

        results.push(result);

        const status = passed ? '✅' : '❌';
        console.log(`  ${status} ${testCase.name} (${result.execution_time_ms}ms)`);

      } catch (error) {
        const result: TestResult = {
          prompt_name: prompt.name,
          test_case_name: testCase.name,
          model_used: this.config.modelOverride || prompt.model || 'gpt-3.5-turbo',
          passed: false,
          response: '',
          assertions_checked: { should_contain: [], should_not_contain: [] },
          execution_time_ms: Date.now() - startTime,
          error: error instanceof Error ? error.message : String(error)
        };

        results.push(result);
        console.log(`  ❌ ${testCase.name} - Error: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    return results;
  }

  // ---------------------------------------------------------------------------
  // Template Processing - Substitute variables in prompt templates
  // ---------------------------------------------------------------------------
  private processTemplate(template: string, variables: Record<string, any>): string {
    let processed = template;

    // Simple variable substitution: {{variable}} -> value
    for (const [key, value] of Object.entries(variables)) {
      const placeholder = `{{${key}}}`;
      processed = processed.replace(new RegExp(placeholder, 'g'), String(value));
    }

    // Check for unsubstituted placeholders
    const unsubstituted = processed.match(/\{\{[^}]+\}\}/g);
    if (unsubstituted) {
      console.warn(`⚠️  Unsubstituted placeholders found: ${unsubstituted.join(', ')}`);
    }

    return processed;
  }

  // ---------------------------------------------------------------------------
  // Assertion Validation - Check response against expected conditions
  // ---------------------------------------------------------------------------
  private runAssertions(
    response: string, 
    assertions: TestCase['assertions']
  ): { should_contain: AssertionResult[]; should_not_contain: AssertionResult[] } {
    const results = {
      should_contain: [] as AssertionResult[],
      should_not_contain: [] as AssertionResult[]
    };

    // Check "should contain" assertions
    if (assertions.should_contain) {
      for (const assertion of assertions.should_contain) {
        const found = response.toLowerCase().includes(assertion.toLowerCase());
        results.should_contain.push({
          assertion,
          passed: found,
          found_in_response: found
        });
      }
    }

    // Check "should not contain" assertions
    if (assertions.should_not_contain) {
      for (const assertion of assertions.should_not_contain) {
        const found = response.toLowerCase().includes(assertion.toLowerCase());
        results.should_not_contain.push({
          assertion,
          passed: !found, // Passes if NOT found
          found_in_response: found
        });
      }
    }

    return results;
  }

  // ---------------------------------------------------------------------------
  // Assertion Result Evaluation
  // ---------------------------------------------------------------------------
  private allAssertionsPassed(assertionResults: {
    should_contain: AssertionResult[];
    should_not_contain: AssertionResult[];
  }): boolean {
    const allShouldContainPassed = assertionResults.should_contain.every(a => a.passed);
    const allShouldNotContainPassed = assertionResults.should_not_contain.every(a => a.passed);
    
    return allShouldContainPassed && allShouldNotContainPassed;
  }
}