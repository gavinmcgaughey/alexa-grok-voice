/**
 * Core Q&A: rate limit → Grok API → speak answer → optional soft upsell.
 */

'use strict';

const Alexa = require('ask-sdk-core');
const { config } = require('../config');
const { INTENTS, SPEECH } = require('../constants');
const userStore = require('../services/userStore');
const { askGrok, appendHistory } = require('../services/grokClient');
const analytics = require('../services/analytics');
const {
  speakAndAsk,
  sendUpsellDirective,
} = require('../utils/responseHelpers');

function getQuestion(handlerInput) {
  const intent = handlerInput.requestEnvelope.request.intent;
  const slot = intent?.slots?.question;
  // AMAZON.SearchQuery and free-form capture
  if (slot?.value) return slot.value.trim();

  // Fallback: some utterances put the whole phrase in the request
  return null;
}

const AskGrokIntentHandler = {
  canHandle(handlerInput) {
    return (
      Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest' &&
      Alexa.getIntentName(handlerInput.requestEnvelope) === INTENTS.ASK_GROK
    );
  },
  async handle(handlerInput) {
    const attrs = handlerInput.attributesManager.getRequestAttributes();
    const userId = attrs.userId;
    let user = attrs.user || {};
    const isPremium = !!attrs.isPremium;
    const question = getQuestion(handlerInput);

    if (!question) {
      return speakAndAsk(handlerInput, SPEECH.didNotCatch);
    }

    // --- Entitlement / rate limit ---
    const access = userStore.canQuery(user, isPremium);
    if (!access.allowed) {
      const products = attrs.products || [];
      const premium = products.find(
        (p) => p.referenceName === config.productRefs.premium
      );
      analytics.trackUpsell({
        userId,
        reason: 'daily_limit',
        productRef: config.productRefs.premium,
      });
      await userStore.incrementUpsellCount(userId).catch(() => {});

      if (premium && premium.purchasable === 'PURCHASABLE') {
        return sendUpsellDirective(
          handlerInput,
          premium.productId,
          SPEECH.upsellLimit,
          'upsell_limit'
        );
      }
      return speakAndAsk(handlerInput, SPEECH.limitReached);
    }

    // --- History: premium = Dynamo; free = session-only ---
    const session = handlerInput.attributesManager.getSessionAttributes();
    let history;
    if (isPremium) {
      history = user.conversationHistory || [];
    } else {
      history = session.sessionHistory || [];
    }

    // --- Call Grok ---
    let result;
    try {
      result = await askGrok({
        userMessage: question,
        isPremium,
        history,
      });
    } catch (err) {
      console.error('[AskGrok] API error', err.code || err.message, err);
      analytics.trackQuery({
        userId,
        isPremium,
        model: isPremium ? config.premiumModel : config.freeModel,
        success: false,
        errorCode: err.code || 'UNKNOWN',
        usedBoost: access.useBoost,
        remainingDaily: userStore.freeRemaining(user),
      });
      return speakAndAsk(handlerInput, SPEECH.apiError);
    }

    // --- Update history ---
    const maxTurns = isPremium
      ? config.maxHistoryTurns
      : config.maxSessionHistoryTurns;
    const nextHistory = appendHistory(
      history,
      question,
      result.text,
      maxTurns
    );

    if (isPremium) {
      // Persist for premium
    } else {
      session.sessionHistory = nextHistory;
      // Free: never persist long-term history
      nextHistory.length = Math.min(nextHistory.length, maxTurns * 2);
    }

    // --- Consume quota + persist ---
    try {
      await userStore.recordQuery(userId, {
        isPremium,
        useBoost: access.useBoost,
        history: isPremium ? nextHistory : [],
        tokensIn: result.tokensIn,
        tokensOut: result.tokensOut,
      });
      // Refresh local counters for speech
      if (!isPremium) {
        if (access.useBoost) {
          user.boostBalance = Math.max(0, (user.boostBalance || 0) - 1);
        } else {
          user.dailyQueryCount = (user.dailyQueryCount || 0) + 1;
        }
      }
    } catch (err) {
      console.error('[AskGrok] recordQuery failed', err);
      // Still answer the user; inventory may be slightly off
    }

    analytics.trackQuery({
      userId,
      isPremium,
      model: result.model,
      tokensIn: result.tokensIn,
      tokensOut: result.tokensOut,
      latencyMs: result.latencyMs,
      usedBoost: access.useBoost,
      remainingDaily: userStore.freeRemaining(user),
      success: true,
    });

    let speech = result.text;
    const remaining = userStore.freeRemaining(user);

    // Soft upsell: free users mid-day, probabilistic, not every turn
    let shouldSoftUpsell = false;
    if (
      !isPremium &&
      remaining > 0 &&
      (user.dailyQueryCount || 0) >= config.softUpsellAfter &&
      Math.random() < config.softUpsellProbability
    ) {
      shouldSoftUpsell = true;
    }

    // Low remaining warning (non-blocking)
    if (!isPremium && remaining === 1 && !shouldSoftUpsell) {
      speech = `${speech} You have one free question left today.`;
    } else if (!isPremium && remaining === 0 && (user.boostBalance || 0) === 0 && !shouldSoftUpsell) {
      speech = `${speech} That was your last free question for today. Say upgrade for Premium anytime.`;
    }

    session.lastSpeech = speech;
    handlerInput.attributesManager.setSessionAttributes(session);
    attrs.user = user;

    if (shouldSoftUpsell) {
      const premium = (attrs.products || []).find(
        (p) => p.referenceName === config.productRefs.premium
      );
      if (premium && premium.purchasable === 'PURCHASABLE') {
        analytics.trackUpsell({
          userId,
          reason: 'soft',
          productRef: config.productRefs.premium,
        });
        // Answer first via Upsell message? Better: speak answer then upsell.
        // ISP Upsell replaces session — so include a short teaser after answer in upsellMessage.
        // Spec: upsellMessage is what Alexa says when entering purchase flow.
        // Pattern: speak answer in skill, then on next interaction upsell — OR
        // append soft CTA in speech without ending for buy flow this turn (less aggressive).
        // Revenue-friendly but non-intrusive: speak answer + soft verbal CTA, keep session.
        speech = `${speech} ${SPEECH.softUpsell}`;
        session.lastSpeech = speech;
        handlerInput.attributesManager.setSessionAttributes(session);
        await userStore.incrementUpsellCount(userId).catch(() => {});
        return speakAndAsk(
          handlerInput,
          speech,
          'You can say yes to Premium, or ask another question.'
        );
      }
    }

    return speakAndAsk(handlerInput, speech);
  },
};

/**
 * Also route free-form Fallback / unhandled to Grok when possible —
 * implemented in BuiltInHandlers via optional re-use.
 */
module.exports = { AskGrokIntentHandler, getQuestion };
