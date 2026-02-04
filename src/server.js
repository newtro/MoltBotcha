/**
 * BOTCHA Standalone Server
 * Run this to host BOTCHA as a service
 */

const express = require('express');
const { createRouter, getStore } = require('./index');

const app = express();
const PORT = process.env.PORT || 3099;
const SECRET = process.env.BOTCHA_SECRET || 'botcha-secret-change-in-production';

app.use(express.json());

// CORS for API access
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Botcha-Token');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// Health check
app.get('/health', (req, res) => {
  const store = getStore();
  res.json({
    status: 'ok',
    version: '0.1.0',
    challenges: store.stats()
  });
});

// Mount BOTCHA routes
app.use('/botcha', createRouter({ secret: SECRET }));

// Info endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'BOTCHA',
    description: 'Prove you\'re a bot, not a human. The inverse of CAPTCHA.',
    version: '0.1.0',
    endpoints: {
      'POST /botcha/challenge': 'Request a new challenge',
      'POST /botcha/verify': 'Submit answers and get token',
      'GET /botcha/status': 'Check token validity',
      'POST /botcha/refresh': 'Refresh token before expiry',
      'GET /health': 'Service health check'
    },
    github: 'https://github.com/newtro/MoltBotcha'
  });
});

app.listen(PORT, () => {
  console.log(`🤖 BOTCHA server running on port ${PORT}`);
  console.log(`   Health: http://localhost:${PORT}/health`);
  console.log(`   Challenge: POST http://localhost:${PORT}/botcha/challenge`);
});
