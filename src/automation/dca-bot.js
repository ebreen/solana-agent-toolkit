import { Connection, clusterApiUrl, PublicKey, Keypair } from '@solana/web3.js';
import fs from 'fs';

// DCA Bot Configuration
const CONFIG = {
  // Token to buy (e.g., USDC)
  outputToken: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  // Token to spend (e.g., SOL)
  inputToken: 'So11111111111111111111111111111111111111112',
  // Amount to spend per purchase (in SOL)
  amountPerTrade: 0.01,
  // Interval between trades (in minutes)
  intervalMinutes: 5,
  // Total number of trades to execute
  totalTrades: 10,
  // Slippage tolerance (in bps, 50 = 0.5%)
  slippageBps: 50,
};

const wallet = JSON.parse(fs.readFileSync('wallet.json', 'utf8'));
const connection = new Connection(clusterApiUrl('devnet'), 'confirmed');

console.log('🤖 DCA Bot - Dollar Cost Averaging');
console.log('===================================');
console.log('Strategy: Buy USDC with SOL over time');
console.log(`Amount per trade: ${CONFIG.amountPerTrade} SOL`);
console.log(`Interval: ${CONFIG.intervalMinutes} minutes`);
console.log(`Total trades: ${CONFIG.totalTrades}`);
console.log('Wallet:', wallet.publicKey);
console.log('');

// State file to persist bot state
const STATE_FILE = 'dca-bot-state.json';

function loadState() {
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
  } catch {
    return {
      tradesExecuted: 0,
      totalSpent: 0,
      totalReceived: 0,
      startTime: new Date().toISOString(),
      trades: []
    };
  }
}

function saveState(state) {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

async function getQuote() {
  const JUPITER_API = 'https://quote-api.jup.ag/v6';
  const amount = CONFIG.amountPerTrade * 10**9; // SOL has 9 decimals
  
  try {
    const url = `${JUPITER_API}/quote?inputMint=${CONFIG.inputToken}&outputMint=${CONFIG.outputToken}&amount=${amount}&slippageBps=${CONFIG.slippageBps}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (err) {
    console.error('Quote error:', err.message);
    return null;
  }
}

async function executeTrade() {
  const state = loadState();
  
  if (state.tradesExecuted >= CONFIG.totalTrades) {
    console.log('✅ All trades completed!');
    console.log('Summary:');
    console.log('  Total spent:', state.totalSpent, 'SOL');
    console.log('  Total received:', state.totalReceived, 'USDC');
    console.log('  Average price:', state.totalSpent / state.totalReceived, 'SOL/USDC');
    return false;
  }
  
  console.log(`\n📊 Trade ${state.tradesExecuted + 1}/${CONFIG.totalTrades}`);
  console.log('Fetching quote...');
  
  const quote = await getQuote();
  if (!quote) {
    console.log('❌ Failed to get quote, will retry next interval');
    return true;
  }
  
  const usdcReceived = quote.outAmount / 10**6; // USDC has 6 decimals
  const price = CONFIG.amountPerTrade / usdcReceived;
  
  console.log('Quote received:');
  console.log(`  Spend: ${CONFIG.amountPerTrade} SOL`);
  console.log(`  Receive: ~${usdcReceived.toFixed(2)} USDC`);
  console.log(`  Price: ${price.toFixed(6)} SOL/USDC`);
  
  // Simulate trade execution (in real bot, this would execute the swap)
  console.log('✅ Trade simulated (not executed on devnet to preserve SOL)');
  
  // Update state
  state.tradesExecuted++;
  state.totalSpent += CONFIG.amountPerTrade;
  state.totalReceived += usdcReceived;
  state.trades.push({
    trade: state.tradesExecuted,
    timestamp: new Date().toISOString(),
    spent: CONFIG.amountPerTrade,
    received: usdcReceived,
    price: price
  });
  
  saveState(state);
  
  console.log(`\nProgress: ${state.tradesExecuted}/${CONFIG.totalTrades} trades`);
  console.log(`Total spent: ${state.totalSpent.toFixed(4)} SOL`);
  console.log(`Total received: ${state.totalReceived.toFixed(2)} USDC`);
  
  return state.tradesExecuted < CONFIG.totalTrades;
}

async function run() {
  const state = loadState();
  
  console.log('State loaded:');
  console.log('  Trades executed:', state.tradesExecuted);
  console.log('  Total spent:', state.totalSpent, 'SOL');
  console.log('  Start time:', state.startTime);
  console.log('');
  
  // Execute one trade immediately
  const shouldContinue = await executeTrade();
  
  if (shouldContinue) {
    console.log(`\n⏱️  Next trade in ${CONFIG.intervalMinutes} minutes...`);
    console.log('(In a real bot, this would wait and execute automatically)');
    console.log('');
    console.log('To run continuously, use:');
    console.log('  node dca-bot.js --continuous');
  }
}

// Check for --continuous flag
const continuous = process.argv.includes('--continuous');

if (continuous) {
  console.log('🔄 Continuous mode enabled');
  console.log('Press Ctrl+C to stop\n');
  
  // Run immediately
  run().then(() => {
    // Set interval for subsequent trades
    setInterval(async () => {
      const shouldContinue = await executeTrade();
      if (!shouldContinue) {
        console.log('\n🎯 DCA strategy complete!');
        process.exit(0);
      }
    }, CONFIG.intervalMinutes * 60 * 1000);
  });
} else {
  run();
}
