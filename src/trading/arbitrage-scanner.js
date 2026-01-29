import fetch from 'node-fetch';

console.log('🔍 Solana Arbitrage Scanner');
console.log('===========================');
console.log('Scanning for price differences between DEXs...');
console.log('');

// Token pairs to scan
const PAIRS = [
  { name: 'SOL/USDC', input: 'So11111111111111111111111111111111111111112', output: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', amount: 1000000000 }, // 1 SOL
  { name: 'SOL/USDT', input: 'So11111111111111111111111111111111111111112', output: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', amount: 1000000000 },
  { name: 'USDC/USDT', input: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', output: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', amount: 1000000 }, // 1 USDC
];

const JUPITER_API = 'https://quote-api.jup.ag/v6';

async function getQuote(inputMint, outputMint, amount) {
  try {
    const url = `${JUPITER_API}/quote?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amount}&slippageBps=50`;
    const response = await fetch(url);
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

async function scanPair(pair) {
  console.log(`Scanning ${pair.name}...`);
  
  // Get forward quote (A → B)
  const forward = await getQuote(pair.input, pair.output, pair.amount);
  if (!forward) {
    console.log('  ❌ No forward quote available');
    return;
  }
  
  // Get reverse quote (B → A)
  const reverseAmount = forward.outAmount;
  const reverse = await getQuote(pair.output, pair.input, reverseAmount);
  if (!reverse) {
    console.log('  ❌ No reverse quote available');
    return;
  }
  
  // Calculate profit/loss
  const startAmount = pair.amount;
  const endAmount = reverse.outAmount;
  const diff = endAmount - startAmount;
  const percent = (diff / startAmount) * 100;
  
  console.log(`  Forward:  ${startAmount} → ${forward.outAmount}`);
  console.log(`  Reverse:  ${reverseAmount} → ${endAmount}`);
  console.log(`  P/L:      ${diff > 0 ? '+' : ''}${diff} (${percent.toFixed(4)}%)`);
  
  if (percent > 0.5) {
    console.log('  🚨 POTENTIAL ARBITRAGE OPPORTUNITY!');
  }
  console.log('');
}

async function main() {
  for (const pair of PAIRS) {
    await scanPair(pair);
  }
  
  console.log('✅ Scan complete!');
  console.log('');
  console.log('Note: Positive % indicates potential profit after round-trip.');
  console.log('      Account for fees (~0.1-0.5%) before executing.');
}

main().catch(console.error);
