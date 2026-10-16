const assert = require('node:assert/strict');
const { mkdtempSync, writeFileSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { spawnSync } = require('node:child_process');
const test = require('node:test');

const script = join(__dirname, '..', 'hooks', 'code-format-instructions.js');

test('injects detected project format config without changing files', () => {
  const root = mkdtempSync(join(tmpdir(), 'code-format-'));
  writeFileSync(join(root, '.editorconfig'), 'root = true\n');
  const result = spawnSync(process.execPath, [script], {
    cwd: root,
    env: { ...process.env, CODE_FORMAT_EVENT: 'SessionStart' },
    encoding: 'utf8',
  });
  assert.equal(result.status, 0);
  assert.match(result.stdout, /CODE FORMAT ACTIVE/);
  assert.match(result.stdout, /\.editorconfig/);
});

test('keeps format context for Copilot prompt hooks', () => {
  const root = mkdtempSync(join(tmpdir(), 'code-format-'));
  const result = spawnSync(process.execPath, [script], {
    cwd: root,
    env: {
      ...process.env,
      CODE_FORMAT_EVENT: 'UserPromptSubmit',
      COPILOT_PLUGIN_DATA: '1',
    },
    encoding: 'utf8',
  });
  assert.equal(result.status, 0);
  const output = JSON.parse(result.stdout);
  assert.equal(typeof output.additionalContext, 'string');
  assert.match(output.additionalContext, /CODE FORMAT ACTIVE/);
});
