// Yield Aggregator Dashboard
// Tracks multiple earning opportunities on Solana

import { Connection, PublicKey } from '@solana/web3.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const NETWORK = process.env.NETWORK || 'mainnet';

// Token mints
const TOKENS = {
  SOL: 'So11111111111111111111111111111111111111112',
  USDC: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  JLP: '27G8MtK7VtTcCHkpASjSDdkWWYfoqT6ggEuKidVJidD4',
  mSOL: 'mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So',
  jitoSOL: 'J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn',
  INF: '5oVNBeEEQvYi1cX3ir8Dx5n1P7pdxydbGF2X6TxNxUFE'
};

// Yield opportunities database
const YIELD_OPPORTUNITIES = [
  {
    name: 'JLP (Jupiter Perps)',
    token: 'JLP',
    apyMin: 7,
    apyMax: 20,
    risk: 'Medium',
    description: 'Provide liquidity to Jupiter Perps, earn trading fees + SOL staking',
    url: 'https://jup.ag/perps',
    pros: ['Single token', 'Auto-compounding', 'Can borrow against'],
    cons: ['Trader PnL risk', 'Smart contract risk']
  },
  {
    name: 'Marinade Staking',
    token: 'mSOL',
    apyMin: 6,
    apyMax: 8,
    risk: 'Low',
    description: 'Liquid staking, receive mSOL while earning staking rewards',
    url: 'https://marinade.finance',
    pros: ['Liquid staking', 'DeFi composable', 'Low risk'],
    cons: ['Validator risk', 'Lower yield']
  },
  {
    name: 'Jito Staking',
    token: 'jitoSOL',
    apyMin: 7,
    apyMax: 9,
    risk: 'Low',
    description: 'Liquid staking with MEV rewards',
    url: 'https://jito.network',
    pros: ['MEV rewards', 'Liquid staking', 'Low risk'],
    cons: ['Validator risk']
  },
  {
    name: 'Sanctum INF',
    token: 'INF',
    apyMin: 8,
    apyMax: 10,
    risk: 'Low-Medium',
    description: 'Multi-LST strategy combining staking yields with LP fees',
    url: 'https://sanctum.so',
    pros: ['Highest LST yield', 'Diversified', 'Auto-rebalancing'],
    cons: ['Newer protocol', 'Complex strategy']
  },
  {
    name: 'Kamino Lending',
    token: 'USDC',
    apyMin: 4,
    apyMax: 12,
    risk: 'Low-Medium',
    description: 'Lend USDC to earn interest from borrowers',
    url: 'https://kamino.finance',
    pros: ['Stablecoin yield', 'Variable rates', 'Liquidity'],
    cons: ['Borrower default risk', 'Rate fluctuations']
  },
  {
    name: 'Drift Perps LP',
    token: 'SOL',
    apyMin: 5,
    apyMax: 15,
    risk: 'Medium',
    description: 'Provide liquidity to Drift perpetuals exchange',
    url: 'https://drift.trade',
    pros: ['Perp exposure', 'High volume', 'Established'],
    cons: ['Market making risk', 'IL possible']
  }
];

function calculateYield(principal, apy, days = 365) {
  const rate = apy / 100;
  const time = days / 365;
  return principal * rate * time;
}

function showDashboard() {
  console.log('💰 Solana Yield Aggregator Dashboard');
  console.log('=' .repeat(60));
  console.log('');
  
  // Summary table
  console.log('📊 Opportunities Summary');
  console.log('-'.repeat(60));
  console.log('Name                APY Range     Risk       Token');
  console.log('-'.repeat(60));
  
  YIELD_OPPORTUNITIES.forEach(opp => {
    const name = opp.name.padEnd(18);
    const apy = `${opp.apyMin}-${opp.apyMax}%`.padEnd(13);
    const risk = opp.risk.padEnd(10);
    console.log(`${name} ${apy} ${risk} ${opp.token}`);
  });
  
  console.log('');
  console.log('💡 Recommendations by Risk Profile');
  console.log('-'.repeat(60));
  
  const lowRisk = YIELD_OPPORTUNITIES.filter(o => o.risk === 'Low');
  const medRisk = YIELD_OPPORTUNITIES.filter(o => o.risk.includes('Medium'));
  
  console.log('Low Risk (Conservative):');
  lowRisk.forEach(o => console.log(`  • ${o.name}: ${o.apyMin}-${o.apyMax}% APY`));
  
  console.log('');
  console.log('Medium Risk (Balanced):');
  medRisk.forEach(o => console.log(`  • ${o.name}: ${o.apyMin}-${o.apyMax}% APY`));
}

function showCalculator(principal = 10000) {
  console.log('');
  console.log(`💵 Yield Calculator (Principal: $${principal.toLocaleString()})`);
  console.log('=' .repeat(60));
  console.log('Strategy                APY     Daily      Monthly    Yearly');
  console.log('-'.repeat(60));
  
  YIELD_OPPORTUNITIES.forEach(opp => {
    const apy = (opp.apyMin + opp.apyMax) / 2; // Use average
    const yearly = calculateYield(principal, apy);
    const monthly = yearly / 12;
    const daily = yearly / 365;
    
    const name = opp.name.padEnd(22);
    const apyStr = `${apy.toFixed(1)}%`.padEnd(7);
    const dailyStr = `$${daily.toFixed(2)}`.padEnd(10);
    const monthlyStr = `$${monthly.toFixed(2)}`.padEnd(11);
    const yearlyStr = `$${yearly.toFixed(2)}`;
    
    console.log(`${name}${apyStr}${dailyStr}${monthlyStr}${yearlyStr}`);
  });
  
  console.log('');
  console.log('📈 Combined Strategy Example:');
  console.log('  40% JLP (12% APY) + 40% INF (9% APY) + 20% Kamino (8% APY)');
  const blended = (principal * 0.4 * 0.12) + (principal * 0.4 * 0.09) + (principal * 0.2 * 0.08);
  console.log(`  Blended APY: ${((blended/principal)*100).toFixed(2)}%`);
  console.log(`  Yearly yield: $${blended.toFixed(2)}`);
}

function showDetails(name) {
  const opp = YIELD_OPPORTUNITIES.find(o => 
    o.name.toLowerCase().includes(name.toLowerCase())
  );
  
  if (!opp) {
    console.log(`❌ Opportunity "${name}" not found`);
    return;
  }
  
  console.log(`\n📋 ${opp.name}`);
  console.log('=' .repeat(60));
  console.log(`Description: ${opp.description}`);
  console.log(`APY Range: ${opp.apyMin}% - ${opp.apyMax}%`);
  console.log(`Risk Level: ${opp.risk}`);
  console.log(`Token: ${opp.token}`);
  console.log(`URL: ${opp.url}`);
  console.log('');
  console.log('✅ Pros:');
  opp.pros.forEach(p => console.log(`  • ${p}`));
  console.log('');
  console.log('⚠️  Cons:');
  opp.cons.forEach(c => console.log(`  • ${c}`));
}

// CLI
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const command = args[0];

  switch (command) {
    case 'calc':
      const principal = parseFloat(args[1]) || 10000;
      showCalculator(principal);
      break;
    
    case 'details':
      if (args[1]) {
        showDetails(args[1]);
      } else {
        console.log('Usage: node yield-dashboard.js details <opportunity-name>');
      }
      break;
    
    case 'dashboard':
    default:
      showDashboard();
      if (!command || command === 'dashboard') {
        showCalculator(10000);
      }
  }
}

export { YIELD_OPPORTUNITIES, calculateYield };
