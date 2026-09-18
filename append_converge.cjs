const fs = require('fs');
let content = fs.readFileSync('specs/147-crdt-atomic-manifest-hardening/tasks.md', 'utf8');
const newTasks = '\n## Phase 9: Convergence\n\n' +
'- [ ] T037 Add test in `src/services/__tests__/projectDeleteQueue.test.ts`: verify that when additional chapters are discovered during cursor traversal, the committed manifest includes ALL discovered chapter IDs per FR-009 / US5 (`missing`)\n';
content += newTasks;
fs.writeFileSync('specs/147-crdt-atomic-manifest-hardening/tasks.md', content, 'utf8');
