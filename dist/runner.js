"use strict";
/**
 * File: harness/runner.ts
 * Purpose: Core orchestration engine for executing prompts against test samples
 * Handles loading prompts, matching with samples, LLM execution, and assertion validation
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.PromptRunner = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const yaml = __importStar(require("js-yaml"));
const llm_client_1 = require("./llm-client");
// =============================================================================
// Core Prompt Runner Class
// =============================================================================
class PromptRunner {
    // ---------------------------------------------------------------------------
    // Constructor - Initialize with configuration
    // ---------------------------------------------------------------------------
    constructor(config) {
        this.config = config;
        this.llmClient = new llm_client_1.LLMClient(config.apiKey);
    }
    // ---------------------------------------------------------------------------
    // Main Execution Method
    // ---------------------------------------------------------------------------
    async run() {
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
            const results = [];
            for (const pair of testPairs) {
                const testResults = await this.executeTestPair(pair);
                results.push(...testResults);
            }
            // Report results
            this.config.reporter.report(results);
            const totalTime = Date.now() - startTime;
            console.log(`\n⏱️  Total execution time: ${totalTime}ms`);
            return results;
        }
        catch (error) {
            console.error('❌ Fatal error during execution:', error instanceof Error ? error.message : String(error));
            throw error;
        }
    }
    // ---------------------------------------------------------------------------
    // Prompt Loading - Load and parse all YAML prompt files
    // ---------------------------------------------------------------------------
    async loadPrompts() {
        const promptsDir = this.config.promptDir;
        if (!fs.existsSync(promptsDir)) {
            throw new Error(`Prompts directory not found: ${promptsDir}`);
        }
        const files = fs.readdirSync(promptsDir)
            .filter(file => file.endsWith('.yaml') || file.endsWith('.yml'));
        if (files.length === 0) {
            throw new Error(`No YAML files found in: ${promptsDir}`);
        }
        const prompts = [];
        for (const file of files) {
            try {
                const filePath = path.join(promptsDir, file);
                const content = fs.readFileSync(filePath, 'utf8');
                const prompt = yaml.load(content);
                // Validate required fields
                if (!prompt.name || !prompt.template) {
                    console.warn(`⚠️  Skipping invalid prompt file: ${file} (missing name or template)`);
                    continue;
                }
                prompts.push(prompt);
                console.log(`✅ Loaded prompt: ${prompt.name} (${file})`);
            }
            catch (error) {
                console.warn(`⚠️  Failed to load prompt file ${file}: ${error instanceof Error ? error.message : String(error)}`);
            }
        }
        return prompts;
    }
    // ---------------------------------------------------------------------------
    // Sample Loading - Load and parse all JSON sample files
    // ---------------------------------------------------------------------------
    async loadSamples() {
        const samplesDir = this.config.samplesDir;
        if (!fs.existsSync(samplesDir)) {
            throw new Error(`Samples directory not found: ${samplesDir}`);
        }
        const files = fs.readdirSync(samplesDir)
            .filter(file => file.endsWith('.json'));
        const samplesMap = new Map();
        for (const file of files) {
            try {
                const filePath = path.join(samplesDir, file);
                const content = fs.readFileSync(filePath, 'utf8');
                const sampleData = JSON.parse(content);
                // Handle both array format and object format
                let samples;
                if (Array.isArray(sampleData)) {
                    samples = { test_cases: sampleData };
                }
                else {
                    samples = sampleData;
                }
                // Extract prompt name from filename or sample data
                const promptName = samples.prompt_name || path.basename(file, '.json').replace('_samples', '');
                samplesMap.set(promptName, samples);
                console.log(`✅ Loaded ${samples.test_cases.length} sample(s) for: ${promptName} (${file})`);
            }
            catch (error) {
                console.warn(`⚠️  Failed to load sample file ${file}: ${error instanceof Error ? error.message : String(error)}`);
            }
        }
        return samplesMap;
    }
    // ---------------------------------------------------------------------------
    // Matching Logic - Pair prompts with their corresponding samples
    // ---------------------------------------------------------------------------
    matchPromptsWithSamples(prompts, samples) {
        const pairs = [];
        for (const prompt of prompts) {
            // Apply filter if specified
            if (this.config.filter && prompt.name !== this.config.filter) {
                continue;
            }
            const sampleData = samples.get(prompt.name);
            if (sampleData) {
                pairs.push({ prompt, samples: sampleData });
            }
            else {
                console.warn(`⚠️  No samples found for prompt: ${prompt.name}`);
            }
        }
        return pairs;
    }
    // ---------------------------------------------------------------------------
    // Test Execution - Execute a prompt against its sample data
    // ---------------------------------------------------------------------------
    async executeTestPair(pair) {
        const { prompt, samples } = pair;
        const results = [];
        console.log(`🔄 Executing prompt: ${prompt.name}`);
        for (const testCase of samples.test_cases) {
            const startTime = Date.now();
            try {
                // Substitute variables in template
                const processedPrompt = this.processTemplate(prompt.template, testCase.input);
                // Execute against LLM
                const response = await this.llmClient.executePrompt(processedPrompt, prompt, this.config.modelOverride);
                // Run assertions
                const assertionResults = this.runAssertions(response, testCase.assertions);
                const passed = this.allAssertionsPassed(assertionResults);
                const result = {
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
            }
            catch (error) {
                const result = {
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
    processTemplate(template, variables) {
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
    runAssertions(response, assertions) {
        const results = {
            should_contain: [],
            should_not_contain: []
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
    allAssertionsPassed(assertionResults) {
        const allShouldContainPassed = assertionResults.should_contain.every(a => a.passed);
        const allShouldNotContainPassed = assertionResults.should_not_contain.every(a => a.passed);
        return allShouldContainPassed && allShouldNotContainPassed;
    }
}
exports.PromptRunner = PromptRunner;
