import { Connection, clusterApiUrl, PublicKey } from '@solana/web3.js';
import fs from 'fs';

// Jupiter API endpoints
const JUPITER_API = 'https://quote-api.jup.ag/v6';

const wallet = JSON.parse(fs.readFileSync('wallet.json', 'utf8'));

console.log('💰 Solana Token Price Checker');
console.log('==============================');
console.log('Wallet:', wallet.publicKey);
console.log('');

// Common token mints on Solana
const TOKENS = {
  SOL: 'So11111111111111111111111111111111111111112',
  USDC: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  USDT: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
  BONK: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
  JUP: 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN',
  RAY: '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R',
  ORCA: 'orcaEKTdK7LKz57vaAYr9QeNsVEPfiu6QeMU1kektZE',
};

async function getQuote(inputMint, outputMint, amount = 1000000000) {
  try {
    const response = await fetch(
      `${JUPITER_API}/quote?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amount}&slippageBps=50`
    );
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    return await response.json();
  } catch (err) {
    console.error('Error fetching quote:', err.message);
    return null;
  }
}

async function main() {
  console.log('Fetching prices...\n');
  
  // Get SOL price in USDC
  const solQuote = await getQuote(TOKENS.SOL, TOKENS.USDC);
  if (solQuote) {
    const solPrice = solQuote.outAmount / 10**6; // USDC has 6 decimals
    console.log(`SOL Price: $${solPrice.toFixed(2)}`);
    console.log(`  Route: ${solQuote.routePlan?.length || 0} hops`);
    console.log(`  Slippage: ${solQuote.slippageBps / 100}%`);
    console.log('');
  }
  
  // Get JUP price in USDC
  const jupQuote = await getQuote(TOKENS.JUP, TOKENS.USDC, 1000000000); // 1 JUP
  if (jupQuote) {
    const jupPrice = jupQuote.outAmount / 10**6;
    console.log(`JUP Price: $${jupPrice.toFixed(4)}`);
    console.log('');
  }
  
  // Get BONK price (1M BONK in USDC)
  const bonkQuote = await getQuote(TOKENS.BONK, TOKENS.USDC, 1000000000); // 1000 BONK
  if (bonkQuote) {
    const bonkPricePerM = (bonkQuote.outAmount / 10**6) * 1000;
    console.log(`BONK Price: $${bonkPricePerM.toFixed(6)} per 1M tokens`);
    console.log('');
  }
  
  console.log('✅ Price check complete!');
  console.log('');
  console.log('To execute a swap, use the swap script.');
}

main().catch(console.error);
