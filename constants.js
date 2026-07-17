/**
 * Shared constants: intents, product names, system prompts, speech templates.
 */

'use strict';

const INTENTS = {
  ASK_GROK: 'AskGrokIntent',
  WHAT_CAN_I_BUY: 'WhatCanIBuyIntent',
  BUY: 'BuyIntent',
  REFUND: 'RefundSkillItemIntent',
  INVENTORY: 'InventoryIntent',
  STATUS: 'StatusIntent',
  REPEAT: 'AMAZON.RepeatIntent',
  HELP: 'AMAZON.HelpIntent',
  CANCEL: 'AMAZON.CancelIntent',
  STOP: 'AMAZON.StopIntent',
  FALLBACK: 'AMAZON.FallbackIntent',
  NAVIGATE_HOME: 'AMAZON.NavigateHomeIntent',
};

/** Speakable product names for LIST_OF_PRODUCT_NAMES slot type */
const PRODUCT_SPEECH = {
  premium: {
    value: 'premium',
    synonyms: [
      'grok premium',
      'premium subscription',
      'subscription',
      'unlimited',
      'upgrade',
      'pro',
    ],
  },
  boost: {
    value: 'query boost',
    synonyms: [
      'boost',
      'boost pack',
      'query pack',
      'extra queries',
      'more questions',
      'query boost pack',
    ],
  },
};

const SYSTEM_PROMPT_BASE = `You are Grok, built by xAI, answering through Alexa as "Grok Voice".
Be helpful, witty, and maximally truthful. Prefer clear, spoken language.
Rules for voice:
- Keep answers concise (about 2–4 short sentences unless the user asks for depth).
- No markdown, bullet lists, code fences, or URLs unless essential.
- No emoji.
- If unsure, say so briefly.
- Do not claim you control smart home devices or replace Alexa system features.`;

const SYSTEM_PROMPT_FREE = `${SYSTEM_PROMPT_BASE}
The user is on the free tier: prioritize brevity and high signal.`;

const SYSTEM_PROMPT_PREMIUM = `${SYSTEM_PROMPT_BASE}
The user is a Premium subscriber: you may be a bit more thorough while remaining spoken-friendly.
Use conversation history for continuity when provided.`;

const SPEECH = {
  welcomeFree: (remaining) =>
    `Welcome to Grok Voice. You have ${remaining} free ${remaining === 1 ? 'question' : 'questions'} left today. What would you like to know?`,
  welcomePremium:
    'Welcome back to Grok Voice Premium. Unlimited Grok, ready when you are. What would you like to know?',
  welcomeWithBoost: (remaining, boost) =>
    `Welcome to Grok Voice. You have ${remaining} free questions and ${boost} boost ${boost === 1 ? 'query' : 'queries'} left. What would you like to know?`,
  reprompt: 'What would you like to ask Grok?',
  help: (isPremium, remaining) =>
    isPremium
      ? 'I am Grok Voice. Ask me anything. Say what can I buy to hear about add-ons, or say stop to leave. What is your question?'
      : `I am Grok Voice. Ask me anything. Free users get a daily limit — you have ${remaining} left today. Say upgrade to Premium for unlimited questions, or buy a query boost for extra asks. What would you like to know?`,
  goodbye: 'Goodbye from Grok Voice. Come back anytime.',
  didNotCatch: "I didn't catch a question. Try saying something like, what is quantum computing?",
  limitReached:
    "You've used all your free questions for today. You can upgrade to Premium for unlimited Grok, or buy a Query Boost pack for extra questions. Say upgrade, or buy query boost.",
  apiError:
    "Sorry, I couldn't reach Grok just now. Please try again in a moment.",
  genericError: 'Something went wrong. Please try again.',
  whatCanIBuy:
    'You can get Premium for unlimited questions and smarter Grok with memory, or a Query Boost pack for extra free-tier questions. Say buy premium, or buy query boost.',
  alreadyPremium:
    'You already have Grok Voice Premium. Unlimited questions and memory are yours. What would you like to ask?',
  inventory: (isPremium, remaining, boost) =>
    isPremium
      ? 'You have Premium: unlimited queries and conversation memory.'
      : `Free tier: ${remaining} daily questions left, and ${boost} boost ${boost === 1 ? 'query' : 'queries'} remaining.`,
  status: (isPremium, remaining, boost, model) =>
    isPremium
      ? `Premium active. Using ${model}. Ask me anything.`
      : `Free tier. Using ${model}. ${remaining} free and ${boost} boost queries left today.`,
  afterPurchasePremium:
    'Thanks for going Premium. Enjoy unlimited Grok with memory. What would you like to know?',
  afterPurchaseBoost: (added, total) =>
    `Nice. I added ${added} boost queries. You now have ${total} boost queries ready. What would you like to ask?`,
  declinedPurchase: 'No problem. You can keep using free questions. What would you like to ask?',
  upsellLimit:
    "You're out of free questions for today. Premium unlocks unlimited Grok with better models and memory. Want to learn more about Premium?",
  softUpsell:
    "By the way, Premium gives you unlimited questions and smarter Grok with memory. Want to hear about Premium?",
};

module.exports = {
  INTENTS,
  PRODUCT_SPEECH,
  SYSTEM_PROMPT_FREE,
  SYSTEM_PROMPT_PREMIUM,
  SPEECH,
};
