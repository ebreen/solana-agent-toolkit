import { Connection, clusterApiUrl, PublicKey } from '@solana/web3.js';
import fs from 'fs';

const TRADE_JOURNAL_FILE = 'trade-journal.json';

// Load or initialize trade journal
function loadJournal() {
  try {
    return JSON.parse(fs.readFileSync(TRADE_JOURNAL_FILE, 'utf8'));
  } catch {
    return {
      trades: [],
      createdAt: new Date().toISOString(),
      lastUpdated: new Date().toISOString()
    };
  }
}

function saveJournal(journal) {
  journal.lastUpdated = new Date().toISOString();
  fs.writeFileSync(TRADE_JOURNAL_FILE, JSON.stringify(journal, null, 2));
}

// Add a new trade
function addTrade(trade) {
  const journal = loadJournal();
  const newTrade = {
    id: `trade-${Date.now()}`,
    timestamp: new Date().toISOString(),
    ...trade,
    pnl: trade.exitPrice && trade.entryPrice ? 
      (trade.side === 'long' ? 1 : -1) * (trade.exitPrice - trade.entryPrice) * trade.size : null
  };
  journal.trades.push(newTrade);
  saveJournal(journal);
  return newTrade;
}

// Calculate analytics
function calculateAnalytics(trades, filters = {}) {
  let filteredTrades = trades;
  
  // Apply filters
  if (filters.symbol) {
    filteredTrades = filteredTrades.filter(t => t.symbol === filters.symbol);
  }
  if (filters.startDate) {
    filteredTrades = filteredTrades.filter(t => new Date(t.timestamp) >= new Date(filters.startDate));
  }
  if (filters.endDate) {
    filteredTrades = filteredTrades.filter(t => new Date(t.timestamp) <= new Date(filters.endDate));
  }
  if (filters.side) {
    filteredTrades = filteredTrades.filter(t => t.side === filters.side);
  }
  if (filters.tags && filters.tags.length > 0) {
    filteredTrades = filteredTrades.filter(t => 
      filters.tags.some(tag => t.tags?.includes(tag))
    );
  }
  
  const closedTrades = filteredTrades.filter(t => t.status === 'closed' && t.pnl !== null);
  const winningTrades = closedTrades.filter(t => t.pnl > 0);
  const losingTrades = closedTrades.filter(t => t.pnl < 0);
  
  // Calculate equity curve and drawdown
  let equity = 0;
  let peakEquity = 0;
  let maxDrawdown = 0;
  let maxDrawdownPercent = 0;
  const equityCurve = [];
  
  for (const trade of closedTrades.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))) {
    equity += trade.pnl;
    peakEquity = Math.max(peakEquity, equity);
    const drawdown = peakEquity - equity;
    const drawdownPercent = peakEquity > 0 ? (drawdown / peakEquity) * 100 : 0;
    maxDrawdown = Math.max(maxDrawdown, drawdown);
    maxDrawdownPercent = Math.max(maxDrawdownPercent, drawdownPercent);
    
    equityCurve.push({
      date: trade.timestamp,
      equity,
      drawdown,
      drawdownPercent
    });
  }
  
  // Long/short bias
  const longTrades = closedTrades.filter(t => t.side === 'long');
  const shortTrades = closedTrades.filter(t => t.side === 'short');
  const totalTrades = longTrades.length + shortTrades.length;
  
  // Fee breakdown
  const totalFees = closedTrades.reduce((sum, t) => sum + (t.fees || 0), 0);
  const avgFeePerTrade = closedTrades.length > 0 ? totalFees / closedTrades.length : 0;
  
  return {
    summary: {
      totalTrades: filteredTrades.length,
      closedTrades: closedTrades.length,
      openTrades: filteredTrades.filter(t => t.status === 'open').length,
      winRate: closedTrades.length > 0 ? (winningTrades.length / closedTrades.length) * 100 : 0,
      totalPnL: closedTrades.reduce((sum, t) => sum + t.pnl, 0),
      avgWin: winningTrades.length > 0 ? winningTrades.reduce((sum, t) => sum + t.pnl, 0) / winningTrades.length : 0,
      avgLoss: losingTrades.length > 0 ? losingTrades.reduce((sum, t) => sum + t.pnl, 0) / losingTrades.length : 0,
      profitFactor: losingTrades.length > 0 && Math.abs(losingTrades.reduce((sum, t) => sum + t.pnl, 0)) > 0 ?
        winningTrades.reduce((sum, t) => sum + t.pnl, 0) / Math.abs(losingTrades.reduce((sum, t) => sum + t.pnl, 0)) : 0,
      maxDrawdown,
      maxDrawdownPercent,
      currentEquity: equity,
      peakEquity
    },
    bias: {
      longCount: longTrades.length,
      shortCount: shortTrades.length,
      longPercent: totalTrades > 0 ? (longTrades.length / totalTrades) * 100 : 0,
      shortPercent: totalTrades > 0 ? (shortTrades.length / totalTrades) * 100 : 0,
      longPnL: longTrades.reduce((sum, t) => sum + t.pnl, 0),
      shortPnL: shortTrades.reduce((sum, t) => sum + t.pnl, 0)
    },
    fees: {
      totalFees,
      avgFeePerTrade,
      feePercentOfPnL: equity !== 0 ? (totalFees / Math.abs(equity)) * 100 : 0
    },
    equityCurve,
    trades: filteredTrades
  };
}

