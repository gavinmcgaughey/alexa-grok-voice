/**
 * Lightweight analytics / revenue hooks.
 * Logs structured JSON for CloudWatch Insights queries.
 * Swap emit() for Kinesis, Amplitude, etc. in production if needed.
 */

'use strict';

const { config } = require('../config');

/**
 * @param {string} eventName
 * @param {object} payload
 */
function emit(eventName, payload = {}) {
  const record = {
    type: 'analytics',
    event: eventName,
    ts: new Date().toISOString(),
    skill: config.skillName,
    ...payload,
  };
  // Single-line JSON for easy CloudWatch filter/metric filters
  console.log(JSON.stringify(record));
}

function trackQuery({
  userId,
  isPremium,
  model,
  tokensIn = 0,
  tokensOut = 0,
  latencyMs,
  usedBoost = false,
  remainingDaily,
  success,
  errorCode,
}) {
  emit('query', {
    userIdHash: hashId(userId),
    isPremium,
    model,
    tokensIn,
    tokensOut,
    latencyMs,
    usedBoost,
    remainingDaily,
    success: !!success,
    errorCode: errorCode || null,
  });
}

function trackUpsell({ userId, reason, productRef }) {
  emit('upsell_offered', {
    userIdHash: hashId(userId),
    reason,
    productRef,
  });
}

function trackPurchaseResult({ userId, productId, purchaseResult, name }) {
  emit('purchase_result', {
    userIdHash: hashId(userId),
    productId,
    purchaseResult,
    name,
  });
}

function trackSessionStart({ userId, isPremium, remainingDaily, boostBalance }) {
  emit('session_start', {
    userIdHash: hashId(userId),
    isPremium,
    remainingDaily,
    boostBalance,
  });
}

/** Cheap non-cryptographic hash so logs don't store raw Alexa userIds in plain form. */
function hashId(id) {
  if (!id) return 'unknown';
  let h = 0;
  for (let i = 0; i < id.length; i++) {
    h = (Math.imul(31, h) + id.charCodeAt(i)) | 0;
  }
  return `u${(h >>> 0).toString(16)}`;
}

module.exports = {
  emit,
  trackQuery,
  trackUpsell,
  trackPurchaseResult,
  trackSessionStart,
  hashId,
};
