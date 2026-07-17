/**
 * Common response builders for speak/reprompt and ISP directives.
 */

'use strict';

const { SPEECH } = require('../constants');

/**
 * Speak + keep session open with reprompt.
 */
function speakAndAsk(handlerInput, speech, reprompt = SPEECH.reprompt) {
  return handlerInput.responseBuilder
    .speak(speech)
    .reprompt(reprompt)
    .getResponse();
}

/**
 * Speak and end session.
 */
function speakAndEnd(handlerInput, speech) {
  return handlerInput.responseBuilder.speak(speech).withShouldEndSession(true).getResponse();
}

/**
 * Start Alexa ISP Buy flow. Session ends; skill relaunches after purchase.
 * @param {import('ask-sdk-core').HandlerInput} handlerInput
 * @param {string} productId - Amazon product id (amzn1.adg.product...)
 * @param {string} [token]
 */
function sendBuyDirective(handlerInput, productId, token = 'buy') {
  return handlerInput.responseBuilder
    .addDirective({
      type: 'Connections.SendRequest',
      name: 'Buy',
      payload: {
        InSkillProduct: { productId },
      },
      token,
    })
    .getResponse();
}

/**
 * Start Alexa ISP Upsell flow with custom message ending in a yes/no question.
 */
function sendUpsellDirective(handlerInput, productId, upsellMessage, token = 'upsell') {
  return handlerInput.responseBuilder
    .addDirective({
      type: 'Connections.SendRequest',
      name: 'Upsell',
      payload: {
        InSkillProduct: { productId },
        upsellMessage,
      },
      token,
    })
    .getResponse();
}

/**
 * Start cancel/refund flow for a product.
 */
function sendCancelDirective(handlerInput, productId, token = 'cancel') {
  return handlerInput.responseBuilder
    .addDirective({
      type: 'Connections.SendRequest',
      name: 'Cancel',
      payload: {
        InSkillProduct: { productId },
      },
      token,
    })
    .getResponse();
}

module.exports = {
  speakAndAsk,
  speakAndEnd,
  sendBuyDirective,
  sendUpsellDirective,
  sendCancelDirective,
};
