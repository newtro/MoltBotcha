/**
 * Example: AI Agent solving a BOTCHA challenge
 * 
 * This demonstrates how an AI agent would verify itself.
 * Run with: node examples/client-example.js
 */

const BOTCHA_URL = process.env.BOTCHA_URL || 'http://localhost:3099';

async function solveChallenge() {
  console.log('🤖 AI Agent starting BOTCHA verification...\n');
  
  // Step 1: Request a challenge
  console.log('1️⃣ Requesting challenge...');
  const challengeResponse = await fetch(`${BOTCHA_URL}/botcha/challenge`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ difficulty: 'standard', type: 'math_speed' })
  });
  
  const challenge = await challengeResponse.json();
  console.log(`   Challenge ID: ${challenge.challenge_id}`);
  console.log(`   Type: ${challenge.type}`);
  console.log(`   Problems: ${challenge.payload.equations.length}`);
  console.log(`   Time limit: ${challenge.ttl_ms}ms\n`);
  
  // Step 2: Solve the challenge (this is what makes AI agents special)
  console.log('2️⃣ Solving challenge...');
  const startTime = Date.now();
  
  const answers = challenge.payload.equations.map(eq => {
    // Simple eval for math - AI would use proper parsing
    // In production, use a safer math parser
    return eval(eq.replace(/×/g, '*').replace(/÷/g, '/'));
  });
  
  const solveTime = Date.now() - startTime;
  console.log(`   Solved ${answers.length} problems in ${solveTime}ms\n`);
  
  // Step 3: Submit answers
  console.log('3️⃣ Submitting answers...');
  const verifyResponse = await fetch(`${BOTCHA_URL}/botcha/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      challenge_id: challenge.challenge_id,
      answers
    })
  });
  
  const result = await verifyResponse.json();
  
  if (result.verified) {
    console.log('   ✅ Verified as AI agent!');
    console.log(`   Token: ${result.token.substring(0, 50)}...`);
    console.log(`   Solve time: ${result.agent_score.solve_time_ms}ms`);
    console.log(`   Accuracy: ${result.agent_score.accuracy * 100}%`);
    console.log(`   Confidence: ${result.agent_score.confidence}`);
    console.log(`   Expires: ${result.expires_at}\n`);
    
    // Step 4: Use the token to access protected APIs
    console.log('4️⃣ Token can now be used for protected API calls:');
    console.log(`   Headers: { "X-Botcha-Token": "${result.token.substring(0, 30)}..." }\n`);
    
    return result.token;
  } else {
    console.log(`   ❌ Verification failed: ${result.error}`);
    console.log(`   Details:`, result.details);
    return null;
  }
}

// Run the example
solveChallenge().catch(console.error);
