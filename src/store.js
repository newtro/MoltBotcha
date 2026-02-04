/**
 * BOTCHA Challenge Store
 * In-memory storage for challenges (can be replaced with Redis)
 */

class ChallengeStore {
  constructor(options = {}) {
    this.challenges = new Map();
    this.cleanupInterval = options.cleanupInterval || 60000; // 1 minute
    
    // Periodic cleanup of expired challenges
    this._cleanup = setInterval(() => this.cleanup(), this.cleanupInterval);
  }
  
  /**
   * Store a challenge
   */
  set(challengeId, challenge) {
    this.challenges.set(challengeId, {
      ...challenge,
      storedAt: Date.now()
    });
  }
  
  /**
   * Get a challenge (and optionally delete it)
   */
  get(challengeId, consume = false) {
    const challenge = this.challenges.get(challengeId);
    if (consume && challenge) {
      this.challenges.delete(challengeId);
    }
    return challenge || null;
  }
  
  /**
   * Delete a challenge
   */
  delete(challengeId) {
    return this.challenges.delete(challengeId);
  }
  
  /**
   * Check if challenge exists and is not expired
   */
  isValid(challengeId) {
    const challenge = this.challenges.get(challengeId);
    if (!challenge) return false;
    
    const deadline = new Date(challenge.deadline).getTime();
    return Date.now() <= deadline;
  }
  
  /**
   * Clean up expired challenges
   */
  cleanup() {
    const now = Date.now();
    for (const [id, challenge] of this.challenges) {
      const deadline = new Date(challenge.deadline).getTime();
      // Keep for 10 seconds after deadline for late response handling
      if (now > deadline + 10000) {
        this.challenges.delete(id);
      }
    }
  }
  
  /**
   * Get store statistics
   */
  stats() {
    return {
      total: this.challenges.size,
      active: Array.from(this.challenges.values()).filter(c => 
        Date.now() <= new Date(c.deadline).getTime()
      ).length
    };
  }
  
  /**
   * Stop cleanup interval
   */
  close() {
    if (this._cleanup) {
      clearInterval(this._cleanup);
    }
  }
}

// Singleton instance
let defaultStore = null;

function getStore(options) {
  if (!defaultStore) {
    defaultStore = new ChallengeStore(options);
  }
  return defaultStore;
}

module.exports = {
  ChallengeStore,
  getStore
};
