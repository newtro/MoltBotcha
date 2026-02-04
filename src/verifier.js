/**
 * BOTCHA Verifier
 * Verify challenge responses and issue tokens
 */

const jwt = require('jsonwebtoken');
const { getStore } = require('./store');

const DEFAULT_SECRET = 'botcha-secret-change-in-production';
const DEFAULT_TOKEN_EXPIRY = 3600; // 1 hour

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
    
    // Check timing
    if (now > deadline) {
      return {
        verified: false,
        error: 'timeout',
        details: {
          elapsed_ms: elapsedMs,
          deadline_ms: challenge.ttl_ms,
          message: 'Response received after deadline'
        }
      };
    }
    
    // Verify answers
    const correctAnswers = challenge.answers;
    let correctCount = 0;
    
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
    
    const accuracy = correctCount / correctAnswers.length;
    
    // Require 100% accuracy for standard/hard, 90% for easy
    const requiredAccuracy = challenge.difficulty === 'easy' ? 0.9 : 1.0;
    
    if (accuracy < requiredAccuracy) {
      return {
        verified: false,
        error: 'incorrect',
        details: {
          correct_count: correctCount,
          total_count: correctAnswers.length,
          accuracy: accuracy,
          required_accuracy: requiredAccuracy,
          elapsed_ms: elapsedMs
        }
      };
    }
    
    // Success! Generate token
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