// Display trade journal dashboard
function displayJournal(filters = {}) {
  const journal = loadJournal();
  const analytics = calculateAnalytics(journal.trades, filters);
  
  console.clear();
  console.log('');
  console.log('╔══════════════════════════════════════════════════════════════════╗');
  console.log('║           📓 DERIVERSE TRADE JOURNAL v1.0                        ║');
  console.log('╠══════════════════════════════════════════════════════════════════╣');
  console.log(`║  Total Trades: ${String(analytics.summary.totalTrades).padStart(5)}                                          ║`);
  console.log('╚══════════════════════════════════════════════════════════════════╝');
  console.log('');
  
  // Performance Summary
  console.log('┌─────────────────────────────────────────────────────────────────┐');
  console.log('│  📊 PERFORMANCE SUMMARY                                         │');
  console.log('├─────────────────────────────────────────────────────────────────┤');
  const pnlColor = analytics.summary.totalPnL >= 0 ? '\x1b[32m' : '\x1b[31m';
  const resetColor = '\x1b[0m';
  console.log(`│  Win Rate:          ${analytics.summary.winRate.toFixed(1).padStart(6)}%                                      │`);
  console.log(`│  Total P&L:         ${pnlColor}$${analytics.summary.totalPnL.toFixed(2).padStart(10)}${resetColor}                              │`);
  console.log(`│  Avg Win:           $${analytics.summary.avgWin.toFixed(2).padStart(10)}                              │`);
  console.log(`│  Avg Loss:          $${analytics.summary.avgLoss.toFixed(2).padStart(10)}                              │`);
  console.log(`│  Profit Factor:     ${analytics.summary.profitFactor.toFixed(2).padStart(10)}                              │`);
  console.log(`│  Max Drawdown:      $${analytics.summary.maxDrawdown.toFixed(2).padStart(10)} (${analytics.summary.maxDrawdownPercent.toFixed(1)}%)              │`);
  console.log(`│  Current Equity:    $${analytics.summary.currentEquity.toFixed(2).padStart(10)}                              │`);
  console.log('└─────────────────────────────────────────────────────────────────┘');
  console.log('');
  
  // Long/Short Bias
  console.log('┌─────────────────────────────────────────────────────────────────┐');
  console.log('│  ⚖️  LONG/SHORT BIAS                                            │');
  console.log('├─────────────────────────────────────────────────────────────────┤');
  console.log(`│  Long Trades:  ${String(analytics.bias.longCount).padStart(4)} (${analytics.bias.longPercent.toFixed(1)}%)    P&L: $${analytics.bias.longPnL.toFixed(2).padStart(10)}  │`);
  console.log(`│  Short Trades: ${String(analytics.bias.shortCount).padStart(4)} (${analytics.bias.shortPercent.toFixed(1)}%)    P&L: $${analytics.bias.shortPnL.toFixed(2).padStart(10)}  │`);
  
  // Visual bias bar
  const total = analytics.bias.longCount + analytics.bias.shortCount;
  if (total > 0) {
    const longBar = Math.round((analytics.bias.longCount / total) * 20);
    const shortBar = 20 - longBar;
    console.log(`│  ${'█'.repeat(longBar)}${'░'.repeat(shortBar)}  ${analytics.bias.longPercent > 50 ? 'LONG BIAS' : 'SHORT BIAS'}              │`);
  }
  console.log('└─────────────────────────────────────────────────────────────────┘');
  console.log('');
  
  // Fee Breakdown
  console.log('┌─────────────────────────────────────────────────────────────────┐');
  console.log('│  💸 FEE BREAKDOWN                                               │');
  console.log('├─────────────────────────────────────────────────────────────────┤');
  console.log(`│  Total Fees:        $${analytics.fees.totalFees.toFixed(2).padStart(10)}                              │`);
  console.log(`│  Avg Fee/Trade:     $${analytics.fees.avgFeePerTrade.toFixed(2).padStart(10)}                              │`);
  console.log(`│  Fees as % of P&L:  ${analytics.fees.feePercentOfPnL.toFixed(2).padStart(10)}%                              │`);
  console.log('└─────────────────────────────────────────────────────────────────┘');
  console.log('');
  
  // Recent Trades
  console.log('┌─────────────────────────────────────────────────────────────────┐');
  console.log('│  📝 RECENT TRADES (Last 10)                                     │');
  console.log('├─────────────────────────────────────────────────────────────────┤');
  console.log('│  Date        Symbol  Side   Entry    Exit     P&L      Status   │');
  console.log('├─────────────────────────────────────────────────────────────────┤');
  
  const recentTrades = analytics.trades
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
    .slice(0, 10);
  
  for (const trade of recentTrades) {
    const date = new Date(trade.timestamp).toLocaleDateString();
    const pnl = trade.pnl !== null ? 
      (trade.pnl >= 0 ? '\x1b[32m+' : '\x1b[31m') + '$' + trade.pnl.toFixed(2) + '\x1b[0m' : 'N/A';
    console.log(`│  ${date.padEnd(10)} ${trade.symbol.padEnd(6)} ${trade.side.padEnd(6)} $${String(trade.entryPrice || 0).padEnd(7)} $${String(trade.exitPrice || 0).padEnd(7)} ${pnl.padEnd(12)} ${trade.status.padEnd(7)} │`);
  }
  console.log('└─────────────────────────────────────────────────────────────────┘');
  console.log('');
  
  // Commands
  console.log('┌─────────────────────────────────────────────────────────────────┐');
  console.log('│  ⚡ QUICK ACTIONS                                               │');
  console.log('├─────────────────────────────────────────────────────────────────┤');
  console.log('│  • node src/trading/trade-journal.js add                        │');
  console.log('│  • node src/trading/trade-journal.js filter --symbol SOL        │');
  console.log('│  • node src/trading/trade-journal.js stats                      │');
  console.log('│  • node src/trading/trade-journal.js export                     │');
  console.log('└─────────────────────────────────────────────────────────────────┘');
  console.log('');
  
  // Export analytics
  fs.writeFileSync('trade-analytics.json', JSON.stringify(analytics, null, 2));
  console.log('💾 Analytics exported to trade-analytics.json');
}

