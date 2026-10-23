import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

describe('Regression Tests: False Accepts on Hindi Video Bullets', () => {
  it('raw decisions should be saved in evidence/regression_false_accepts.json', () => {
    const evidencePath = path.resolve('../evidence/regression_false_accepts.json');
    assert.ok(fs.existsSync(evidencePath), 'evidence/regression_false_accepts.json must exist');
    const data = JSON.parse(fs.readFileSync(evidencePath, 'utf-8'));
    assert.ok(Array.isArray(data.results));
    assert.strictEqual(data.results.length, 2);
  });

  // Per instruction: If either is not flagged NO SUPPORT, do not change the verifier; mark the test as failing.
  it(
    'Bullet "Robots can solve problems using input from sensors" must be flagged NO SUPPORT',
    { todo: 'Production verifier returned SUPPORTED instead of NO SUPPORT; chunk retrieval/lexical check needed' },
    () => {
      const evidencePath = path.resolve('../evidence/regression_false_accepts.json');
      const data = JSON.parse(fs.readFileSync(evidencePath, 'utf-8'));
      const bullet1 = data.results.find((r: any) => r.bullet.includes('sensors'));
      assert.ok(bullet1, 'Sensors bullet result must exist in evidence');
      // Assert required grade:
      assert.strictEqual(bullet1.grade, 'NO SUPPORT', 'Sensors bullet should have been flagged NO SUPPORT');
    }
  );

  it(
    'Bullet "more versatile AI like Alexa can perform multiple tasks" must be flagged NO SUPPORT',
    { todo: 'Production verifier returned SUPPORTED instead of NO SUPPORT; chunk retrieval/lexical check needed' },
    () => {
      const evidencePath = path.resolve('../evidence/regression_false_accepts.json');
      const data = JSON.parse(fs.readFileSync(evidencePath, 'utf-8'));
      const bullet2 = data.results.find((r: any) => r.bullet.includes('Alexa'));
      assert.ok(bullet2, 'Alexa bullet result must exist in evidence');
      // Assert required grade:
      assert.strictEqual(bullet2.grade, 'NO SUPPORT', 'Versatile Alexa bullet should have been flagged NO SUPPORT');
    }
  );
});
