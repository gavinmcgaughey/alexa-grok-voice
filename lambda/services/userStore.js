/**
 * Per-user persistence in DynamoDB.
 * Stores freemium counters, boost inventory, premium conversation history, usage stats.
 *
 * Table schema (on-demand):
 *   PK: userId (String)
 * Attributes: see defaultUserRecord()
 */

'use strict';

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  UpdateCommand,
} = require('@aws-sdk/lib-dynamodb');
const { config } = require('../config');

let docClient;

function getClient() {
  if (!docClient) {
    const client = new DynamoDBClient({ region: config.awsRegion });
    docClient = DynamoDBDocumentClient.from(client, {
      marshallOptions: { removeUndefinedValues: true },
    });
  }
  return docClient;
}

function todayUtc() {
  return new Date().toISOString().slice(0, 10);
}

function defaultUserRecord(userId) {
  const now = new Date().toISOString();
  return {
    userId,
    dailyQueryCount: 0,
    dailyQueryDate: todayUtc(),
    boostBalance: 0,
    /** Last known Amazon activeEntitlementCount for boost product (for sync). */
    boostPurchaseCount: 0,
    conversationHistory: [],
    totalQueries: 0,
    totalTokensIn: 0,
    totalTokensOut: 0,
    upsellShownCount: 0,
    createdAt: now,
    lastActiveAt: now,
  };
}

/**
 * Load user, create if missing, reset daily counters if date rolled over.
 * @param {string} userId
 */
async function getOrCreateUser(userId) {
  const client = getClient();
  const res = await client.send(
    new GetCommand({
      TableName: config.dynamoTableName,
      Key: { userId },
    })
  );

  let user = res.Item;
  if (!user) {
    const created = defaultUserRecord(userId);
    try {
      await client.send(
        new PutCommand({
          TableName: config.dynamoTableName,
          Item: created,
          ConditionExpression: 'attribute_not_exists(userId)',
        })
      );
      user = created;
    } catch (err) {
      // Race: another request created it — re-read
      if (err.name !== 'ConditionalCheckFailedException') throw err;
      const again = await client.send(
        new GetCommand({ TableName: config.dynamoTableName, Key: { userId } })
      );
      user = again.Item || created;
    }
  }

  // Daily reset (UTC midnight)
  if (user.dailyQueryDate !== todayUtc()) {
    user.dailyQueryCount = 0;
    user.dailyQueryDate = todayUtc();
    await client.send(
      new UpdateCommand({
        TableName: config.dynamoTableName,
        Key: { userId },
        UpdateExpression:
          'SET dailyQueryCount = :z, dailyQueryDate = :d, lastActiveAt = :now',
        ExpressionAttributeValues: {
          ':z': 0,
          ':d': todayUtc(),
          ':now': new Date().toISOString(),
        },
      })
    );
  }

  return user;
}

/**
 * Free remaining = daily limit - used, not including boosts.
 */
function freeRemaining(user) {
  return Math.max(0, config.freeDailyQueryLimit - (user.dailyQueryCount || 0));
}

/**
 * Whether the user can make a query (premium, free remaining, or boost).
 */
function canQuery(user, isPremium) {
  if (isPremium) return { allowed: true, useBoost: false };
  if (freeRemaining(user) > 0) return { allowed: true, useBoost: false };
  if ((user.boostBalance || 0) > 0) return { allowed: true, useBoost: true };
  return { allowed: false, useBoost: false };
}

/**
 * Consume one query unit: free daily first, then boost.
 * Also updates history and token stats.
 */
async function recordQuery(userId, {
  isPremium,
  useBoost,
  history,
  tokensIn = 0,
  tokensOut = 0,
}) {
  const client = getClient();
  const now = new Date().toISOString();

  let updateExpression =
    'SET lastActiveAt = :now, totalQueries = if_not_exists(totalQueries, :z) + :one, ' +
    'totalTokensIn = if_not_exists(totalTokensIn, :z) + :tin, ' +
    'totalTokensOut = if_not_exists(totalTokensOut, :z) + :tout, ' +
    'conversationHistory = :hist';
  const values = {
    ':now': now,
    ':z': 0,
    ':one': 1,
    ':tin': tokensIn,
    ':tout': tokensOut,
    ':hist': history || [],
  };

  if (!isPremium) {
    if (useBoost) {
      updateExpression +=
        ', boostBalance = if_not_exists(boostBalance, :z) - :one';
      // Guard against going negative at condition level
      values[':zero'] = 0;
      await client.send(
        new UpdateCommand({
          TableName: config.dynamoTableName,
          Key: { userId },
          UpdateExpression: updateExpression,
          ConditionExpression: 'boostBalance > :zero',
          ExpressionAttributeValues: values,
        })
      );
    } else {
      updateExpression +=
        ', dailyQueryCount = if_not_exists(dailyQueryCount, :z) + :one, dailyQueryDate = :day';
      values[':day'] = todayUtc();
      await client.send(
        new UpdateCommand({
          TableName: config.dynamoTableName,
          Key: { userId },
          UpdateExpression: updateExpression,
          ExpressionAttributeValues: values,
        })
      );
    }
  } else {
    await client.send(
      new UpdateCommand({
        TableName: config.dynamoTableName,
        Key: { userId },
        UpdateExpression: updateExpression,
        ExpressionAttributeValues: values,
      })
    );
  }
}

