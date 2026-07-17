/**
 * Minimal tests for speech helpers (node --test).
 */

'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { sanitizeForSpeech, truncateSpeech, escapeSsml } = require('../utils/speech');

describe('sanitizeForSpeech', () => {
  it('strips markdown and urls', () => {
    const out = sanitizeForSpeech('Hello **bold** and `code` see https://example.com now');
    assert.ok(!out.includes('**'));
    assert.ok(!out.includes('`'));
    assert.ok(!out.includes('https://'));
    assert.ok(out.includes('bold'));
  });
});

describe('truncateSpeech', () => {
  it('prefers sentence boundary', () => {
    const long = 'First sentence. Second sentence is longer and goes on. ' + 'x'.repeat(800);
    const out = truncateSpeech(long, 80);
    assert.ok(out.length <= 80);
    assert.ok(out.includes('First sentence'));
  });
});

describe('escapeSsml', () => {
  it('escapes special characters', () => {
    assert.equal(escapeSsml(`A & B <C>`), 'A &amp; B &lt;C&gt;');
  });
});
