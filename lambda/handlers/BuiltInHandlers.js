/**
 * Help, Stop, Cancel, Fallback, Repeat, SessionEnded, NavigateHome.
 */

'use strict';

const Alexa = require('ask-sdk-core');
const { INTENTS, SPEECH } = require('../constants');
const userStore = require('../services/userStore');
const { speakAndAsk, speakAndEnd } = require('../utils/responseHelpers');

const HelpIntentHandler = {
  canHandle(handlerInput) {
    return (
      Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest' &&
      Alexa.getIntentName(handlerInput.requestEnvelope) === INTENTS.HELP
    );
  },
  handle(handlerInput) {
    const attrs = handlerInput.attributesManager.getRequestAttributes();
    const remaining = userStore.freeRemaining(attrs.user || {});
    const speech = SPEECH.help(!!attrs.isPremium, remaining);
    const session = handlerInput.attributesManager.getSessionAttributes();
    session.lastSpeech = speech;
    handlerInput.attributesManager.setSessionAttributes(session);
    return speakAndAsk(handlerInput, speech);
  },
};

const CancelAndStopIntentHandler = {
  canHandle(handlerInput) {
    return (
      Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest' &&
      (Alexa.getIntentName(handlerInput.requestEnvelope) === INTENTS.CANCEL ||
        Alexa.getIntentName(handlerInput.requestEnvelope) === INTENTS.STOP)
    );
  },
  handle(handlerInput) {
    return speakAndEnd(handlerInput, SPEECH.goodbye);
  },
};

const FallbackIntentHandler = {
  canHandle(handlerInput) {
    return (
      Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest' &&
      Alexa.getIntentName(handlerInput.requestEnvelope) === INTENTS.FALLBACK
    );
  },
  handle(handlerInput) {
    // Nudge user toward AskGrok phrasing rather than burning a paid query on noise
    return speakAndAsk(
      handlerInput,
      "I can answer questions with Grok. Try saying, ask, then your question. For example: ask what is black hole. Or say upgrade for Premium."
    );
  },
};

const RepeatIntentHandler = {
  canHandle(handlerInput) {
    return (
      Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest' &&
      Alexa.getIntentName(handlerInput.requestEnvelope) === INTENTS.REPEAT
    );
  },
  handle(handlerInput) {
    const session = handlerInput.attributesManager.getSessionAttributes();
    const speech = session.lastSpeech || "I don't have anything to repeat yet. What would you like to ask?";
    return speakAndAsk(handlerInput, speech);
  },
};

const SessionEndedRequestHandler = {
  canHandle(handlerInput) {
    return Alexa.getRequestType(handlerInput.requestEnvelope) === 'SessionEndedRequest';
  },
  handle(handlerInput) {
    const reason = handlerInput.requestEnvelope.request.reason;
    console.log(JSON.stringify({ type: 'session_ended', reason }));
    return handlerInput.responseBuilder.getResponse();
  },
};

const NavigateHomeIntentHandler = {
  canHandle(handlerInput) {
    return (
      Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest' &&
      Alexa.getIntentName(handlerInput.requestEnvelope) === INTENTS.NAVIGATE_HOME
    );
  },
  handle(handlerInput) {
    return speakAndEnd(handlerInput, SPEECH.goodbye);
  },
};

module.exports = {
  HelpIntentHandler,
  CancelAndStopIntentHandler,
  FallbackIntentHandler,
  RepeatIntentHandler,
  SessionEndedRequestHandler,
  NavigateHomeIntentHandler,
};
