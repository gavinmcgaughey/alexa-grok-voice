/**
 * Grok Voice — Alexa custom skill entrypoint (AWS Lambda).
 *
 * Flow:
 *   Request → LoadUserInterceptor (DynamoDB + ISP) → Intent handler
 *          → Grok API / ISP directives → Response
 */

'use strict';

const Alexa = require('ask-sdk-core');
const { config, assertConfig } = require('./config');

const { LaunchRequestHandler } = require('./handlers/LaunchRequestHandler');
const { AskGrokIntentHandler } = require('./handlers/AskGrokIntentHandler');
const {
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
} = require('./handlers/IspHandlers');
const {
  HelpIntentHandler,
  CancelAndStopIntentHandler,
  FallbackIntentHandler,
  RepeatIntentHandler,
  SessionEndedRequestHandler,
  NavigateHomeIntentHandler,
} = require('./handlers/BuiltInHandlers');
const { ErrorHandler } = require('./handlers/ErrorHandler');
const { LoadUserInterceptor } = require('./interceptors/LoadUserInterceptor');
const {
  LoggingRequestInterceptor,
  LoggingResponseInterceptor,
} = require('./interceptors/LoggingInterceptor');

assertConfig();

const skillBuilder = Alexa.SkillBuilders.custom()
  .addRequestHandlers(
    LaunchRequestHandler,
    AskGrokIntentHandler,
    UpgradeIntentHandler,
    WhatCanIBuyIntentHandler,
    BuyIntentHandler,
    RefundSkillItemIntentHandler,
    InventoryIntentHandler,
    StatusIntentHandler,
    YesIntentHandler,
    NoIntentHandler,
    BuyResponseHandler,
    CancelProductResponseHandler,
    HelpIntentHandler,
    RepeatIntentHandler,
    CancelAndStopIntentHandler,
    FallbackIntentHandler,
    NavigateHomeIntentHandler,
    SessionEndedRequestHandler
  )
  .addRequestInterceptors(LoggingRequestInterceptor, LoadUserInterceptor)
  .addResponseInterceptors(LoggingResponseInterceptor)
  .addErrorHandlers(ErrorHandler)
  .withApiClient(new Alexa.DefaultApiClient());

exports.handler = skillBuilder.lambda();

// For local unit tests / non-Lambda invoke
exports.skill = skillBuilder.create();
