const fs = require('fs');
let lines = fs.readFileSync('src/services/__tests__/projectDeleteQueue.test.ts', 'utf-8').split('\n');
const startIdx = lines.findIndex(l => l.includes('User Story 4: Fail-Closed Deletion Database Error Propagation (Part 2 - T028)'));
if (startIdx !== -1) {
    lines.splice(startIdx - 1);
    lines.push('});\n');
    fs.writeFileSync('src/services/__tests__/projectDeleteQueue.test.ts', lines.join('\n'), 'utf-8');
}
