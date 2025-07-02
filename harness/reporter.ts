/**
 * File: harness/reporter.ts
 * Purpose: Output formatters for test results (console and JSON)
 * Handles human-readable and machine-parseable result presentation
 */

import { TestResult, Reporter } from './types';

// =============================================================================
// Console Reporter - Human-readable output
// =============================================================================

export class ConsoleReporter implements Reporter {
  
  /**
   * Output results in colorized, human-readable format
   */
  report(results: TestResult[]): void {
    console.log('\n=== Prompt Test Results ===\n');
    
    // -------------------------------------------------------------------------
    // Individual Test Results
    // -------------------------------------------------------------------------
    results.forEach(result => {
      const status = result.passed ? '✅ PASS' : '❌ FAIL';
      const timing = `(${result.execution_time_ms}ms)`;
      
      console.log(`${status} ${result.prompt_name} → ${result.test_case_name} ${timing}`);
      console.log(`  Model: ${result.model_used}`);
      
      // Show failed assertions
      if (!result.passed) {
        const failedAssertions = [
          ...result.assertions_checked.should_contain.filter(a => !a.passed),
          ...result.assertions_checked.should_not_contain.filter(a => !a.passed)
        ];
        
        failedAssertions.forEach(assertion => {
          console.log(`    ❌ ${assertion.assertion}`);
        });
      }
      
      // Show errors if any
      if (result.error) {
        console.log(`    Error: ${result.error}`);
      }
      
      console.log(''); // Empty line for readability
    });
    
    // -------------------------------------------------------------------------
    // Summary Statistics
    // -------------------------------------------------------------------------
    const passed = results.filter(r => r.passed).length;
    const total = results.length;
    const passRate = total > 0 ? ((passed / total) * 100).toFixed(1) : '0';
    
    console.log(`\nSummary: ${passed}/${total} tests passed (${passRate}%)`);
    
    if (passed === total) {
      console.log('🎉 All tests passed!');
    } else {
      console.log(`⚠️  ${total - passed} test(s) failed`);
    }
  }
}

// =============================================================================
// JSON Reporter - Machine-parseable output
// =============================================================================

export class JsonReporter implements Reporter {
  
  /**
   * Output results as structured JSON for CI/CD integration
   */
  report(results: TestResult[]): void {
    // -------------------------------------------------------------------------
    // Calculate Summary Statistics
    // -------------------------------------------------------------------------
    const passed = results.filter(r => r.passed).length;
    const total = results.length;
    const totalTime = results.reduce((sum, r) => sum + r.execution_time_ms, 0);
    
    // -------------------------------------------------------------------------
    // Build JSON Report Structure
    // -------------------------------------------------------------------------
    const report = {
      summary: {
        total_tests: total,
        passed: passed,
        failed: total - passed,
        pass_rate: total > 0 ? parseFloat(((passed / total) * 100).toFixed(1)) : 0,
        total_execution_time_ms: totalTime
      },
      results: results,
      timestamp: new Date().toISOString()
    };
    
    // -------------------------------------------------------------------------
    // Output JSON
    // -------------------------------------------------------------------------
    console.log(JSON.stringify(report, null, 2));
  }
}