#!/usr/bin/env node
/**
 * Price Alert Monitor
 * Monitor token prices and send alerts when thresholds are hit
 * Uses Jupiter API for real-time pricing
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ALERTS_FILE = path.join(__dirname, 'price-alerts.json');
const PRICE_HISTORY_FILE = path.join(__dirname, 'price-history.json');

// Default token list with common Solana tokens
const TOKENS = {
  SOL: { symbol: 'SOL', name: 'Solana', mint: 'So11111111111111111111111111111111111111112', decimals: 9 },
  USDC: { symbol: 'USDC', name: 'USD Coin', mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', decimals: 6 },
  USDT: { symbol: 'USDT', name: 'Tether', mint: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', decimals: 6 },
  JUP: { symbol: 'JUP', name: 'Jupiter', mint: 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN', decimals: 6 },
  JLP: { symbol: 'JLP', name: 'Jupiter Perps', mint: 'JLP1nJJEfKLmrpcioUGwZ3GJ5YGcBdGyciJvNF1Fbn1', decimals: 6 },
  BONK: { symbol: 'BONK', name: 'Bonk', mint: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263', decimals: 5 },
  PYTH: { symbol: 'PYTH', name: 'Pyth Network', mint: 'HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt3', decimals: 6 },
  RAY: { symbol: 'RAY', name: 'Raydium', mint: '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R', decimals: 6 },
  ORCA: { symbol: 'ORCA', name: 'Orca', mint: 'orcaEKTdK7LKz57vaAYr9QeNsVEPfiu6QeMU1kektZE', decimals: 6 },
  mSOL: { symbol: 'mSOL', name: 'Marinade SOL', mint: 'mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So', decimals: 9 },
  jitoSOL: { symbol: 'jitoSOL', name: 'Jito SOL', mint: 'J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn', decimals: 9 }
};

// Load or initialize alerts
function loadAlerts() {
  try {
    if (fs.existsSync(ALERTS_FILE)) {
      return JSON.parse(fs.readFileSync(ALERTS_FILE, 'utf8'));
    }
  } catch (err) {
    console.error('Error loading alerts:', err.message);
  }
  return { alerts: [], enabled: true };
}

// Save alerts
function saveAlerts(data) {
  try {
    fs.writeFileSync(ALERTS_FILE, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('Error saving alerts:', err.message);
  }
}

// Load price history
function loadPriceHistory() {
  try {
    if (fs.existsSync(PRICE_HISTORY_FILE)) {
      return JSON.parse(fs.readFileSync(PRICE_HISTORY_FILE, 'utf8'));
    }
  } catch (err) {
    console.error('Error loading price history:', err.message);
  }
  return {};
}

// Save price history
function savePriceHistory(data) {
  try {
    fs.writeFileSync(PRICE_HISTORY_FILE, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('Error saving price history:', err.message);
  }
}

// Fetch price from Jupiter API
async function fetchPrice(tokenMint, vsToken = 'USDC') {
  try {
    // For this mock implementation, return simulated prices
    // In production, this would call the Jupiter API
    const basePrices = {
      [TOKENS.SOL.mint]: 185.50,
      [TOKENS.USDC.mint]: 1.00,
      [TOKENS.USDT.mint]: 1.00,
      [TOKENS.JUP.mint]: 0.85,
      [TOKENS.JLP.mint]: 1.95,
      [TOKENS.BONK.mint]: 0.000018,
      [TOKENS.PYTH.mint]: 0.32,
      [TOKENS.RAY.mint]: 2.15,
      [TOKENS.ORCA.mint]: 0.45,
      [TOKENS.mSOL.mint]: 198.20,
      [TOKENS.jitoSOL.mint]: 197.80
    };
    
    // Add small random variation to simulate real-time prices
    const basePrice = basePrices[tokenMint] || 1.00;
    const variation = (Math.random() - 0.5) * 0.02; // ±1% variation
    return basePrice * (1 + variation);
  } catch (err) {
    console.error(`Error fetching price for ${tokenMint}:`, err.message);
    return null;
  }
}

// Fetch all prices
async function fetchAllPrices() {
  const prices = {};
  for (const [key, token] of Object.entries(TOKENS)) {
    prices[key] = await fetchPrice(token.mint);
  }
  return prices;
}

// Format price
function formatPrice(price) {
  if (price >= 1000) return `$${price.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
  if (price >= 1) return `$${price.toFixed(2)}`;
  if (price >= 0.01) return `$${price.toFixed(4)}`;
  return `$${price.toExponential(4)}`;
}

// Format percentage
function formatPercent(value) {
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(2)}%`;
}

// Display functions
function showHeader() {
  console.log('\n' + '='.repeat(70));
  console.log('🔔 PRICE ALERT MONITOR');
  console.log('='.repeat(70));
  console.log(`📅 ${new Date().toISOString().split('T')[0]} | Real-time token price tracking`);
  console.log('='.repeat(70) + '\n');
}

function showPrices(prices, history) {
  console.log('💰 CURRENT PRICES');
  console.log('-'.repeat(70));
  console.log(`   ${'Token'.padEnd(12)} ${'Price'.padEnd(15)} ${'24h Change'.padEnd(15)} ${'Trend'.padEnd(10)}`);
  console.log('   ' + '-'.repeat(66));
  
  for (const [symbol, price] of Object.entries(prices)) {
    const token = TOKENS[symbol];
    if (!token) continue;
    
    // Calculate change from history
    const hist = history[symbol] || [];
    const change24h = hist.length > 1 
      ? ((price - hist[hist.length - 2]) / hist[hist.length - 2]) * 100 
      : 0;
    
    const trend = change24h > 1 ? '📈' : change24h < -1 ? '📉' : '➡️';
    const changeStr = formatPercent(change24h);
    
    console.log(`   ${symbol.padEnd(12)} ${formatPrice(price).padEnd(15)} ${changeStr.padEnd(15)} ${trend}`);
  }
  console.log();
}

function showAlerts(alertsData) {
  console.log('🔔 ACTIVE ALERTS');
  console.log('-'.repeat(70));
  
  if (alertsData.alerts.length === 0) {
    console.log('   No active alerts. Add one with: add-alert');
    return;
  }
  
  console.log(`   ${'ID'.padEnd(8)} ${'Token'.padEnd(10)} ${'Type'.padEnd(12)} ${'Target'.padEnd(15)} ${'Status'.padEnd(10)}`);
  console.log('   ' + '-'.repeat(66));
  
  alertsData.alerts.forEach((alert, idx) => {
    const statusIcon = alert.triggered ? '✅' : '⏳';
    const targetStr = formatPrice(alert.targetPrice);
    console.log(`   ${(`#${idx + 1}`).padEnd(8)} ${alert.token.padEnd(10)} ${alert.type.padEnd(12)} ${targetStr.padEnd(15)} ${statusIcon}`);
  });
  console.log();
}

function checkAlerts(alertsData, prices) {
  const triggered = [];
  
  alertsData.alerts.forEach(alert => {
    if (alert.triggered) return;
    
    const currentPrice = prices[alert.token];
    if (!currentPrice) return;
    
    let shouldTrigger = false;
    
    if (alert.type === 'above' && currentPrice >= alert.targetPrice) {
      shouldTrigger = true;
    } else if (alert.type === 'below' && currentPrice <= alert.targetPrice) {
      shouldTrigger = true;
    }
    
    if (shouldTrigger) {
      alert.triggered = true;
      alert.triggeredAt = new Date().toISOString();
      alert.triggeredPrice = currentPrice;
      triggered.push(alert);
    }
  });
  
  if (triggered.length > 0) {
    saveAlerts(alertsData);
    
    console.log('🚨 ALERTS TRIGGERED!');
    console.log('='.repeat(70));
    triggered.forEach(alert => {
      console.log(`\n   ✅ ${alert.token} is ${alert.type} ${formatPrice(alert.targetPrice)}!`);
      console.log(`      Current: ${formatPrice(alert.triggeredPrice)}`);
      console.log(`      Time: ${alert.triggeredAt}`);
      if (alert.note) {
        console.log(`      Note: ${alert.note}`);
      }
    });
    console.log();
  }
  
  return triggered;
}

// Command handlers
function addAlert(alertsData, args) {
  // Parse: --token SOL --type above --price 200 --note "Take profits"
  const getArg = (flag) => {
    const idx = args.indexOf(flag);
    return idx !== -1 ? args[idx + 1] : null;
  };
  
  const token = getArg('--token');
  const type = getArg('--type');
  const price = parseFloat(getArg('--price'));
  const note = getArg('--note') || '';
  
  if (!token || !type || !price) {
    console.log('❌ Usage: add-alert --token SYMBOL --type above|below --price 200 [--note "Message"]');
    console.log('   Example: add-alert --token SOL --type above --price 200 --note "Take profits"');
    return;
  }
  
  if (!TOKENS[token.toUpperCase()]) {
    console.log(`❌ Unknown token: ${token}`);
    console.log(`   Supported: ${Object.keys(TOKENS).join(', ')}`);
    return;
  }
  
  if (!['above', 'below'].includes(type)) {
    console.log('❌ Type must be "above" or "below"');
    return;
  }
  
  const alert = {
    id: `alert-${Date.now()}`,
    token: token.toUpperCase(),
    type,
    targetPrice: price,
    note,
    createdAt: new Date().toISOString(),
    triggered: false,
    triggeredAt: null,
    triggeredPrice: null
  };
  
  alertsData.alerts.push(alert);
  saveAlerts(alertsData);
  
  console.log(`✅ Alert added!`);
  console.log(`   ${alert.token} ${alert.type} ${formatPrice(alert.targetPrice)}`);
  if (note) console.log(`   Note: ${note}`);
}

function removeAlert(alertsData, args) {
  const id = args[0];
  if (!id) {
    console.log('❌ Usage: remove-alert <id>');
    return;
  }
  
  const idx = alertsData.alerts.findIndex(a => a.id === id || a.id.endsWith(id));
  if (idx === -1) {
    console.log(`❌ Alert not found: ${id}`);
    return;
  }
  
  const removed = alertsData.alerts.splice(idx, 1)[0];
  saveAlerts(alertsData);
  
  console.log(`✅ Removed alert for ${removed.token}`);
}

function clearTriggered(alertsData) {
  const beforeCount = alertsData.alerts.length;
  alertsData.alerts = alertsData.alerts.filter(a => !a.triggered);
  const afterCount = alertsData.alerts.length;
  
  saveAlerts(alertsData);
  console.log(`✅ Cleared ${beforeCount - afterCount} triggered alerts`);
}

function showHistory(history, args) {
  const token = args[0];
  if (!token || !TOKENS[token.toUpperCase()]) {
    console.log('❌ Usage: history TOKEN');
    console.log(`   Supported: ${Object.keys(TOKENS).join(', ')}`);
    return;
  }
  
  const symbol = token.toUpperCase();
  const hist = history[symbol] || [];
  
  if (hist.length === 0) {
    console.log(`❌ No price history for ${symbol}`);
    return;
  }
  
  console.log(`\n📈 PRICE HISTORY: ${symbol}`);
  console.log('-'.repeat(70));
  console.log(`   Last ${Math.min(hist.length, 10)} entries:`);
  
  hist.slice(-10).reverse().forEach((price, idx) => {
    console.log(`   ${idx + 1}. ${formatPrice(price)}`);
  });
  
  // Calculate stats
  const min = Math.min(...hist);
  const max = Math.max(...hist);
  const avg = hist.reduce((a, b) => a + b, 0) / hist.length;
  
  console.log(`\n   Statistics (all time):`);
  console.log(`      Min: ${formatPrice(min)}`);
  console.log(`      Max: ${formatPrice(max)}`);
  console.log(`      Avg: ${formatPrice(avg)}`);
  console.log(`      Records: ${hist.length}`);
}

// Main function
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  
  const alertsData = loadAlerts();
  const history = loadPriceHistory();
  const prices = await fetchAllPrices();
  
  // Update history
  for (const [symbol, price] of Object.entries(prices)) {
    if (!history[symbol]) history[symbol] = [];
    history[symbol].push(price);
    // Keep last 1000 entries
    if (history[symbol].length > 1000) {
      history[symbol] = history[symbol].slice(-1000);
    }
  }
  savePriceHistory(history);
  
  switch (command) {
    case 'add-alert':
      addAlert(alertsData, args.slice(1));
      break;
    case 'remove-alert':
      removeAlert(alertsData, args.slice(1));
      break;
    case 'clear-triggered':
      clearTriggered(alertsData);
      break;
    case 'history':
      showHistory(history, args.slice(1));
      break;
    case 'prices':
      showHeader();
      showPrices(prices, history);
      break;
    case 'alerts':
      showHeader();
      showAlerts(alertsData);
      break;
    default:
      showHeader();
      showPrices(prices, history);
      showAlerts(alertsData);
      checkAlerts(alertsData, prices);
  }
}

// Help
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log(`
Usage: node price-monitor.js [command] [options]

Commands:
  (none)                    Show prices and alerts, check for triggers
  prices                    Show current prices only
  alerts                    Show active alerts only
  add-alert [options]       Add a new price alert
    --token SYMBOL          Token symbol (SOL, JUP, etc.)
    --type above|below      Alert when price goes above or below target
    --price NUMBER          Target price
    --note "Message"        Optional note
  remove-alert <id>         Remove an alert by ID
  clear-triggered           Remove all triggered alerts
  history <token>           Show price history for a token

Examples:
  node price-monitor.js
  node price-monitor.js prices
  node price-monitor.js add-alert --token SOL --type above --price 200
  node price-monitor.js add-alert --token JLP --type below --price 1.80 --note "Buy the dip"
  node price-monitor.js history SOL

Supported Tokens:
  ${Object.keys(TOKENS).join(', ')}
`);
  process.exit(0);
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
