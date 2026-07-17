/**
 * xAI Grok API client (OpenAI-compatible chat completions).
 * Uses native fetch (Node 18+) — no openai package required on Lambda.
 */

'use strict';

const { config } = require('../config');
const { SYSTEM_PROMPT_FREE, SYSTEM_PROMPT_PREMIUM } = require('../constants');
const { truncateSpeech } = require('../utils/speech');

/**
 * Call Grok chat completions.
 * @param {object} opts
 * @param {string} opts.userMessage
 * @param {boolean} opts.isPremium
 * @param {Array<{role:string,content:string}>} [opts.history]
 * @returns {Promise<{ text: string, model: string, tokensIn: number, tokensOut: number, latencyMs: number }>}
 */
async function askGrok({ userMessage, isPremium, history = [] }) {
  if (!config.xaiApiKey) {
    const err = new Error('XAI_API_KEY not configured');
    err.code = 'CONFIG';
    throw err;
  }

  const model = isPremium ? config.premiumModel : config.freeModel;
  const maxTokens = isPremium ? config.premiumMaxTokens : config.freeMaxTokens;
  const system = isPremium ? SYSTEM_PROMPT_PREMIUM : SYSTEM_PROMPT_FREE;

  const messages = [
    { role: 'system', content: system },
    ...history.filter((m) => m.role === 'user' || m.role === 'assistant'),
    { role: 'user', content: userMessage },
  ];

  const body = {
    model,
    messages,
    max_tokens: maxTokens,
    temperature: isPremium ? 0.7 : 0.5,
    // Free tier: slightly more deterministic + shorter
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.requestTimeoutMs);
  const started = Date.now();

  try {
    const res = await fetch(`${config.xaiBaseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.xaiApiKey}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    const latencyMs = Date.now() - started;
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      const err = new Error(
        data.error?.message || data.message || `Grok API HTTP ${res.status}`
      );
      err.code = 'API';
      err.status = res.status;
      err.raw = data;
      throw err;
    }

    const raw =
      data.choices?.[0]?.message?.content ||
      data.choices?.[0]?.text ||
      '';

    const text = truncateSpeech(raw);
    if (!text) {
      const err = new Error('Empty Grok response');
      err.code = 'EMPTY';
      throw err;
    }

    return {
      text,
      model: data.model || model,
      tokensIn: data.usage?.prompt_tokens || 0,
      tokensOut: data.usage?.completion_tokens || 0,
      latencyMs,
    };
  } catch (e) {
    if (e.name === 'AbortError') {
      const err = new Error('Grok API timeout');
      err.code = 'TIMEOUT';
      throw err;
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Build history array for next call (trim to max turns).
 * Each "turn" = one user + one assistant message.
 */
function appendHistory(existing, userMessage, assistantMessage, maxTurns) {
  const next = [
    ...(existing || []),
    { role: 'user', content: userMessage },
    { role: 'assistant', content: assistantMessage },
  ];
  const maxMessages = maxTurns * 2;
  return next.slice(-maxMessages);
}

module.exports = {
  askGrok,
  appendHistory,
};
