/**
 * Speech helpers: sanitize model output for Alexa TTS and length limits.
 */

'use strict';

const { config } = require('../config');

/**
 * Strip markdown / symbols that sound bad on Alexa TTS.
 * @param {string} text
 * @returns {string}
 */
function sanitizeForSpeech(text) {
  if (!text || typeof text !== 'string') {
    return '';
  }
  let out = text
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/#{1,6}\s*/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/https?:\/\/\S+/gi, ' ')
    .replace(/[_#|>]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // Soft sentence end if truncated mid-word later
  return out;
}

/**
 * Truncate for Alexa speech limits while preferring sentence boundaries.
 * @param {string} text
 * @param {number} [maxChars]
 * @returns {string}
 */
function truncateSpeech(text, maxChars = config.maxSpeechChars) {
  const clean = sanitizeForSpeech(text);
  if (clean.length <= maxChars) {
    return clean;
  }
  const slice = clean.slice(0, maxChars);
  const lastStop = Math.max(
    slice.lastIndexOf('. '),
    slice.lastIndexOf('? '),
    slice.lastIndexOf('! ')
  );
  if (lastStop > maxChars * 0.5) {
    return slice.slice(0, lastStop + 1).trim();
  }
  return `${slice.trim()}…`;
}

/**
 * Escape characters unsafe inside SSML text nodes.
 * @param {string} text
 * @returns {string}
 */
function escapeSsml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

module.exports = {
  sanitizeForSpeech,
  truncateSpeech,
  escapeSsml,
};
