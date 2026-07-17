/**
 * In-Skill Purchasing: shop, buy, refund, buy response, inventory.
 */

'use strict';

const Alexa = require('ask-sdk-core');
const { config } = require('../config');
const { INTENTS, SPEECH } = require('../constants');
const entitlementService = require('../services/entitlementService');
const userStore = require('../services/userStore');
const analytics = require('../services/analytics');
const {
  speakAndAsk,
  sendBuyDirective,
  sendCancelDirective,
  sendUpsellDirective,
} = require('../utils/responseHelpers');

function getProductNameSlot(handlerInput) {
  const slot = handlerInput.requestEnvelope.request.intent?.slots?.ProductName;
  return slot?.value || null;
}

/** Yes after soft upsell speech → start premium buy */
const YesIntentHandler = {
  canHandle(handlerInput) {
    return (
      Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest' &&
      Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.YesIntent'
    );
  },
  handle(handlerInput) {
    const attrs = handlerInput.attributesManager.getRequestAttributes();
    if (attrs.isPremium) {
      return speakAndAsk(handlerInput, SPEECH.alreadyPremium);
    }
    const premium = (attrs.products || []).find(
      (p) => p.referenceName === config.productRefs.premium
    );
    if (premium && premium.purchasable === 'PURCHASABLE') {
      analytics.trackUpsell({
        userId: attrs.userId,
        reason: 'yes_after_soft',
        productRef: config.productRefs.premium,
      });
      // Upsell = Amazon-handled "learn more" + price (best practice after soft CTA)
      return sendUpsellDirective(
        handlerInput,
        premium.productId,
        'Premium unlocks unlimited Grok, a smarter model, and conversation memory. Want to learn more about Premium?',
        'upsell_yes'
      );
    }
    return speakAndAsk(handlerInput, SPEECH.whatCanIBuy);
  },
};

const NoIntentHandler = {
  canHandle(handlerInput) {
    return (
      Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest' &&
      Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.NoIntent'
    );
  },
  handle(handlerInput) {
    return speakAndAsk(handlerInput, SPEECH.declinedPurchase);
  },
};

const WhatCanIBuyIntentHandler = {
  canHandle(handlerInput) {
    return (
      Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest' &&
      Alexa.getIntentName(handlerInput.requestEnvelope) === INTENTS.WHAT_CAN_I_BUY
    );
  },
  handle(handlerInput) {
    const attrs = handlerInput.attributesManager.getRequestAttributes();
    if (attrs.isPremium) {
      const boost = (attrs.products || []).find(
        (p) => p.referenceName === config.productRefs.boost
      );
      // Premium users rarely need boost, but still list options
      return speakAndAsk(
        handlerInput,
        attrs.isPremium
          ? 'You already have Premium with unlimited queries. Query Boost packs are optional extras for free-tier friends. What would you like to ask Grok?'
          : SPEECH.whatCanIBuy
      );
    }
    return speakAndAsk(handlerInput, SPEECH.whatCanIBuy);
  },
};

const BuyIntentHandler = {
  canHandle(handlerInput) {
    return (
      Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest' &&
      Alexa.getIntentName(handlerInput.requestEnvelope) === INTENTS.BUY
    );
  },
  handle(handlerInput) {
    const attrs = handlerInput.attributesManager.getRequestAttributes();
    const products = attrs.products || [];
    const spoken = getProductNameSlot(handlerInput);

    if (!spoken) {
      return speakAndAsk(
        handlerInput,
        'You can buy Premium, or a Query Boost pack. Which would you like?'
      );
    }

    const product = entitlementService.findProductBySpokenName(products, spoken);
    if (!product) {
      return speakAndAsk(handlerInput, SPEECH.whatCanIBuy);
    }

    if (product.referenceName === config.productRefs.premium && attrs.isPremium) {
      return speakAndAsk(handlerInput, SPEECH.alreadyPremium);
    }

    if (product.purchasable !== 'PURCHASABLE' && product.entitled === 'ENTITLED') {
      return speakAndAsk(
        handlerInput,
        `You already have ${product.name}. What would you like to ask Grok?`
      );
    }

    if (product.purchasable !== 'PURCHASABLE') {
      return speakAndAsk(
        handlerInput,
        `Sorry, ${product.name} is not available right now. What else can I help with?`
      );
    }

    analytics.trackUpsell({
      userId: attrs.userId,
      reason: 'buy_intent',
      productRef: product.referenceName,
    });

    return sendBuyDirective(handlerInput, product.productId, `buy_${product.referenceName}`);
  },
};

