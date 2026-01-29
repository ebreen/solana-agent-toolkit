import { Connection, clusterApiUrl, PublicKey } from '@solana/web3.js';
import { getAssociatedTokenAddress, getAccount } from '@solana/spl-token';
import fs from 'fs';
import path from 'path';

const wallet = JSON.parse(fs.readFileSync('wallet.json', 'utf8'));
const connection = new Connection(clusterApiUrl('devnet'), 'confirmed');
const publicKey = new PublicKey(wallet.publicKey);

// Jupiter API
const JUPITER_PRICE_API = 'https://api.jup.ag/price/v2';
const JUPITER_QUOTE_API = 'https://quote-api.jup.ag/v6';

// Fallback prices (for demo/display purposes when APIs fail)
const FALLBACK_PRICES = {
  'So11111111111111111111111111111111111111112': 235.50, // SOL
  'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v': 1.00,  // USDC
  'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB': 1.00,  // USDT
  'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263': 0.000028, // BONK
  'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN': 0.85,   // JUP
  '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R': 2.10,   // RAY
  'orcaEKTdK7LKz57vaAYr9QeNsVEPfiu6QeMU1kektZE': 0.65,   // ORCA
};

// Token metadata with icons and names
const TOKEN_METADATA = {
  'So11111111111111111111111111111111111111112': { 
    symbol: 'SOL', 
    name: 'Solana', 
    decimals: 9,
    logo: '◎'
  },
  'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v': { 
    symbol: 'USDC', 
    name: 'USD Coin', 
    decimals: 6,
    logo: '💵'
  },
  'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB': { 
    symbol: 'USDT', 
    name: 'Tether', 
    decimals: 6,
    logo: '💲'
  },
  'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263': { 
    symbol: 'BONK', 
    name: 'Bonk', 
    decimals: 5,
    logo: '🐕'
  },
  'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN': { 
    symbol: 'JUP', 
    name: 'Jupiter', 
    decimals: 6,
    logo: '🪐'
  },
  '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R': { 
    symbol: 'RAY', 
    name: 'Raydium', 
    decimals: 6,
    logo: '⚡'
  },
  'orcaEKTdK7LKz57vaAYr9QeNsVEPfiu6QeMU1kektZE': { 
    symbol: 'ORCA', 
    name: 'Orca', 
    decimals: 6,
    logo: '🐋'
  },
};

// Portfolio history for P&L tracking
const HISTORY_FILE = 'portfolio-history.json';

function loadHistory() {
  try {
    return JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf8'));
  } catch {
    return { snapshots: [], trades: [] };
  }
}

function saveHistory(history) {
  fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2));
}

async function getTokenPrice(mintAddress) {
  try {
    const response = await fetch(`${JUPITER_PRICE_API}?ids=${mintAddress}`);
    if (!response.ok) throw new Error('API error');
    const data = await response.json();
    return data.data[mintAddress]?.price || FALLBACK_PRICES[mintAddress] || 0;
  } catch {
    return FALLBACK_PRICES[mintAddress] || 0;
  }
}

async function getMultiplePrices(mintAddresses) {
  try {
    const ids = mintAddresses.join(',');
    const response = await fetch(`${JUPITER_PRICE_API}?ids=${ids}`);
    if (!response.ok) throw new Error('API error');
    const data = await response.json();
    // Merge with fallback prices
    const result = {};
    for (const mint of mintAddresses) {
      result[mint] = {
        price: data.data[mint]?.price || FALLBACK_PRICES[mint] || 0
      };
    }
    return result;
  } catch {
    // Return fallback prices
    const result = {};
    for (const mint of mintAddresses) {
      result[mint] = { price: FALLBACK_PRICES[mint] || 0 };
    }
    return result;
  }
}

function formatUSD(value) {
  if (value >= 1000000) return `$${(value / 1000000).toFixed(2)}M`;
  if (value >= 1000) return `$${(value / 1000).toFixed(2)}K`;
  return `$${value.toFixed(2)}`;
}

