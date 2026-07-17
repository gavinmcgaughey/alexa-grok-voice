/**
 * ISP entitlement helpers: load products, resolve premium / boost status.
 */

'use strict';

const { config } = require('../config');

/**
 * Fetch in-skill products for the current user/locale.
 * @param {import('ask-sdk-core').HandlerInput} handlerInput
 * @returns {Promise<object[]>}
 */
async function getInSkillProducts(handlerInput) {
  const locale = handlerInput.requestEnvelope.request.locale || 'en-US';
  const ms = handlerInput.serviceClientFactory.getMonetizationServiceClient();
  const result = await ms.getInSkillProducts(locale);
  return result.inSkillProducts || [];
}

/**
 * Find product by referenceName (from ISP console / product JSON).
 */
function findProductByReference(products, referenceName) {
  return (products || []).find((p) => p.referenceName === referenceName) || null;
}

/**
 * Find product by spoken name / synonym (slot value).
 */
function findProductBySpokenName(products, spoken) {
  if (!spoken) return null;
  const q = spoken.toLowerCase().trim();
  return (
    (products || []).find((p) => {
      const name = (p.name || '').toLowerCase();
      const ref = (p.referenceName || '').toLowerCase();
      return (
        name === q ||
        name.includes(q) ||
        ref.includes(q.replace(/\s+/g, '_')) ||
        (q.includes('premium') && ref.includes('premium')) ||
        ((q.includes('boost') || q.includes('query')) && ref.includes('boost'))
      );
    }) || null
  );
}

function isEntitled(product) {
  return product && product.entitled === 'ENTITLED';
}

function isPurchasable(product) {
  return product && product.purchasable === 'PURCHASABLE';
}

/**
 * Resolve tier from product list.
 * @returns {{ isPremium: boolean, premiumProduct: object|null, boostProduct: object|null, boostEntitlementCount: number }}
 */
function resolveTier(products) {
  const premiumProduct = findProductByReference(products, config.productRefs.premium);
  const boostProduct = findProductByReference(products, config.productRefs.boost);
  return {
    isPremium: isEntitled(premiumProduct),
    premiumProduct,
    boostProduct,
    boostEntitlementCount: boostProduct ? boostProduct.activeEntitlementCount || 0 : 0,
  };
}

/**
 * Cache products + tier on session attributes for the session.
 */
function cacheProductsOnSession(handlerInput, products) {
  const session = handlerInput.attributesManager.getSessionAttributes();
  session.inSkillProducts = products;
  const tier = resolveTier(products);
  session.isPremium = tier.isPremium;
  session.premiumProductId = tier.premiumProduct ? tier.premiumProduct.productId : null;
  session.boostProductId = tier.boostProduct ? tier.boostProduct.productId : null;
  session.boostEntitlementCount = tier.boostEntitlementCount;
  handlerInput.attributesManager.setSessionAttributes(session);
  return tier;
}

function getCachedProducts(handlerInput) {
  const session = handlerInput.attributesManager.getSessionAttributes();
  return session.inSkillProducts || [];
}

function getSessionTier(handlerInput) {
  const session = handlerInput.attributesManager.getSessionAttributes();
  return {
    isPremium: !!session.isPremium,
    premiumProductId: session.premiumProductId || null,
    boostProductId: session.boostProductId || null,
    boostEntitlementCount: session.boostEntitlementCount || 0,
  };
}

module.exports = {
  getInSkillProducts,
  findProductByReference,
  findProductBySpokenName,
  isEntitled,
  isPurchasable,
  resolveTier,
  cacheProductsOnSession,
  getCachedProducts,
  getSessionTier,
};
