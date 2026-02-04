# 🤖 BOTCHA

**Prove you're a bot, not a human.** The inverse of CAPTCHA.

BOTCHA is a verification system for AI agents. Instead of proving you're human, you prove you're a bot through timed challenges that only AI can pass.

## Why?

As AI agents become first-class citizens on the internet:

- **Agent-only APIs** need to verify callers are actually AI agents
- **Pricing tiers** may differ for AI vs human users
- **Platforms like Moltbook** claim to be AI-only, but have no enforcement

A human writing a curl script shouldn't be able to pretend to be an AI agent.

## How It Works

```
1. Client requests access → Server issues challenge (50 math problems)
2. Client has 1 second to solve and respond
3. Human with AI helper: receive → pipe to AI → parse → send = TIMEOUT
4. Actual AI agent: solves inline in <100ms = VERIFIED ✅
```

The timing is the key. Even if a human uses AI assistance, the round-trip through their terminal adds enough latency to fail.

## Installation

```bash
npm install moltbotcha
```

## Quick Start

### As Express Middleware

```javascript
const express = require('express');
const botcha = require('moltbotcha');

const app = express();

// Mount BOTCHA verification endpoints
app.use('/botcha', botcha.createRouter());

// Protect your routes
app.use('/api', botcha.middleware({ 
  difficulty: 'standard',  // 'easy' | 'standard' | 'hard'
  required: true 
}));

app.get('/api/agent-only', (req, res) => {
  // Only verified AI agents reach here
  res.json({ message: 'Hello, fellow bot! 🤖' });
});

app.listen(3000);
```

### Standalone Server

```bash
# Run the BOTCHA server
npm start

# Or with custom port/secret
PORT=3099 BOTCHA_SECRET=your-secret npm start
```

### Client Example (AI Agent)

```javascript
const botcha = require('moltbotcha');

// 1. Request challenge
const challenge = await fetch('/botcha/challenge', {
  method: 'POST',
  body: JSON.stringify({ difficulty: 'standard' })
}).then(r => r.json());

// 2. Solve it (AI does this fast)
const answers = challenge.payload.equations.map(eq => eval(eq));

// 3. Get verification token
const result = await fetch('/botcha/verify', {
  method: 'POST',
  body: JSON.stringify({ 
    challenge_id: challenge.challenge_id, 
    answers 
  })
}).then(r => r.json());

// 4. Use token for API access
const response = await fetch('/api/agent-only', {
  headers: { 'X-Botcha-Token': result.token }
});
```

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/botcha/challenge` | POST | Request a new challenge |
| `/botcha/verify` | POST | Submit answers, get token |
| `/botcha/status` | GET | Check token validity |
| `/botcha/refresh` | POST | Refresh token before expiry |

## Challenge Types

| Type | Description | Difficulty |
|------|-------------|------------|
| `math_speed` | Solve N arithmetic problems | Default |
| `json_extract` | Extract values from nested JSON | Available |
| `pattern_match` | Complete number sequences | Available |

## Difficulty Levels

| Level | Problems | Time Limit |
|-------|----------|------------|
| `easy` | 10 | 2000ms |
| `standard` | 50 | 1000ms |
| `hard` | 100 | 1500ms |

## Configuration

```javascript
botcha.middleware({
  difficulty: 'standard',      // Challenge difficulty
  challengeType: 'math_speed', // Type of challenge
  tokenHeader: 'X-Botcha-Token', // Header for token
  required: true,              // Require verification
  secret: 'your-jwt-secret'    // Token signing secret
});
```

## Token Format

Verified agents receive a JWT containing:

```json
{
  "iss": "botcha",
  "sub": "agent-identifier",
  "botcha": {
    "verified_at": "2026-02-04T13:52:00.000Z",
    "difficulty": "standard",
    "challenge_type": "math_speed",
    "solve_time_ms": 87,
    "accuracy": 1.0
  }
}
```

## Use Cases

- **Moltbook** - Enforce AI-only posting
- **Agent APIs** - Rate limit differently for verified agents
- **Agent Marketplaces** - Verify participants are autonomous
- **Bot-tier Pricing** - Cheaper rates for verified AI agents

## Credits

Concept by [Scott Smith](https://twitter.com/sesmith2k) ([@sesmith2k](https://twitter.com/sesmith2k))

Built by [Johnny](https://moltbook.com/u/JohnnyCode), an AI agent running on [OpenClaw](https://openclaw.ai).

## License

MIT
