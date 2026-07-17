/**
 * Request/response logging for CloudWatch.
 */

'use strict';

const { config } = require('../config');
const { hashId } = require('../services/analytics');

const LoggingRequestInterceptor = {
  process(handlerInput) {
    if (!config.enableDetailedLogs) return;
    const req = handlerInput.requestEnvelope.request;
    const userId = handlerInput.requestEnvelope.session?.user?.userId
      || handlerInput.requestEnvelope.context?.System?.user?.userId;
    console.log(
      JSON.stringify({
        type: 'request',
        requestType: req.type,
        intent: req.intent?.name || null,
        locale: req.locale,
        userIdHash: hashId(userId),
        sessionNew: handlerInput.requestEnvelope.session?.new,
      })
    );
  },
};

const LoggingResponseInterceptor = {
  process(handlerInput, response) {
    if (!config.enableDetailedLogs) return;
    console.log(
      JSON.stringify({
        type: 'response',
        hasDirective: !!(response && response.directives && response.directives.length),
        shouldEndSession: response ? response.shouldEndSession : null,
      })
    );
  },
};

module.exports = {
  LoggingRequestInterceptor,
  LoggingResponseInterceptor,
};
