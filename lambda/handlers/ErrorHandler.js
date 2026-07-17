/**
 * Global error handler — never crash the skill silently.
 */

'use strict';

const { SPEECH } = require('../constants');

const ErrorHandler = {
  canHandle() {
    return true;
  },
  handle(handlerInput, error) {
    console.error(
      JSON.stringify({
        type: 'error',
        message: error?.message,
        stack: error?.stack,
        name: error?.name,
      })
    );
    return handlerInput.responseBuilder
      .speak(SPEECH.genericError)
      .reprompt(SPEECH.reprompt)
      .getResponse();
  },
};

module.exports = { ErrorHandler };
