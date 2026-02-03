
import { maskPhrase } from '@/lib/core/blitz';

const cases = [
    { phrase: 'Sign a contract', target: 'contract' },
    { phrase: 'Make a decision', target: 'make' },
    { phrase: 'Run out of time', target: 'run' },
    { phrase: 'No target here', target: 'missing' },
    { phrase: 'Case Insensitive', target: 'case' },
];

console.log('--- Testing maskPhrase ---');

cases.forEach(({ phrase, target }) => {
    const result = maskPhrase(phrase, target);
    console.log(`\nPhrase: "${phrase}", Target: "${target}"`);
    console.log('Result:', JSON.stringify(result, null, 2));
});
