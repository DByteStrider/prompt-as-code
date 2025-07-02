/**
 * File: harness/reporter.ts
 * Purpose: Output formatters for test results (console and JSON)
 * Handles human-readable and machine-parseable result presentation
 */
import { TestResult, Reporter } from './types';
export declare class ConsoleReporter implements Reporter {
    /**
     * Output results in colorized, human-readable format
     */
    report(results: TestResult[]): void;
}
export declare class JsonReporter implements Reporter {
    /**
     * Output results as structured JSON for CI/CD integration
     */
    report(results: TestResult[]): void;
}
//# sourceMappingURL=reporter.d.ts.map