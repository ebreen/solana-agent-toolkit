// Position Tracker
// Tracks actual yield positions and calculates real returns

import { Connection, PublicKey } from '@solana/web3.js';
import { getAssociatedTokenAddress, getAccount } from '@solana/spl-token';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const NETWORK = process.env.NETWORK || 'mainnet';
const connection = new Connection(
  NETWORK === 'mainnet' 
    ? 'https://api.mainnet-beta.solana.com'
    : 'https://api.devnet.solana.com',
  'confirmed'
);

// Load wallet
const walletFile = JSON.parse(fs.readFileSync(path.join(__dirname, 'wallet.json'), 'utf-8'));
const walletPublicKey = new PublicKey(walletFile.publicKey);

// Token mints for tracking
const TRACKED_TOKENS = {
  SOL: { mint: 'So11111111111111111111111111111111111111112', decimals: 9, priceId: 'SOL' },
  USDC: { mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', decimals: 6, priceId: 'USDC' },
  JLP: { mint: '27G8MtK7VtTcCHkpASjSDdkWWYfoqT6ggEuKidVJidD4', decimals: 6, priceId: 'JLP' },
  mSOL: { mint: 'mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So', decimals: 9, priceId: 'MSOL' },
  jitoSOL: { mint: 'J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn', decimals: 9, priceId: 'JITOSOL' },
  INF: { mint: '5oVNBeEEQvYi1cX3ir8Dx5n1P7pdxydbGF2X6TxNxUFE', decimals: 9, priceId: 'INF' }
};

const POSITIONS_FILE = path.join(__dirname, 'positions.json');

function loadPositions() {
  try {
    return JSON.parse(fs.readFileSync(POSITIONS_FILE, 'utf-8'));
  } catch {
    return {};
  }
}

function savePositions(positions) {
  fs.writeFileSync(POSITIONS_FILE, JSON.stringify(positions, null, 2));
}

async function getTokenPrice(tokenId) {
  try {
    const response = await fetch(`https://price.jup.ag/v6/price?ids=${tokenId}`);
    const data = await response.json();
    return data.data?.[tokenId]?.price || 0;
  } catch {
    return 0;
  }
}

async function getTokenBalance(mint, owner) {
  try {
    const ata = await getAssociatedTokenAddress(new PublicKey(mint), owner);
    const account = await getAccount(connection, ata);
    return Number(account.amount);
  } catch {
    return 0;
  }
}

async function trackPosition(name, tokenKey, type = 'hold', apy = 0, notes = '') {
  const token = TRACKED_TOKENS[tokenKey];
  if (!token) {
    console.error(`Unknown token: ${tokenKey}`);
    return;
  }

  console.log(`📊 Tracking ${name}...`);
  
  const balance = await getTokenBalance(token.mint, walletPublicKey);
  const price = await getTokenPrice(token.priceId);
  const amount = balance / Math.pow(10, token.decimals);
  const value = amount * price;

  const positions = loadPositions();
  
  const position = {
    name,
    token: tokenKey,
    type, // 'hold', 'stake', 'lp', 'lend'
    balance: amount,
    price,
    value,
    apy,
    notes,
    lastUpdated: new Date().toISOString()
  };

  positions[name] = position;
  savePositions(positions);

  console.log(`  Balance: ${amount.toFixed(4)} ${tokenKey}`);
  console.log(`  Value: $${value.toFixed(2)}`);
  console.log(`  APY: ${apy}%`);
  if (apy > 0) {
    const dailyYield = value * (apy / 100) / 365;
    console.log(`  Est. Daily: $${dailyYield.toFixed(4)}`);
  }

  return position;
}

async function showPortfolio() {
  console.log('💼 Yield Position Tracker');
  console.log(`Wallet: ${walletPublicKey.toBase58()}`);
  console.log(`Network: ${NETWORK}`);
  console.log('=' .repeat(60));
  console.log('');

  const positions = loadPositions();
  const entries = Object.entries(positions);

  if (entries.length === 0) {
    console.log('No positions tracked yet.');
    console.log('Use: node position-tracker.js track <name> <token> [apy] [type]');
    return;
  }

  let totalValue = 0;
  let totalDailyYield = 0;

  console.log('Positions:');
  console.log('-'.repeat(60));
  console.log('Name                Token     Balance      Value      APY    Daily');
  console.log('-'.repeat(60));

  entries.forEach(([name, pos]) => {
    const dailyYield = pos.value * (pos.apy / 100) / 365;
    totalValue += pos.value;
    totalDailyYield += dailyYield;

    const nameStr = name.padEnd(18);
    const tokenStr = pos.token.padEnd(8);
    const balStr = pos.balance.toFixed(4).padEnd(12);
    const valStr = `$${pos.value.toFixed(2)}`.padEnd(10);
    const apyStr = `${pos.apy}%`.padEnd(6);
    const dailyStr = `$${dailyYield.toFixed(4)}`;

    console.log(`${nameStr}${tokenStr}${balStr}${valStr}${apyStr}${dailyStr}`);
  });

  console.log('-'.repeat(60));
  console.log(`Total Value: $${totalValue.toFixed(2)}`);
  console.log(`Total Daily Yield: $${totalDailyYield.toFixed(4)}`);
  console.log(`Est. Monthly: $${(totalDailyYield * 30).toFixed(2)}`);
  console.log(`Est. Yearly: $${(totalDailyYield * 365).toFixed(2)}`);
  
  if (totalValue > 0) {
    const blendedApy = (totalDailyYield * 365 / totalValue) * 100;
    console.log(`Blended APY: ${blendedApy.toFixed(2)}%`);
  }
}

async function removePosition(name) {
  const positions = loadPositions();
  if (positions[name]) {
    delete positions[name];
    savePositions(positions);
    console.log(`✅ Removed position: ${name}`);
  } else {
    console.log(`❌ Position not found: ${name}`);
  }
}

// CLI
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const command = args[0];

  switch (command) {
    case 'track':
      if (args.length < 3) {
        console.log('Usage: node position-tracker.js track <name> <token> [apy] [type] [notes]');
        console.log('Tokens: SOL, USDC, JLP, mSOL, jitoSOL, INF');
        console.log('Types: hold, stake, lp, lend');
        process.exit(1);
      }
      trackPosition(args[1], args[2], args[4] || 'hold', parseFloat(args[3]) || 0, args[5] || '');
      break;
    
    case 'remove':
      if (args[1]) {
        removePosition(args[1]);
      } else {
        console.log('Usage: node position-tracker.js remove <name>');
      }
      break;
    
    case 'portfolio':
    default:
      showPortfolio();
  }
}

export { trackPosition, showPortfolio, loadPositions };
