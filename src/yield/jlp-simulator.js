#!/usr/bin/env node
/**
 * JLP Position Simulator
 * Simulates returns from JLP staking with various scenarios
 * 
 * Usage: node jlp-simulator.js <principal> <apy> <duration_days>
 * Example: node jlp-simulator.js 10000 14.5 365
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// JLP token price simulation (historical volatility ~5-15%)
const PRICE_SCENARIOS = {
  stable: { drift: 0, volatility: 0.02 },      // 2% volatility, no drift
  bullish: { drift: 0.15, volatility: 0.10 },  // 15% annual growth
  bearish: { drift: -0.15, volatility: 0.10 }, // 15% annual decline
  volatile: { drift: 0, volatility: 0.15 },    // High volatility
};

function calculateCompoundInterest(principal, apy, days, compoundFrequency = 365) {
  const rate = apy / 100;
  const periods = days / (365 / compoundFrequency);
  return principal * Math.pow(1 + rate / compoundFrequency, periods);
}

function simulatePricePath(startPrice, days, scenario) {
  const { drift, volatility } = PRICE_SCENARIOS[scenario];
  const dailyDrift = drift / 365;
  const dailyVol = volatility / Math.sqrt(365);
  
  let price = startPrice;
  const prices = [price];
  
  for (let i = 1; i <= days; i++) {
    const randomShock = (Math.random() - 0.5) * 2 * dailyVol;
    price = price * (1 + dailyDrift + randomShock);
    prices.push(price);
  }
  
  return prices;
}

function runMonteCarlo(principal, apy, days, iterations = 1000) {
  const results = [];
  
  for (let i = 0; i < iterations; i++) {
    const pricePath = simulatePricePath(1.0, days, 'stable');
    const endPrice = pricePath[pricePath.length - 1];
    
    // JLP value = principal * price appreciation + yield
    const yieldValue = calculateCompoundInterest(principal, apy, days) - principal;
    const priceReturn = principal * (endPrice - 1);
    const totalValue = principal + yieldValue + priceReturn;
    
    results.push({
      totalValue,
      yieldValue,
      priceReturn,
      roi: ((totalValue - principal) / principal) * 100
    });
  }
  
  // Sort for percentiles
  results.sort((a, b) => a.totalValue - b.totalValue);
  
  return {
    worst: results[Math.floor(iterations * 0.05)],
    p25: results[Math.floor(iterations * 0.25)],
    median: results[Math.floor(iterations * 0.5)],
    p75: results[Math.floor(iterations * 0.75)],
    best: results[Math.floor(iterations * 0.95)],
  };
}

function formatCurrency(value) {
  return '$' + value.toLocaleString('en-US', { 
    minimumFractionDigits: 2, 
    maximumFractionDigits: 2 
  });
}

function formatPercent(value) {
  return value.toFixed(2) + '%';
}

function main() {
  const principal = parseFloat(process.argv[2] || '10000');
  const apy = parseFloat(process.argv[3] || '14.5');
  const days = parseInt(process.argv[4] || '365');
  const simulations = parseInt(process.argv[5] || '1000');
  
  console.log('🌲 JLP Position Simulator');
  console.log('==========================');
  console.log(`Principal: ${formatCurrency(principal)}`);
  console.log(`APY: ${formatPercent(apy)}`);
  console.log(`Duration: ${days} days (${(days/365).toFixed(1)} years)`);
  console.log(`Simulations: ${simulations}`);
  console.log('');
  
  // Simple compound interest (no price change)
  const simpleYield = calculateCompoundInterest(principal, apy, days);
  const simpleProfit = simpleYield - principal;
  
  console.log('📊 Simple Yield Projection (no price change):');
  console.log(`  Final Value: ${formatCurrency(simpleYield)}`);
  console.log(`  Profit: ${formatCurrency(simpleProfit)}`);
  console.log(`  ROI: ${formatPercent((simpleProfit / principal) * 100)}`);
  console.log('');
  
  // Monthly breakdown
  console.log('📈 Monthly Yield Projection:');
  for (let month = 1; month <= Math.min(12, Math.ceil(days/30)); month++) {
    const monthDays = month * 30;
    if (monthDays > days) break;
    const value = calculateCompoundInterest(principal, apy, monthDays);
    const profit = value - principal;
    console.log(`  Month ${month.toString().padStart(2)}: ${formatCurrency(value)} (+${formatCurrency(profit)})`);
  }
  console.log('');
  
  // Monte Carlo simulation
  console.log('🎲 Running Monte Carlo Simulation...');
  const mc = runMonteCarlo(principal, apy, days, simulations);
  
  console.log('');
  console.log('📊 Monte Carlo Results (Price Scenarios):');
  console.log(`  5th percentile (worst):  ${formatCurrency(mc.worst.totalValue)} (${formatPercent(mc.worst.roi)})`);
  console.log(`  25th percentile:         ${formatCurrency(mc.p25.totalValue)} (${formatPercent(mc.p25.roi)})`);
  console.log(`  Median (50th):           ${formatCurrency(mc.median.totalValue)} (${formatPercent(mc.median.roi)})`);
  console.log(`  75th percentile:         ${formatCurrency(mc.p75.totalValue)} (${formatPercent(mc.p75.roi)})`);
  console.log(`  95th percentile (best):  ${formatCurrency(mc.best.totalValue)} (${formatPercent(mc.best.roi)})`);
  console.log('');
  
  // Risk metrics
  const downsideRisk = ((principal - mc.worst.totalValue) / principal) * 100;
  const upsidePotential = ((mc.best.totalValue - principal) / principal) * 100;
  
  console.log('⚠️  Risk Metrics:');
  console.log(`  Max Drawdown Risk: ${formatPercent(downsideRisk)}`);
  console.log(`  Upside Potential: ${formatPercent(upsidePotential)}`);
  console.log(`  Risk/Reward Ratio: 1:${(upsidePotential / downsideRisk).toFixed(1)}`);
  console.log('');
  
  // APY scenarios
  console.log('📉 APY Sensitivity Analysis:');
  const apyScenarios = [10, 12, 14.5, 17, 20];
  for (const scenarioApy of apyScenarios) {
    const value = calculateCompoundInterest(principal, scenarioApy, days);
    console.log(`  ${scenarioApy.toString().padStart(2)}% APY: ${formatCurrency(value)} (${formatPercent((value/principal - 1) * 100)} ROI)`);
  }
  console.log('');
  
  // Comparison to alternatives
  console.log('🏦 Comparison to Traditional Yields:');
  const alternatives = [
    { name: 'High Yield Savings', apy: 4.5 },
    { name: 'S&P 500 (avg)', apy: 10 },
    { name: 'JLP (current)', apy: apy },
  ];
  
  for (const alt of alternatives) {
    const value = calculateCompoundInterest(principal, alt.apy, days);
    console.log(`  ${alt.name.padEnd(20)}: ${formatCurrency(value)} (${alt.apy}% APY)`);
  }
}

if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log('JLP Position Simulator');
  console.log('======================');
  console.log('Usage: node jlp-simulator.js <principal> <apy> <days> [simulations]');
  console.log('');
  console.log('Examples:');
  console.log('  node jlp-simulator.js 10000 14.5 365     # $10k for 1 year');
  console.log('  node jlp-simulator.js 50000 14.5 730     # $50k for 2 years');
  console.log('  node jlp-simulator.js 10000 12 365 5000  # With 5000 simulations');
  process.exit(0);
}

main();