const RefundSkillItemIntentHandler = {
  canHandle(handlerInput) {
    return (
      Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest' &&
      Alexa.getIntentName(handlerInput.requestEnvelope) === INTENTS.REFUND
    );
  },
  handle(handlerInput) {
    const attrs = handlerInput.attributesManager.getRequestAttributes();
    const products = attrs.products || [];
    const spoken = getProductNameSlot(handlerInput);

    let product = spoken
      ? entitlementService.findProductBySpokenName(products, spoken)
      : products.find((p) => p.entitled === 'ENTITLED');

    // Prefer cancelling premium subscription if entitled and no product named
    if (!spoken) {
      product =
        products.find(
          (p) =>
            p.referenceName === config.productRefs.premium && p.entitled === 'ENTITLED'
        ) || product;
    }

    if (!product || product.entitled !== 'ENTITLED') {
      return speakAndAsk(
        handlerInput,
        "I don't see an active purchase to cancel. You can say what can I buy to hear options."
      );
    }

    return sendCancelDirective(
      handlerInput,
      product.productId,
      `cancel_${product.referenceName}`
    );
  },
};

const InventoryIntentHandler = {
  canHandle(handlerInput) {
    return (
      Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest' &&
      Alexa.getIntentName(handlerInput.requestEnvelope) === INTENTS.INVENTORY
    );
  },
  handle(handlerInput) {
    const attrs = handlerInput.attributesManager.getRequestAttributes();
    const user = attrs.user || {};
    const remaining = userStore.freeRemaining(user);
    const speech = SPEECH.inventory(
      !!attrs.isPremium,
      remaining,
      user.boostBalance || 0
    );
    return speakAndAsk(handlerInput, speech);
  },
};

const StatusIntentHandler = {
  canHandle(handlerInput) {
    return (
      Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest' &&
      Alexa.getIntentName(handlerInput.requestEnvelope) === INTENTS.STATUS
    );
  },
  handle(handlerInput) {
    const attrs = handlerInput.attributesManager.getRequestAttributes();
    const user = attrs.user || {};
    const model = attrs.isPremium ? config.premiumModel : config.freeModel;
    const speech = SPEECH.status(
      !!attrs.isPremium,
      userStore.freeRemaining(user),
      user.boostBalance || 0,
      model
    );
    return speakAndAsk(handlerInput, speech);
  },
};

/**
 * Connections.Response after Buy / Upsell / Cancel.
 */
const BuyResponseHandler = {
  canHandle(handlerInput) {
    return (
      Alexa.getRequestType(handlerInput.requestEnvelope) === 'Connections.Response' &&
      (handlerInput.requestEnvelope.request.name === 'Buy' ||
        handlerInput.requestEnvelope.request.name === 'Upsell')
    );
  },
  async handle(handlerInput) {
    const req = handlerInput.requestEnvelope.request;
    const payload = req.payload || {};
    const purchaseResult = payload.purchaseResult;
    const productId = payload.productId;
    const attrs = handlerInput.attributesManager.getRequestAttributes();
    const products = attrs.products || [];

    analytics.trackPurchaseResult({
      userId: attrs.userId,
      productId,
      purchaseResult,
      name: req.name,
    });

    // Refresh products after purchase
    try {
      const fresh = await entitlementService.getInSkillProducts(handlerInput);
      entitlementService.cacheProductsOnSession(handlerInput, fresh);
      attrs.products = fresh;
      attrs.isPremium = entitlementService.resolveTier(fresh).isPremium;
    } catch (e) {
      console.error('[BuyResponse] refresh products failed', e);
    }

    const product =
      (attrs.products || products).find((p) => p.productId === productId) || null;
    const isBoost =
      product && product.referenceName === config.productRefs.boost;
    const isPremiumProduct =
      product && product.referenceName === config.productRefs.premium;

    switch (purchaseResult) {
      case 'ACCEPTED':
      case 'ALREADY_PURCHASED': {
        if (isBoost || (product && product.type === 'CONSUMABLE')) {
          try {
            const updated = await userStore.creditBoostPurchase(attrs.userId, 1);
            const total = updated?.boostBalance ?? (attrs.user?.boostBalance || 0) + config.boostPackQueries;
            return speakAndAsk(
              handlerInput,
              SPEECH.afterPurchaseBoost(config.boostPackQueries, total)
            );
          } catch (e) {
            console.error('[BuyResponse] credit boost failed', e);
            return speakAndAsk(
              handlerInput,
              `Thanks for your purchase. Your boost queries will be available shortly. What would you like to ask?`
            );
          }
        }
        // Premium subscription
        attrs.isPremium = true;
        return speakAndAsk(handlerInput, SPEECH.afterPurchasePremium);
      }
      case 'DECLINED':
        return speakAndAsk(handlerInput, SPEECH.declinedPurchase);
      case 'PENDING_PURCHASE':
        // Don't mention pending; continue free experience
        return speakAndAsk(
          handlerInput,
          'Okay. What would you like to ask Grok?'
        );
      case 'ERROR':
      default:
        return speakAndAsk(
          handlerInput,
          'Okay. You can keep using Grok Voice. What would you like to ask?'
        );
    }
  },
};