/**
 * Sync boost inventory from Amazon activeEntitlementCount.
 * Amazon tracks purchase count; we track remaining uses.
 * When purchase count increases, credit boostPackQueries per new purchase.
 *
 * @param {string} userId
 * @param {number} activeEntitlementCount
 * @param {object} user - current user record
 */
async function syncBoostPurchases(userId, activeEntitlementCount, user) {
  const previous = user.boostPurchaseCount || 0;
  const current = activeEntitlementCount || 0;
  if (current <= previous) {
    // Still update stored count if Amazon refunded (current < previous)
    if (current < previous) {
      await getClient().send(
        new UpdateCommand({
          TableName: config.dynamoTableName,
          Key: { userId },
          UpdateExpression: 'SET boostPurchaseCount = :c, lastActiveAt = :now',
          ExpressionAttributeValues: {
            ':c': current,
            ':now': new Date().toISOString(),
          },
        })
      );
      user.boostPurchaseCount = current;
    }
    return user;
  }

  const newPurchases = current - previous;
  const credit = newPurchases * config.boostPackQueries;

  const res = await getClient().send(
    new UpdateCommand({
      TableName: config.dynamoTableName,
      Key: { userId },
      UpdateExpression:
        'SET boostPurchaseCount = :c, ' +
        'boostBalance = if_not_exists(boostBalance, :z) + :credit, ' +
        'lastActiveAt = :now',
      ExpressionAttributeValues: {
        ':c': current,
        ':z': 0,
        ':credit': credit,
        ':now': new Date().toISOString(),
      },
      ReturnValues: 'ALL_NEW',
    })
  );

  return res.Attributes || { ...user, boostPurchaseCount: current, boostBalance: (user.boostBalance || 0) + credit };
}

/**
 * Credit boost immediately after ACCEPTED purchase (before next session interceptor).
 */
async function creditBoostPurchase(userId, packs = 1) {
  const res = await getClient().send(
    new UpdateCommand({
      TableName: config.dynamoTableName,
      Key: { userId },
      UpdateExpression:
        'SET boostBalance = if_not_exists(boostBalance, :z) + :credit, ' +
        'boostPurchaseCount = if_not_exists(boostPurchaseCount, :z) + :packs, ' +
        'lastActiveAt = :now',
      ExpressionAttributeValues: {
        ':z': 0,
        ':credit': packs * config.boostPackQueries,
        ':packs': packs,
        ':now': new Date().toISOString(),
      },
      ReturnValues: 'ALL_NEW',
    })
  );
  return res.Attributes;
}

async function incrementUpsellCount(userId) {
  await getClient().send(
    new UpdateCommand({
      TableName: config.dynamoTableName,
      Key: { userId },
      UpdateExpression:
        'SET upsellShownCount = if_not_exists(upsellShownCount, :z) + :one, lastActiveAt = :now',
      ExpressionAttributeValues: {
        ':z': 0,
        ':one': 1,
        ':now': new Date().toISOString(),
      },
    })
  );
}

/**
 * Clear conversation history (e.g. privacy / free tier).
 */
async function clearHistory(userId) {
  await getClient().send(
    new UpdateCommand({
      TableName: config.dynamoTableName,
      Key: { userId },
      UpdateExpression: 'SET conversationHistory = :empty, lastActiveAt = :now',
      ExpressionAttributeValues: {
        ':empty': [],
        ':now': new Date().toISOString(),
      },
    })
  );
}

module.exports = {
  getOrCreateUser,
  freeRemaining,
  canQuery,
  recordQuery,
  syncBoostPurchases,
  creditBoostPurchase,
  incrementUpsellCount,
  clearHistory,
  todayUtc,
  defaultUserRecord,
};
