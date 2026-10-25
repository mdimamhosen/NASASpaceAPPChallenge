import assert from 'node:assert/strict';
import { UI_COPY } from './ui-copy.ts';
for (const [key, value] of Object.entries(UI_COPY)) {
  assert.ok(value.en.trim(), `${key} needs English copy`);
  assert.ok(value.bn.trim(), `${key} needs Bangla copy`);
}
console.log(`${Object.keys(UI_COPY).length} EN/BN interface strings checked`);