const CancelProductResponseHandler = {
  canHandle(handlerInput) {
    return (
      Alexa.getRequestType(handlerInput.requestEnvelope) === 'Connections.Response' &&
      handlerInput.requestEnvelope.request.name === 'Cancel'
    );
  },
  async handle(handlerInput) {
    const payload = handlerInput.requestEnvelope.request.payload || {};
    const attrs = handlerInput.attributesManager.getRequestAttributes();

    analytics.trackPurchaseResult({
      userId: attrs.userId,
      productId: payload.productId,
      purchaseResult: payload.purchaseResult,
      name: 'Cancel',
    });

    try {
      const fresh = await entitlementService.getInSkillProducts(handlerInput);
      entitlementService.cacheProductsOnSession(handlerInput, fresh);
      attrs.isPremium = entitlementService.resolveTier(fresh).isPremium;
    } catch (e) {
      /* ignore */
    }

    if (payload.purchaseResult === 'ACCEPTED') {
      // Subscription cancelled — clear premium history optionally
      if (!attrs.isPremium) {
        await userStore.clearHistory(attrs.userId).catch(() => {});
      }
      return speakAndAsk(
        handlerInput,
        'Your subscription change is complete. You can still use the free tier. What would you like to ask?'
      );
    }

    return speakAndAsk(
      handlerInput,
      'Okay. What would you like to ask Grok?'
    );
  },
};

/** Explicit upgrade intent */
const UpgradeIntentHandler = {
  canHandle(handlerInput) {
    return (
      Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest' &&
      Alexa.getIntentName(handlerInput.requestEnvelope) === 'UpgradeIntent'
    );
  },
  handle(handlerInput) {
    const attrs = handlerInput.attributesManager.getRequestAttributes();
    if (attrs.isPremium) {
      return speakAndAsk(handlerInput, SPEECH.alreadyPremium);
    }
    const premium = (attrs.products || []).find(
      (p) => p.referenceName === config.productRefs.premium
    );
    if (!premium) {
      return speakAndAsk(handlerInput, SPEECH.whatCanIBuy);
    }
    if (premium.purchasable !== 'PURCHASABLE') {
      return speakAndAsk(handlerInput, SPEECH.alreadyPremium);
    }
    analytics.trackUpsell({
      userId: attrs.userId,
      reason: 'upgrade_intent',
      productRef: config.productRefs.premium,
    });
    return sendUpsellDirective(
      handlerInput,
      premium.productId,
      'Premium unlocks unlimited Grok questions, a smarter model, and conversation memory. Want to learn more about Premium?',
      'upsell_upgrade'
    );
  },
};

module.exports = {
  YesIntentHandler,
  NoIntentHandler,
  WhatCanIBuyIntentHandler,
  BuyIntentHandler,
  RefundSkillItemIntentHandler,
  InventoryIntentHandler,
  StatusIntentHandler,
  BuyResponseHandler,
  CancelProductResponseHandler,
  UpgradeIntentHandler,
};
