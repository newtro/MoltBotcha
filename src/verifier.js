/**
 * BOTCHA Verifier
 * Verify challenge responses and issue tokens
 */

const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { getStore } = require('./store');

const DEFAULT_SECRET = 'botcha-secret-change-in-production';
const DEFAULT_TOKEN_EXPIRY = 3600; // 1 hour
const GRACE_PERIOD_MS = 200; // 200ms grace for network jitter
const MAX_RETRIES = 2;

class Verifier {
  constructor(options = {}) {
    this.secret = options.secret || process.env.BOTCHA_SECRET || DEFAULT_SECRET;
    this.tokenExpiry = options.tokenExpiry || DEFAULT_TOKEN_EXPIRY;
    this.store = options.store || getStore();
  }
  
  /**
   * Verify a challenge response
   */
  verify(challengeId, answers, options = {}) {
    const now = Date.now();
    const { gracePeriod = GRACE_PERIOD_MS, sessionData = {} } = options;
    
    // Get challenge from store (consume it - single use)
    const challenge = this.store.get(challengeId, true);
    
    if (!challenge) {
      return {
        verified: false,
        error: 'invalid_challenge',
        details: { message: 'Challenge not found or already used' }
      };
    }
    
    const deadline = new Date(challenge.deadline).getTime();
    const issuedAt = new Date(challenge.issued_at).getTime();
    const elapsedMs = now - issuedAt;
    
    // Check timing (with grace period for network jitter)
    if (now > deadline + gracePeriod) {
      return {
        verified: false,
        error: 'timeout',
        details: {
          elapsed_ms: elapsedMs,
          deadline_ms: challenge.ttl_ms,
          grace_ms: gracePeriod,
          message: 'Response received after deadline (including grace period)'
        },
        retry_allowed: true
      };
    }
    
    // Handle different challenge types
    let correctCount = 0;
    let totalCount = 0;
    
    if (challenge.type === 'session_proof') {
      // Verify session proof
      return this.verifySessionProof(challenge, answers, sessionData, elapsedMs, options);
    }
    
    if (challenge.type === 'composite') {
      // Verify composite challenge
      return this.verifyComposite(challenge, answers, elapsedMs, options);
    }
    
    // Standard answer verification
    const correctAnswers = challenge.answers;
    
    if (!Array.isArray(answers) || answers.length !== correctAnswers.length) {
      return {
        verified: false,
        error: 'incorrect',
        details: {
          expected_count: correctAnswers.length,
          received_count: Array.isArray(answers) ? answers.length : 0,
          message: 'Answer count mismatch'
        }
      };
    }
    
    for (let i = 0; i < correctAnswers.length; i++) {
      // Flexible comparison (handle strings vs numbers)
      if (String(answers[i]) === String(correctAnswers[i])) {
        correctCount++;
      }
    }
    
    totalCount = correctAnswers.length;
    const accuracy = correctCount / totalCount;
    
    // Require 100% accuracy for standard/hard, 90% for easy
    const requiredAccuracy = challenge.difficulty === 'easy' ? 0.9 : 1.0;
    
    if (accuracy < requiredAccuracy) {
      return {
        verified: false,
        error: 'incorrect',
        details: {
          correct_count: correctCount,
          total_count: totalCount,
          accuracy: accuracy,
          required_accuracy: requiredAccuracy,
          elapsed_ms: elapsedMs
        }
      };
    }
    
    // Success!
    return this.generateSuccessResult(challenge, elapsedMs, accuracy, options);
  }
  
  /**
   * Validate an existing token
   */
  validateToken(token) {
    try {
      const decoded = jwt.verify(token, this.secret);
      return {
        valid: true,
        expires_at: new Date(decoded.exp * 1000).toISOString(),
        remaining_ms: (decoded.exp * 1000) - Date.now(),
        agent_id: decoded.sub,
        botcha: decoded.botcha
      };
    } catch (err) {
      return {
        valid: false,
        error: err.name === 'TokenExpiredError' ? 'token_expired' : 'token_invalid',
        message: err.message
      };
    }
  }
  
  /**
   * Refresh a token (if still valid)
   */
  refreshToken(token) {
    const validation = this.validateToken(token);
    
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }
    
    const now = Date.now();
    const newPayload = {
      iss: 'botcha',
      sub: validation.agent_id,
      iat: Math.floor(now / 1000),
      exp: Math.floor(now / 1000) + this.tokenExpiry,
      botcha: validation.botcha
    };
    
    const newToken = jwt.sign(newPayload, this.secret);
    
