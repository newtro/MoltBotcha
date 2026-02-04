/**
 * BOTCHA Express Middleware
 * Protect routes with bot verification
 */

const { createChallenge } = require('./challenges');
const { Verifier } = require('./verifier');
const { getStore } = require('./store');

/**
 * Create BOTCHA middleware
 */
function botchaMiddleware(options = {}) {
  const {
    difficulty = 'standard',
    challengeType = 'math_speed',
    tokenHeader = 'X-Botcha-Token',
    required = true,
    secret,
    store
  } = options;
  
  const verifier = new Verifier({ secret, store });
  const challengeStore = store || getStore();
  
  return async (req, res, next) => {
    // Check for existing valid token
    const token = req.headers[tokenHeader.toLowerCase()] || 
                  req.headers['authorization']?.replace('Bearer ', '');
    
    if (token) {
      const validation = verifier.validateToken(token);
      if (validation.valid) {
        req.botcha = {
          verified: true,
          agent_id: validation.agent_id,
          botcha: validation.botcha
        };
        return next();
      }
    }
    
    // No valid token - require verification if required=true
    if (!required) {
      req.botcha = { verified: false };
      return next();
    }
    
    // Issue challenge
    const challenge = createChallenge({
      type: challengeType,
      difficulty
    });
    
    // Store challenge
    challengeStore.set(challenge.challenge_id, challenge);
    
    // Remove answers from response
    const { answers, ...publicChallenge } = challenge;
    
    return res.status(401).json({
      error: 'botcha_required',
      message: 'Bot verification required. Solve the challenge and retry with token.',
      challenge: publicChallenge
    });
  };
}

/**
 * Create verification endpoint handler
 */
function verifyHandler(options = {}) {
  const { secret, store } = options;
  const verifier = new Verifier({ secret, store });
  
  return (req, res) => {
    const { challenge_id, answers } = req.body;
    
    if (!challenge_id || !answers) {
      return res.status(400).json({
        error: 'invalid_request',
        message: 'Missing challenge_id or answers'
      });
    }
    
    const result = verifier.verify(challenge_id, answers, {
      clientId: req.ip || req.headers['x-forwarded-for']
    });
    
    if (result.verified) {
      return res.json(result);
    } else {
      const statusCode = result.error === 'timeout' ? 408 : 
                         result.error === 'invalid_challenge' ? 410 : 401;
      return res.status(statusCode).json(result);
    }
  };
}

/**
 * Create challenge endpoint handler
 */
function challengeHandler(options = {}) {
  const {
    difficulty = 'standard',
    challengeType = 'math_speed',
    store
  } = options;
  
  const challengeStore = store || getStore();
  
  return (req, res) => {
    const reqDifficulty = req.body?.difficulty || difficulty;
    const reqType = req.body?.type || challengeType;
    
    const challenge = createChallenge({
      type: reqType,
      difficulty: reqDifficulty
    });
    
    // Store challenge
    challengeStore.set(challenge.challenge_id, challenge);
    
    // Remove answers from response
    const { answers, ...publicChallenge } = challenge;
    
    res.json(publicChallenge);
  };
}

/**
 * Create status endpoint handler
 */
function statusHandler(options = {}) {
  const { secret, tokenHeader = 'X-Botcha-Token' } = options;
  const verifier = new Verifier({ secret });
  
  return (req, res) => {
    const token = req.headers[tokenHeader.toLowerCase()] || 
                  req.headers['authorization']?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({
        valid: false,
        error: 'no_token',
        message: 'No token provided'
      });
    }
    
    const validation = verifier.validateToken(token);
    
    if (validation.valid) {
      return res.json(validation);
    } else {
      return res.status(401).json(validation);
    }
  };
}

/**
 * Create refresh endpoint handler
 */
function refreshHandler(options = {}) {
  const { secret, tokenHeader = 'X-Botcha-Token' } = options;
  const verifier = new Verifier({ secret });
  
  return (req, res) => {
    const token = req.headers[tokenHeader.toLowerCase()] || 
                  req.headers['authorization']?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'no_token'
      });
    }
    
    const result = verifier.refreshToken(token);
    
    if (result.success) {
      return res.json(result);
    } else {
      return res.status(401).json(result);
    }
  };
}

/**
 * Create Express router with all BOTCHA endpoints
 */
function createRouter(options = {}) {
  const express = require('express');
  const router = express.Router();
  
  router.post('/challenge', challengeHandler(options));
  router.post('/verify', verifyHandler(options));
  router.get('/status', statusHandler(options));
  router.post('/refresh', refreshHandler(options));
  
  return router;
}

module.exports = {
  botchaMiddleware,
  verifyHandler,
  challengeHandler,
  statusHandler,
  refreshHandler,
  createRouter
};
