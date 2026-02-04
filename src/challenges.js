/**
 * BOTCHA Challenge Generators
 * Tasks that are easy for AI but hard/tedious for humans
 */

const { v4: uuidv4 } = require('uuid');

// Difficulty presets
const DIFFICULTY = {
  easy: { count: 10, timeLimit: 2000 },
  standard: { count: 50, timeLimit: 1000 },
  hard: { count: 100, timeLimit: 1500 }
};

/**
 * Generate a math_speed challenge
 * Solve N arithmetic problems quickly
 */
function generateMathSpeed(difficulty = 'standard') {
  const config = DIFFICULTY[difficulty] || DIFFICULTY.standard;
  const equations = [];
  const answers = [];
  
  for (let i = 0; i < config.count; i++) {
    const type = Math.floor(Math.random() * 4);
    let equation, answer;
    
    switch (type) {
      case 0: // Addition
        const a1 = Math.floor(Math.random() * 9000) + 1000;
        const b1 = Math.floor(Math.random() * 9000) + 1000;
        equation = `${a1} + ${b1}`;
        answer = a1 + b1;
        break;
      case 1: // Subtraction
        const a2 = Math.floor(Math.random() * 9000) + 5000;
        const b2 = Math.floor(Math.random() * 4000) + 1000;
        equation = `${a2} - ${b2}`;
        answer = a2 - b2;
        break;
      case 2: // Multiplication
        const a3 = Math.floor(Math.random() * 900) + 100;
        const b3 = Math.floor(Math.random() * 90) + 10;
        equation = `${a3} * ${b3}`;
        answer = a3 * b3;
        break;
      case 3: // Division (ensure clean division)
        const b4 = Math.floor(Math.random() * 90) + 10;
        const answer4 = Math.floor(Math.random() * 900) + 100;
        const a4 = b4 * answer4;
        equation = `${a4} / ${b4}`;
        answer = answer4;
        break;
    }
    
    equations.push(equation);
    answers.push(answer);
  }
  
  return {
    type: 'math_speed',
    difficulty,
    payload: { equations },
    answers, // Store for verification
    timeLimit: config.timeLimit
  };
}

/**
 * Generate a json_extract challenge
 * Extract values from nested JSON structure
 */
function generateJsonExtract(difficulty = 'standard') {
  const config = DIFFICULTY[difficulty] || DIFFICULTY.standard;
  const queryCount = Math.floor(config.count / 5); // Fewer but harder
  
  // Generate a complex nested structure
  const document = {
    users: Array.from({ length: 10 }, (_, i) => ({
      id: i + 1,
      name: `User${i + 1}`,
      email: `user${i + 1}@example.com`,
      active: Math.random() > 0.3,
      scores: Array.from({ length: 5 }, () => Math.floor(Math.random() * 100)),
      metadata: {
        created: new Date(Date.now() - Math.random() * 1e10).toISOString(),
        tags: ['tag' + Math.floor(Math.random() * 10), 'tag' + Math.floor(Math.random() * 10)]
      }
    })),
    config: {
      version: '2.1.0',
      features: {
        beta: true,
        experimental: { enabled: false, flags: ['a', 'b', 'c'] }
      }
    },
    stats: {
      total: 10,
      active: 7,
      averageScore: 72.5
    }
  };
  
  // Generate queries and compute answers
  const queries = [];
  const answers = [];
  
  for (let i = 0; i < queryCount; i++) {
    const userIndex = Math.floor(Math.random() * 10);
    const scoreIndex = Math.floor(Math.random() * 5);
    
    const queryTypes = [
      { query: `users[${userIndex}].name`, answer: document.users[userIndex].name },
      { query: `users[${userIndex}].scores[${scoreIndex}]`, answer: document.users[userIndex].scores[scoreIndex] },
      { query: `users[${userIndex}].metadata.tags[0]`, answer: document.users[userIndex].metadata.tags[0] },
      { query: `config.version`, answer: document.config.version },
      { query: `stats.total`, answer: document.stats.total },
      { query: `config.features.experimental.flags[1]`, answer: document.config.features.experimental.flags[1] }
    ];
    
    const selected = queryTypes[Math.floor(Math.random() * queryTypes.length)];
    queries.push(selected.query);
    answers.push(selected.answer);
  }
  
  return {
    type: 'json_extract',
    difficulty,
    payload: { document, queries },
    answers,
    timeLimit: config.timeLimit * 2 // More time for parsing
  };
}

/**
 * Generate a pattern_match challenge
 * Complete number/letter sequences
 */
function generatePatternMatch(difficulty = 'standard') {
  const config = DIFFICULTY[difficulty] || DIFFICULTY.standard;
  const sequenceCount = Math.floor(config.count / 5);
  
  const sequences = [];
  const answers = [];
  
  const patterns = [
    // Arithmetic sequences
    () => {
      const start = Math.floor(Math.random() * 10) + 1;
      const step = Math.floor(Math.random() * 5) + 1;
      const seq = Array.from({ length: 5 }, (_, i) => start + i * step);
      return { sequence: [...seq.slice(0, 4), '?'], answer: seq[4] };
    },
    // Geometric sequences
    () => {
      const start = Math.floor(Math.random() * 5) + 1;
      const ratio = Math.floor(Math.random() * 3) + 2;
      const seq = Array.from({ length: 5 }, (_, i) => start * Math.pow(ratio, i));
      return { sequence: [...seq.slice(0, 4), '?'], answer: seq[4] };
    },
    // Fibonacci-like
    () => {
      const a = Math.floor(Math.random() * 5) + 1;
      const b = Math.floor(Math.random() * 5) + 1;
      const seq = [a, b];
      for (let i = 2; i < 6; i++) seq.push(seq[i - 1] + seq[i - 2]);
      return { sequence: [...seq.slice(0, 5), '?'], answer: seq[5] };
    },
    // Squares
    () => {
      const start = Math.floor(Math.random() * 5) + 1;
      const seq = Array.from({ length: 5 }, (_, i) => Math.pow(start + i, 2));
      return { sequence: [...seq.slice(0, 4), '?'], answer: seq[4] };
    }
  ];
  
  for (let i = 0; i < sequenceCount; i++) {
    const generator = patterns[Math.floor(Math.random() * patterns.length)];
    const { sequence, answer } = generator();
    sequences.push(sequence);
    answers.push(answer);
  }
  
  return {
    type: 'pattern_match',
    difficulty,
    payload: { sequences },
    answers,
    timeLimit: config.timeLimit * 1.5
  };
}

/**
 * Create a new challenge
 */
function createChallenge(options = {}) {
  const {
    type = 'math_speed',
    difficulty = 'standard'
  } = options;
  
  let challenge;
  
  switch (type) {
    case 'json_extract':
      challenge = generateJsonExtract(difficulty);
      break;
    case 'pattern_match':
      challenge = generatePatternMatch(difficulty);
      break;
    case 'math_speed':
    default:
      challenge = generateMathSpeed(difficulty);
      break;
  }
  
  const now = Date.now();
  
  return {
    challenge_id: uuidv4(),
    ...challenge,
    issued_at: new Date(now).toISOString(),
    deadline: new Date(now + challenge.timeLimit).toISOString(),
    ttl_ms: challenge.timeLimit
  };
}

module.exports = {
  createChallenge,
  generateMathSpeed,
  generateJsonExtract,
  generatePatternMatch,
  DIFFICULTY
};
