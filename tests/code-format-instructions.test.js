const assert = require('node:assert/strict');
const { mkdtempSync, readFileSync, writeFileSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { spawnSync } = require('node:child_process');
const test = require('node:test');

const script = join(__dirname, '..', 'hooks', 'code-format-instructions.js');

function runHook(platform, event, extraEnv = {}) {
  return spawnSync(process.execPath, [script], {
    cwd: tmpdir(),
    env: { ...process.env, CODE_FORMAT_PLATFORM: platform, CODE_FORMAT_EVENT: event, ...extraEnv },
    encoding: 'utf8',
  });
}

test('injects detected project format config without changing files', () => {
  const root = mkdtempSync(join(tmpdir(), 'code-format-'));
  writeFileSync(join(root, '.editorconfig'), 'root = true\n');
  writeFileSync(join(root, '.clang-format'), 'BasedOnStyle: LLVM\n');
  const result = spawnSync(process.execPath, [script], {
    cwd: root,
    env: { ...process.env, CODE_FORMAT_EVENT: 'SessionStart' },
    encoding: 'utf8',
  });
  assert.equal(result.status, 0);
  assert.match(result.stdout, /CODE FORMAT ACTIVE/);
  assert.match(result.stdout, /\.editorconfig/);
  assert.match(result.stdout, /\.clang-format/);
  assert.match(result.stdout, /适用于任何语言/);
  assert.doesNotMatch(result.stdout, /生成 Swift 代码时/);
});

test('keeps format context for Copilot prompt hooks', () => {
  const root = mkdtempSync(join(tmpdir(), 'code-format-'));
  const result = spawnSync(process.execPath, [script], {
    cwd: root,
    env: {
      ...process.env,
      CODE_FORMAT_EVENT: 'UserPromptSubmit',
      CODE_FORMAT_PLATFORM: 'copilot',
    },
    encoding: 'utf8',
  });
  assert.equal(result.status, 0);
  const output = JSON.parse(result.stdout);
  assert.equal(typeof output.additionalContext, 'string');
  assert.match(output.additionalContext, /CODE FORMAT ACTIVE/);
});

test('uses the explicit platform protocol for each host', () => {
  const copilot = JSON.parse(runHook('copilot', 'SessionStart').stdout);
  assert.equal(typeof copilot.additionalContext, 'string');

  const qoder = JSON.parse(runHook('qoder', 'UserPromptSubmit').stdout);
  assert.equal(qoder.hookSpecificOutput.hookEventName, 'UserPromptSubmit');

  const cursor = JSON.parse(runHook('cursor', 'UserPromptSubmit').stdout);
  assert.equal(cursor.continue, true);
  assert.equal(typeof cursor.additional_context, 'string');

  const claude = runHook('claude-codex', 'SessionStart');
  assert.match(claude.stdout, /CODE FORMAT ACTIVE/);

  const subagent = JSON.parse(runHook('claude-codex', 'SubagentStart').stdout);
  assert.equal(subagent.hookSpecificOutput.hookEventName, 'SubagentStart');
});

test('does not emit context when disabled', () => {
  const result = runHook('cursor', 'UserPromptSubmit', { CODE_FORMAT_OFF: '1' });
  assert.equal(result.status, 0);
  assert.equal(result.stdout, '');
});

test('hook commands select their platform explicitly', () => {
  const expected = {
    'claude-codex-hooks.json': 'claude-codex',
    'copilot-hooks.json': 'copilot',
    'cursor-hooks.json': 'cursor',
    'qoder-hooks.json': 'qoder',
  };
  for (const [file, platform] of Object.entries(expected)) {
    assert.match(readFileSync(join(__dirname, '..', 'hooks', file), 'utf8'), new RegExp(`CODE_FORMAT_PLATFORM='${platform}'`));
  }
  assert.match(readFileSync(join(__dirname, '..', 'hooks', 'claude-codex-hooks.json'), 'utf8'), /CODEX_PLUGIN_ROOT \|\|/);
});

test('Codex manifest exposes the code-format command', () => {
  const manifest = JSON.parse(readFileSync(join(__dirname, '..', '.codex-plugin', 'plugin.json'), 'utf8'));
  assert.equal(manifest.commands, './commands/');
});