// CLI interface
const command = process.argv[2];

switch (command) {
  case 'add':
    // Example trade - in real use, these would come from CLI args or API
    const exampleTrade = {
      symbol: 'SOL-PERP',
      side: 'long',
      entryPrice: 235.50,
      exitPrice: 240.00,
      size: 10,
      fees: 2.35,
      status: 'closed',
      tags: ['breakout', 'momentum'],
      notes: 'Entered on breakout above resistance'
    };
    const added = addTrade(exampleTrade);
    console.log('✅ Trade added:', added.id);
    console.log('P&L: $', added.pnl?.toFixed(2));
    break;
    
  case 'filter':
    const filters = {};
    if (process.argv.includes('--symbol')) {
      filters.symbol = process.argv[process.argv.indexOf('--symbol') + 1];
    }
    if (process.argv.includes('--side')) {
      filters.side = process.argv[process.argv.indexOf('--side') + 1];
    }
    displayJournal(filters);
    break;
    
  case 'stats':
    const journal = loadJournal();
    const stats = calculateAnalytics(journal.trades);
    console.log(JSON.stringify(stats.summary, null, 2));
    break;
    
  case 'export':
    const j = loadJournal();
    const a = calculateAnalytics(j.trades);
    fs.writeFileSync('trade-journal-export.json', JSON.stringify({
      journal: j,
      analytics: a
    }, null, 2));
    console.log('✅ Exported to trade-journal-export.json');
    break;
    
  default:
    displayJournal();
}
