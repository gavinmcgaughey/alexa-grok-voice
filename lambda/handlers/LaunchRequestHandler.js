/**
 * LaunchRequest — welcome by tier, remaining quota, analytics.
 */

'use strict';

const Alexa = require('ask-sdk-core');
const userStore = require('../services/userStore');
const analytics = require('../services/analytics');
const { SPEECH } = require('../constants');
const { speakAndAsk } = require('../utils/responseHelpers');

const LaunchRequestHandler = {
  canHandle(handlerInput) {
    return Alexa.getRequestType(handlerInput.requestEnvelope) === 'LaunchRequest';
  },
  handle(handlerInput) {
    const attrs = handlerInput.attributesManager.getRequestAttributes();
    const user = attrs.user || {};
    const isPremium = !!attrs.isPremium;
    const remaining = userStore.freeRemaining(user);
    const boost = user.boostBalance || 0;

    analytics.trackSessionStart({
      userId: attrs.userId,
      isPremium,
      remainingDaily: remaining,
      boostBalance: boost,
    });

    let speech;
    if (isPremium) {
      speech = SPEECH.welcomePremium;
    } else if (boost > 0) {
      speech = SPEECH.welcomeWithBoost(remaining, boost);
    } else {
      speech = SPEECH.welcomeFree(remaining);
    }

    // Store last speech for AMAZON.RepeatIntent
    const session = handlerInput.attributesManager.getSessionAttributes();
    session.lastSpeech = speech;
    handlerInput.attributesManager.setSessionAttributes(session);

    return speakAndAsk(handlerInput, speech);
  },
};

module.exports = { LaunchRequestHandler };
