/**
 * Load DynamoDB user + ISP products on every request before handlers run.
 * Syncs consumable boost inventory with Amazon entitlement counts.
 */

'use strict';

const userStore = require('../services/userStore');
const entitlementService = require('../services/entitlementService');
const { hashId } = require('../services/analytics');

const LoadUserInterceptor = {
  async process(handlerInput) {
    const userId =
      handlerInput.requestEnvelope.session?.user?.userId ||
      handlerInput.requestEnvelope.context?.System?.user?.userId;

    if (!userId) {
      console.warn('[LoadUserInterceptor] No userId on request');
      return;
    }

    // Load / create user profile
    let user;
    try {
      user = await userStore.getOrCreateUser(userId);
    } catch (err) {
      console.error('[LoadUserInterceptor] DynamoDB error', err);
      // Allow request to continue with ephemeral defaults (fail-open for free tier)
      user = userStore.defaultUserRecord(userId);
      handlerInput.attributesManager.setRequestAttributes({
        ...handlerInput.attributesManager.getRequestAttributes(),
        dynamoDegraded: true,
      });
    }

    // Load ISP products when API is available (not on all request types in edge cases)
    let products = [];
    let tier = { isPremium: false, boostEntitlementCount: 0 };
    try {
      if (handlerInput.serviceClientFactory) {
        products = await entitlementService.getInSkillProducts(handlerInput);
        tier = entitlementService.cacheProductsOnSession(handlerInput, products);

        // Sync boost consumables
        if (tier.boostEntitlementCount > 0 || user.boostPurchaseCount > 0) {
          user = await userStore.syncBoostPurchases(
            userId,
            tier.boostEntitlementCount,
            user
          );
        }
      }
    } catch (err) {
      console.error('[LoadUserInterceptor] Monetization API error', err);
      // Fall back to session cache if any
      tier = entitlementService.getSessionTier(handlerInput);
    }

    // Free tier: do not use persisted history across sessions
    if (!tier.isPremium && handlerInput.requestEnvelope.session?.new) {
      user.conversationHistory = [];
    }

    const requestAttributes = handlerInput.attributesManager.getRequestAttributes();
    requestAttributes.userId = userId;
    requestAttributes.userIdHash = hashId(userId);
    requestAttributes.user = user;
    requestAttributes.isPremium = tier.isPremium;
    requestAttributes.products = products;
    handlerInput.attributesManager.setRequestAttributes(requestAttributes);
  },
};

module.exports = { LoadUserInterceptor };