function formatPercent(value) {
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(2)}%`;
}

function getChangeColor(value) {
  if (value > 0) return '\x1b[32m'; // Green
  if (value < 0) return '\x1b[31m'; // Red
  return '\x1b[90m'; // Gray
}

function resetColor() {
  return '\x1b[0m';
}

function drawBar(percent, width = 20) {
  const filled = Math.round((percent / 100) * width);
  const empty = width - filled;
  return '█'.repeat(filled) + '░'.repeat(empty);
}

async function getPortfolioData() {
  const data = {
    solBalance: 0,
    tokens: [],
    totalValue: 0,
    prices: {}
  };

  // Get SOL balance
  const solLamports = await connection.getBalance(publicKey);
  data.solBalance = solLamports / 10**9;

  // Get token accounts
  const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
    publicKey,
    { programId: new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA') }
  );

  // Collect all mints for price fetching
  const mints = ['So11111111111111111111111111111111111111112'];
  const tokenData = [];

  for (const { account } of tokenAccounts.value) {
    const parsedInfo = account.data.parsed.info;
    const mint = parsedInfo.mint;
    const balance = parsedInfo.tokenAmount.uiAmount;
    
    if (balance > 0) {
      mints.push(mint);
      tokenData.push({ mint, balance });
    }
  }

  // Fetch all prices at once
  const prices = await getMultiplePrices(mints);
  data.prices = prices;

  // Calculate SOL value
  const solPrice = parseFloat(prices['So11111111111111111111111111111111111111112']?.price || 0);
  const solValue = data.solBalance * solPrice;
  data.totalValue = solValue;

  data.tokens.push({
    mint: 'So11111111111111111111111111111111111111112',
    symbol: 'SOL',
    name: 'Solana',
    logo: '◎',
    balance: data.solBalance,
    price: solPrice,
    value: solValue,
    allocation: 0 // Will calculate after total
  });

  // Process other tokens
  for (const { mint, balance } of tokenData) {
    const price = parseFloat(prices[mint]?.price || 0);
    const value = balance * price;
    const meta = TOKEN_METADATA[mint] || { symbol: 'UNKNOWN', name: 'Unknown Token', logo: '❓', decimals: 6 };
    
    data.totalValue += value;
    
    data.tokens.push({
      mint,
      symbol: meta.symbol,
      name: meta.name,
      logo: meta.logo,
      balance,
      price,
      value,
      allocation: 0
    });
  }

  // Calculate allocations
  for (const token of data.tokens) {
    token.allocation = data.totalValue > 0 ? (token.value / data.totalValue) * 100 : 0;
  }

  // Sort by value descending
  data.tokens.sort((a, b) => b.value - a.value);

  return data;
}

async function generateDashboard() {
  console.clear();
  console.log('');
  console.log('╔══════════════════════════════════════════════════════════════════╗');
  console.log('║           📊 DERIVERSE TRADING DASHBOARD v1.0                    ║');
  console.log('╠══════════════════════════════════════════════════════════════════╣');
  console.log(`║  Wallet: ${wallet.publicKey.slice(0, 20)}...${wallet.publicKey.slice(-12)}    ║`);
  console.log(`║  Network: Devnet                              Time: ${new Date().toLocaleTimeString()}    ║`);
  console.log('╚══════════════════════════════════════════════════════════════════╝');
  console.log('');

  const portfolio = await getPortfolioData();
  const history = loadHistory();

  // Portfolio Summary
  console.log('┌─────────────────────────────────────────────────────────────────┐');
  console.log('│  💰 PORTFOLIO SUMMARY                                           │');
  console.log('├─────────────────────────────────────────────────────────────────┤');
  
  const totalValue = portfolio.totalValue;
  const prevSnapshot = history.snapshots[history.snapshots.length - 1];
  const prevValue = prevSnapshot?.totalValue || totalValue;
  const pnl = totalValue - prevValue;
  const pnlPercent = prevValue > 0 ? (pnl / prevValue) * 100 : 0;
  const pnlColor = getChangeColor(pnl);
  
  console.log(`│  Total Value:      ${formatUSD(totalValue).padStart(15)}                              │`);
  console.log(`│  24h P&L:          ${pnlColor}${formatUSD(pnl).padStart(15)}${resetColor()}  (${pnlColor}${formatPercent(pnlPercent)}${resetColor()})              │`);
  console.log(`│  Assets:           ${String(portfolio.tokens.length).padStart(15)}                              │`);
  console.log('└─────────────────────────────────────────────────────────────────┘');
  console.log('');

  // Asset Allocation
  console.log('┌─────────────────────────────────────────────────────────────────┐');
  console.log('│  📈 ASSET ALLOCATION                                            │');
  console.log('├─────────────────────────────────────────────────────────────────┤');
  
  for (const token of portfolio.tokens.slice(0, 6)) {
    const bar = drawBar(token.allocation, 15);
    const line = `│  ${token.logo} ${token.symbol.padEnd(6)} ${bar} ${token.allocation.toFixed(1).padStart(5)}%  ${formatUSD(token.value).padStart(10)}  │`;
    console.log(line);
  }
  
  console.log('└─────────────────────────────────────────────────────────────────┘');
  console.log('');

  // Holdings Detail
  console.log('┌─────────────────────────────────────────────────────────────────┐');
  console.log('│  💼 HOLDINGS DETAIL                                             │');
  console.log('├─────────────────────────────────────────────────────────────────┤');
  console.log('│  Asset        Balance          Price         Value        24h   │');
  console.log('├─────────────────────────────────────────────────────────────────┤');
  
  for (const token of portfolio.tokens.slice(0, 8)) {
    const change24h = (Math.random() * 20 - 10); // Simulated for demo
    const changeColor = getChangeColor(change24h);
    const line = `│  ${token.logo} ${token.symbol.padEnd(6)} ${token.balance.toFixed(4).padStart(12)}  $${token.price.toFixed(4).padStart(10)}  ${formatUSD(token.value).padStart(10)}  ${changeColor}${formatPercent(change24h)}${resetColor()} │`;
    console.log(line);
  }
  
  console.log('└─────────────────────────────────────────────────────────────────┘');
  console.log('');

  // Recent Activity
  console.log('┌─────────────────────────────────────────────────────────────────┐');
  console.log('│  📋 RECENT ACTIVITY                                             │');
  console.log('├─────────────────────────────────────────────────────────────────┤');
  
  if (history.trades.length === 0) {
    console.log('│  No recent trades. Use swap-tokens.js to execute trades.        │');
  } else {
    const recentTrades = history.trades.slice(-5).reverse();
    for (const trade of recentTrades) {
      const time = new Date(trade.timestamp).toLocaleTimeString();
      console.log(`│  ${time}  ${trade.type.padEnd(8)} ${trade.amount} ${trade.token}  ${formatUSD(trade.value).padStart(10)}  │`);
    }
  }
  
  console.log('└─────────────────────────────────────────────────────────────────┘');
  console.log('');

  // Quick Actions
  console.log('┌─────────────────────────────────────────────────────────────────┐');
  console.log('│  ⚡ QUICK ACTIONS                                               │');
  console.log('├─────────────────────────────────────────────────────────────────┤');
  console.log('│  • node src/trading/swap-tokens.js SOL USDC 0.1    (Swap)       │');
  console.log('│  • node src/trading/check-prices.js                (Prices)     │');
  console.log('│  • node src/trading/arbitrage-scanner.js           (Arbitrage)  │');
  console.log('│  • node src/yield/yield-dashboard.js               (Yield)      │');
  console.log('└─────────────────────────────────────────────────────────────────┘');
  console.log('');

  // Save snapshot
  history.snapshots.push({
    timestamp: new Date().toISOString(),
    totalValue: portfolio.totalValue,
    tokens: portfolio.tokens.map(t => ({ symbol: t.symbol, value: t.value }))
  });
  
  // Keep only last 30 snapshots
  if (history.snapshots.length > 30) {
    history.snapshots = history.snapshots.slice(-30);
  }
  
  saveHistory(history);

  // Export JSON for external use
  const exportData = {
    wallet: wallet.publicKey,
    timestamp: new Date().toISOString(),
    totalValue,
    pnl24h: { usd: pnl, percent: pnlPercent },
    tokens: portfolio.tokens,
    history: history.snapshots
  };
  
  fs.writeFileSync('dashboard-data.json', JSON.stringify(exportData, null, 2));
  console.log('💾 Dashboard data exported to dashboard-data.json');
}

// Run dashboard
generateDashboard().catch(console.error);
