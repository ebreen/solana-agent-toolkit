// Solana Transaction Parser
// Makes Solana transactions human-readable

import { Connection, clusterApiUrl } from '@solana/web3.js';
import fs from 'fs';

const NETWORK = process.env.NETWORK || 'devnet';
const connection = new Connection(clusterApiUrl(NETWORK), 'confirmed');

// Instruction name mapping for common programs
const PROGRAM_NAMES = {
  '11111111111111111111111111111111': 'System Program',
  'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA': 'Token Program',
  'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL': 'Associated Token Account',
  'MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr': 'Memo Program',
  'ComputeBudget111111111111111111111111111111': 'Compute Budget',
  'JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4': 'Jupiter Aggregator',
  '6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P': 'Pump.fun',
};

const INSTRUCTION_NAMES = {
  '11111111111111111111111111111111': {
    0: 'Create Account',
    1: 'Assign',
    2: 'Transfer',
    3: 'Create Account With Seed',
    4: 'Advance Nonce',
    5: 'Withdraw Nonce',
    6: 'Initialize Nonce',
    7: 'Authorize Nonce',
    8: 'Allocate',
    9: 'Allocate With Seed',
    10: 'Assign With Seed',
    11: 'Transfer With Seed',
    12: 'Upgrade Nonce',
  },
  'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA': {
    0: 'Initialize Mint',
    1: 'Initialize Account',
    2: 'Initialize Multisig',
    3: 'Transfer',
    4: 'Approve',
    5: 'Revoke',
    6: 'Set Authority',
    7: 'Mint To',
    8: 'Burn',
    9: 'Close Account',
    10: 'Freeze Account',
    11: 'Thaw Account',
    12: 'Transfer Checked',
    13: 'Approve Checked',
    14: 'Mint To Checked',
    15: 'Burn Checked',
    16: 'Initialize Account 2',
    17: 'Sync Native',
    18: 'Initialize Account 3',
    19: 'Initialize Multisig 2',
    20: 'Mint To Checked 2',
  },
};

async function parseTransaction(signature) {
  console.log(`🔍 Parsing Transaction: ${signature}`);
  console.log('=' .repeat(70));
  
  try {
    const tx = await connection.getParsedTransaction(signature, {
      commitment: 'confirmed',
      maxSupportedTransactionVersion: 0,
    });
    
    if (!tx) {
      console.log('❌ Transaction not found');
      return;
    }
    
    // Basic info
    console.log('\n📋 Basic Information');
    console.log('-'.repeat(70));
    console.log(`Signature: ${signature}`);
    console.log(`Slot: ${tx.slot}`);
    console.log(`Block Time: ${tx.blockTime ? new Date(tx.blockTime * 1000).toISOString() : 'Unknown'}`);
    console.log(`Status: ${tx.meta?.err ? '❌ Failed' : '✅ Success'}`);
    
    if (tx.meta?.err) {
      console.log(`Error: ${JSON.stringify(tx.meta.err)}`);
    }
    
    // Fee
    console.log(`\n💰 Fee: ${(tx.meta?.fee || 0) / 1e9} SOL`);
    
    // Accounts
    console.log('\n👥 Accounts Involved');
    console.log('-'.repeat(70));
    tx.transaction.message.accountKeys.forEach((acc, i) => {
      const signer = acc.signer ? '✓' : ' ';
      const writable = acc.writable ? '✓' : ' ';
      console.log(`  [${i}] ${acc.pubkey.toString()} (signer:${signer} writable:${writable})`);
    });
    
    // Instructions
    console.log('\n📜 Instructions');
    console.log('-'.repeat(70));
    
    tx.transaction.message.instructions.forEach((ix, i) => {
      console.log(`\n  Instruction ${i + 1}:`);
      
      const programId = ix.programId.toString();
      const programName = PROGRAM_NAMES[programId] || programId.slice(0, 20) + '...';
      console.log(`    Program: ${programName}`);
      console.log(`    Program ID: ${programId}`);
      
      // Try to decode instruction
      if ('parsed' in ix) {
        console.log(`    Type: ${ix.parsed.type}`);
        console.log(`    Info: ${JSON.stringify(ix.parsed.info, null, 6)}`);
      } else {
        console.log(`    Data: ${ix.data}`);
        console.log(`    Accounts: ${ix.accounts.join(', ')}`);
      }
    });
    
    // Token balances
    if (tx.meta?.postTokenBalances?.length > 0) {
      console.log('\n🪙 Token Balance Changes');
      console.log('-'.repeat(70));
      
      tx.meta.postTokenBalances.forEach((post, i) => {
        const pre = tx.meta.preTokenBalances?.find(p => p.accountIndex === post.accountIndex);
        const preAmount = pre?.uiTokenAmount?.uiAmount || 0;
        const postAmount = post.uiTokenAmount.uiAmount;
        const change = postAmount - preAmount;
        
        if (change !== 0) {
          const changeStr = change > 0 ? `+${change}` : `${change}`;
          console.log(`  Account ${post.accountIndex}: ${changeStr} ${post.mint.slice(0, 20)}...`);
        }
      });
    }
    
    // SOL balance changes
    if (tx.meta?.preBalances && tx.meta?.postBalances) {
      console.log('\n💎 SOL Balance Changes');
      console.log('-'.repeat(70));
      
      tx.meta.postBalances.forEach((post, i) => {
        const pre = tx.meta.preBalances[i];
        const change = (post - pre) / 1e9;
        
        if (change !== 0) {
          const changeStr = change > 0 ? `+${change.toFixed(9)}` : `${change.toFixed(9)}`;
          console.log(`  Account ${i}: ${changeStr} SOL`);
        }
      });
    }
    
    // Log summary
    console.log('\n✅ Transaction parsed successfully');
    console.log(`\nExplorer: https://explorer.solana.com/tx/${signature}?cluster=${NETWORK}`);
    
    return tx;
    
  } catch (error) {
    console.error('❌ Error parsing transaction:', error.message);
  }
}

// CLI
if (import.meta.url === `file://${process.argv[1]}`) {
  const signature = process.argv[2];
  
  if (!signature) {
    console.log('Usage: node tx-parser.js <transaction-signature>');
    console.log('');
    console.log('Example:');
    console.log('  node tx-parser.js 5UfgJ5P3...');
    process.exit(1);
  }
  
  parseTransaction(signature);
}

export { parseTransaction };
