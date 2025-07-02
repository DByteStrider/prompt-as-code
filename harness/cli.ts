#!/usr/bin/env node

/**
 * File: harness/cli.ts
 * Purpose: Command-line interface for the prompt-as-code harness
 * Handles argument parsing, validation, and orchestrates prompt execution
 */

import { Command } from 'commander';
import { PromptRunner } from './runner';
import { ConsoleReporter, JsonReporter } from './reporter';

// =============================================================================
// CLI Setup & Configuration
// =============================================================================

const program = new Command();

// =============================================================================
// Main Program Definition
// =============================================================================

program
  .name('prompt-as-code')
  .description('Run versioned prompts against test samples')
  .version('1.0.0');

// =============================================================================
// Run Command - Core functionality
// =============================================================================

program
  .command('run')
  .description('Execute prompts against sample data')
  .option('--prompt-dir <dir>', 'Directory containing prompt YAML files', './prompts/v1')
  .option('--samples-dir <dir>', 'Directory containing sample JSON files', './samples')
  .option('--model <model>', 'Override model (gpt-4, gpt-3.5-turbo, etc.)')
  .option('--output <format>', 'Output format: console or json', 'console')
  .option('--filter <name>', 'Run specific prompt by name')
  .option('--api-key <key>', 'OpenAI API key (or use OPENAI_API_KEY env var)')
  .action(async (options) => {
    try {
      // -----------------------------------------------------------------------
      // API Key Validation
      // -----------------------------------------------------------------------
      const apiKey = options.apiKey || process.env.OPENAI_API_KEY;
      if (!apiKey) {
        console.error('Error: OpenAI API key required. Set OPENAI_API_KEY env var or use --api-key flag');
        process.exit(1);
      }

      // -----------------------------------------------------------------------
      // Reporter Setup
      // -----------------------------------------------------------------------
      const reporter = options.output === 'json' 
        ? new JsonReporter() 
        : new ConsoleReporter();

      // -----------------------------------------------------------------------
      // Runner Execution
      // -----------------------------------------------------------------------
      const runner = new PromptRunner({
        promptDir: options.promptDir,
        samplesDir: options.samplesDir,
        modelOverride: options.model,
        apiKey,
        reporter,
        filter: options.filter
      });

      const results = await runner.run();
      
      // -----------------------------------------------------------------------
      // Exit Code Handling
      // -----------------------------------------------------------------------
      const hasFailures = results.some(r => !r.passed);
      process.exit(hasFailures ? 1 : 0);

    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });

// =============================================================================
// CLI Entry Point
// =============================================================================

program.parse();