    return {
      success: true,
      token: newToken,
      expires_at: new Date(now + this.tokenExpiry * 1000).toISOString()
    };
  }
  
  /**
   * Verify session proof challenge
   * Agent must prove they have session context that can't be pre-computed
   */
  verifySessionProof(challenge, answers, sessionData, elapsedMs, options = {}) {
    const { hash, agent_id, session_start, last_action_timestamp } = answers;
    
    if (!hash || !agent_id || !session_start || !last_action_timestamp) {
      return {
        verified: false,
        error: 'incomplete_proof',
        details: { message: 'Missing required session proof fields' }
      };
    }
    
    // Verify the hash format (should be 64 char hex for SHA256)
    if (!/^[a-f0-9]{64}$/i.test(hash)) {
      return {
        verified: false,
        error: 'invalid_hash',
        details: { message: 'Hash must be SHA256 hex string' }
      };
    }
    
    // Verify the hash is computed correctly
    const nonce = challenge.nonce;
    const expectedInput = `${nonce}${agent_id}${session_start}${last_action_timestamp}`;
    const expectedHash = crypto.createHash('sha256').update(expectedInput).digest('hex');
    
    // Constant-time comparison to prevent timing attacks
    const hashMatch = crypto.timingSafeEqual(
      Buffer.from(hash.toLowerCase()),
      Buffer.from(expectedHash.toLowerCase())
    );
    
    if (!hashMatch) {
      return {
        verified: false,
        error: 'hash_mismatch',
        details: { message: 'Session proof hash does not match' }
      };
    }
    
    // Verify timing makes sense
    const lastAction = parseInt(last_action_timestamp);
    const sessionStart = parseInt(session_start);
    const now = Date.now();
    
    // Session should have started before now
    if (sessionStart > now || lastAction > now) {
      return {
        verified: false,
        error: 'invalid_timestamps',
        details: { message: 'Timestamps are in the future' }
      };
    }
    
    // Last action should be recent (within 5 minutes)
    if (now - lastAction > 300000) {
      return {
        verified: false,
        error: 'stale_session',
        details: { message: 'Last action timestamp is too old' }
      };
    }
    
    // Success!
    return this.generateSuccessResult(challenge, elapsedMs, 1.0, options);
  }
  
  /**
   * Verify composite challenge (multiple challenge types)
   */
  verifyComposite(challenge, answers, elapsedMs, options = {}) {
    if (!answers.math || !answers.patterns) {
      return {
        verified: false,
        error: 'incomplete_composite',
        details: { message: 'Missing math or patterns answers' }
      };
    }
    
    const correctMath = challenge.answers.math;
    const correctPatterns = challenge.answers.patterns;
    
    let mathCorrect = 0;
    let patternCorrect = 0;
    
    // Verify math answers
    if (Array.isArray(answers.math)) {
      for (let i = 0; i < Math.min(answers.math.length, correctMath.length); i++) {
        if (String(answers.math[i]) === String(correctMath[i])) {
          mathCorrect++;
        }
      }
    }
    
    // Verify pattern answers
    if (Array.isArray(answers.patterns)) {
      for (let i = 0; i < Math.min(answers.patterns.length, correctPatterns.length); i++) {
        if (String(answers.patterns[i]) === String(correctPatterns[i])) {
          patternCorrect++;
        }
      }
    }
    
    const totalCorrect = mathCorrect + patternCorrect;
    const totalCount = correctMath.length + correctPatterns.length;
    const accuracy = totalCorrect / totalCount;
    
    // Require 95% accuracy for composite
    if (accuracy < 0.95) {
      return {
        verified: false,
        error: 'incorrect',
        details: {
          math_correct: mathCorrect,
          math_total: correctMath.length,
          pattern_correct: patternCorrect,
          pattern_total: correctPatterns.length,
          accuracy,
          elapsed_ms: elapsedMs
        }
      };
    }
    
    return this.generateSuccessResult(challenge, elapsedMs, accuracy, options);
  }
  
  /**
   * Generate success result with token
   */
  generateSuccessResult(challenge, elapsedMs, accuracy, options = {}) {
    const now = Date.now();
    
    const tokenPayload = {
      iss: 'botcha',
      sub: options.clientId || 'anonymous',
      iat: Math.floor(now / 1000),
      exp: Math.floor(now / 1000) + this.tokenExpiry,
      botcha: {
        verified_at: new Date(now).toISOString(),
        difficulty: challenge.difficulty,
        challenge_type: challenge.type,
        solve_time_ms: elapsedMs,
        accuracy: accuracy
      }
    };
    
    const token = jwt.sign(tokenPayload, this.secret);
    
    return {
      verified: true,
      token,
      token_type: 'Bearer',
      expires_at: new Date(now + this.tokenExpiry * 1000).toISOString(),
      expires_in: this.tokenExpiry,
      agent_score: {
        solve_time_ms: elapsedMs,
        accuracy: accuracy,
        confidence: this.calculateConfidence(elapsedMs, challenge.ttl_ms, accuracy)
      }
    };
  }
  
  /**
   * Calculate confidence score based on timing and accuracy
   * Higher confidence = more likely to be a real AI agent
   */
  calculateConfidence(solveTimeMs, deadlineMs, accuracy) {
    // Perfect accuracy is expected
    let confidence = accuracy;
    
    // Fast responses increase confidence
    const timeRatio = solveTimeMs / deadlineMs;
    if (timeRatio < 0.1) {
      confidence *= 1.0; // Very fast - definitely AI
    } else if (timeRatio < 0.3) {
      confidence *= 0.98;
    } else if (timeRatio < 0.5) {
      confidence *= 0.95;
    } else if (timeRatio < 0.8) {
      confidence *= 0.90;
    } else {
      confidence *= 0.85; // Cutting it close
    }
    
    return Math.round(confidence * 100) / 100;
  }
}

module.exports = { Verifier };
