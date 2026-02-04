/**
 * BOTCHA - Bot Verification Challenge
 * Prove you're a bot, not a human. The inverse of CAPTCHA.
 * 
 * @example
 * const botcha = require('moltbotcha');
 * 
 * // Use as middleware
 * app.use('/api', botcha.middleware({ difficulty: 'standard' }));
 * 
 * // Or use the router
 * app.use('/botcha', botcha.createRouter());
 * 
 * // Or create challenges manually
 * const challenge = botcha.createChallenge({ type: 'math_speed' });
 * const result = botcha.verify(challenge.challenge_id, answers);
 */

const { createChallenge, DIFFICULTY } = require('./challenges');
const { Verifier } = require('./verifier');
const { ChallengeStore, getStore } = require('./store');
const { 
  botchaMiddleware,
  createRouter,
  verifyHandler,
  challengeHandler,
  statusHandler,
  refreshHandler
} = require('./middleware');

// Create a default verifier instance
let defaultVerifier = null;

function getVerifier(options) {
  if (!defaultVerifier) {
    defaultVerifier = new Verifier(options);
  }
  return defaultVerifier;
}

/**
 * Quick verification helper
 */
function verify(challengeId, answers, options = {}) {
  return getVerifier(options).verify(challengeId, answers, options);
}

/**
 * Quick token validation helper
 */
function validateToken(token, options = {}) {
  return getVerifier(options).validateToken(token);
}

module.exports = {
  // Challenge creation
  createChallenge,
  DIFFICULTY,
  
  // Verification
  Verifier,
  verify,
  validateToken,
  
  // Storage
  ChallengeStore,
  getStore,
  
  // Express integration
  middleware: botchaMiddleware,
  createRouter,
  verifyHandler,
  challengeHandler,
  statusHandler,
  refreshHandler
};
