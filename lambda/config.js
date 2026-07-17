/**
 * Runtime configuration for Grok Voice.
 * Prefer environment variables; defaults are safe for local/dev testing.
 * Never hardcode XAI_API_KEY.
 */

'use strict';

const config = {
  skillName: process.env.SKILL_NAME || 'Grok Voice',

  // xAI / Grok
  xaiApiKey: process.env.XAI_API_KEY || '',
  xaiBaseUrl: process.env.XAI_BASE_URL || 'https://api.x.ai/v1',
  // Free: cheaper / faster model. Premium: flagship.
  // Override via env if xAI renames models.
  freeModel: process.env.GROK_FREE_MODEL || 'grok-4.3',
  premiumModel: process.env.GROK_PREMIUM_MODEL || 'grok-4.5',
  freeMaxTokens: parseInt(process.env.FREE_MAX_TOKENS || '280', 10),
  premiumMaxTokens: parseInt(process.env.PREMIUM_MAX_TOKENS || '500', 10),
  requestTimeoutMs: parseInt(process.env.XAI_TIMEOUT_MS || '7000', 10),

  // Freemium limits
  freeDailyQueryLimit: parseInt(process.env.FREE_DAILY_LIMIT || '15', 10),
  boostPackQueries: parseInt(process.env.BOOST_PACK_QUERIES || '25', 10),
  // Soft upsell: offer premium after this many free queries in a day (before hard limit)
  softUpsellAfter: parseInt(process.env.SOFT_UPSELL_AFTER || '5', 10),
  // Chance (0–1) of soft upsell after softUpsellAfter when not at limit
  softUpsellProbability: parseFloat(process.env.SOFT_UPSELL_PROBABILITY || '0.35'),

  // Conversation history (premium only, persisted)
  maxHistoryTurns: parseInt(process.env.MAX_HISTORY_TURNS || '8', 10),
  // Session-only history for free (not persisted across sessions)
  maxSessionHistoryTurns: parseInt(process.env.MAX_SESSION_HISTORY_TURNS || '4', 10),

  // DynamoDB
  dynamoTableName: process.env.DYNAMODB_TABLE_NAME || 'GrokVoiceUsers',
  awsRegion: process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'us-east-1',

  // ISP product reference names (must match skill-package/isps/*.json)
  productRefs: {
    premium: process.env.ISP_PREMIUM_REF || 'grok_premium_subscription',
    boost: process.env.ISP_BOOST_REF || 'query_boost_pack',
  },

  // Analytics
  enableDetailedLogs: process.env.ENABLE_DETAILED_LOGS !== 'false',

  // Speech safety
  maxSpeechChars: parseInt(process.env.MAX_SPEECH_CHARS || '700', 10),
};

/**
 * Validate critical config at cold start. Throws if production-breaking misconfig.
 */
function assertConfig() {
  if (!config.xaiApiKey) {
    console.warn(
      '[config] XAI_API_KEY is not set. Grok API calls will fail until configured.'
    );
  }
  if (!config.dynamoTableName) {
    throw new Error('DYNAMODB_TABLE_NAME is required');
  }
}

module.exports = { config, assertConfig };
