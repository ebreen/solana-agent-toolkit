// PDA Escrow Tool
// Creates time-locked token escrows using PDAs
// This is a client-side implementation using existing SPL token tools

import { 
  Connection, 
  PublicKey, 
  Keypair,
  SystemProgram,
  SYSVAR_CLOCK_PUBKEY,
  Transaction,
  sendAndConfirmTransaction
} from '@solana/web3.js';
import {
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  createTransferInstruction
} from '@solana/spl-token';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load wallet
const walletFile = JSON.parse(fs.readFileSync(path.join(__dirname, 'wallet.json'), 'utf-8'));
const secretKey = new Uint8Array(walletFile.secretKey);
const keypair = Keypair.fromSecretKey(secretKey);

const NETWORK = process.env.NETWORK || 'devnet';
const connection = new Connection(
  NETWORK === 'mainnet' 
    ? 'https://api.mainnet-beta.solana.com'
    : 'https://api.devnet.solana.com',
  'confirmed'
);

// Simple escrow state storage
const ESCROW_FILE = path.join(__dirname, 'escrows.json');

function loadEscrows() {
  try {
    return JSON.parse(fs.readFileSync(ESCROW_FILE, 'utf-8'));
  } catch {
    return [];
  }
}

function saveEscrows(escrows) {
  fs.writeFileSync(ESCROW_FILE, JSON.stringify(escrows, null, 2));
}

// Create a time-locked escrow
export async function createEscrow(recipient, mint, amount, unlockMinutes) {
  console.log(`🔒 Creating Escrow on ${NETWORK}...`);
  console.log(`   From: ${keypair.publicKey.toBase58()}`);
  console.log(`   To: ${recipient}`);
  console.log(`   Amount: ${amount}`);
  console.log(`   Unlocks in: ${unlockMinutes} minutes`);

  const recipientPubkey = new PublicKey(recipient);
  const mintPubkey = new PublicKey(mint);
  
  // Get token accounts
  const senderATA = await getAssociatedTokenAddress(mintPubkey, keypair.publicKey);
  const recipientATA = await getAssociatedTokenAddress(mintPubkey, recipientPubkey);
  
  // Check if recipient ATA exists, create if not
  const recipientAccount = await connection.getAccountInfo(recipientATA);
  const transaction = new Transaction();
  
  if (!recipientAccount) {
    console.log('   Creating recipient token account...');
    transaction.add(
      createAssociatedTokenAccountInstruction(
        keypair.publicKey,
        recipientATA,
        recipientPubkey,
        mintPubkey
      )
    );
  }

  // Calculate unlock time
  const unlockTime = Date.now() + (unlockMinutes * 60 * 1000);
  
  // Create transfer instruction (but don't execute yet - just prepare)
  // In a real PDA escrow, this would go to a vault PDA
  // For now, we'll simulate by holding the transfer locally
  
  const escrow = {
    id: `escrow-${Date.now()}`,
    sender: keypair.publicKey.toBase58(),
    recipient: recipient,
    mint: mint,
    amount: amount,
    createdAt: new Date().toISOString(),
    unlockTime: new Date(unlockTime).toISOString(),
    status: 'locked',
    senderATA: senderATA.toBase58(),
    recipientATA: recipientATA.toBase58()
  };

  // Save escrow
  const escrows = loadEscrows();
  escrows.push(escrow);
  saveEscrows(escrows);

  console.log('✅ Escrow Created!');
  console.log(`   ID: ${escrow.id}`);
  console.log(`   Unlocks: ${escrow.unlockTime}`);
  console.log('');
  console.log('⚠️  NOTE: This is a simulated escrow.');
  console.log('   Real PDA escrows require an on-chain program.');
  console.log('   To execute: node escrow-tool.js release ' + escrow.id);

  return escrow;
}

// Release an escrow after unlock time
export async function releaseEscrow(escrowId) {
  const escrows = loadEscrows();
  const escrow = escrows.find(e => e.id === escrowId);
  
  if (!escrow) {
    console.error('❌ Escrow not found:', escrowId);
    return;
  }

  if (escrow.status !== 'locked') {
    console.error('❌ Escrow already released or cancelled');
    return;
  }

  // Check unlock time
  const now = Date.now();
  const unlockTime = new Date(escrow.unlockTime).getTime();
  
  if (now < unlockTime) {
    const minutesLeft = Math.ceil((unlockTime - now) / 60000);
    console.error(`❌ Cannot release yet. ${minutesLeft} minutes remaining.`);
    return;
  }

  console.log(`🔓 Releasing Escrow ${escrowId}...`);
  console.log(`   To: ${escrow.recipient}`);
  console.log(`   Amount: ${escrow.amount}`);

  try {
    // Execute the transfer
    const mintPubkey = new PublicKey(escrow.mint);
    const senderATA = await getAssociatedTokenAddress(mintPubkey, keypair.publicKey);
    const recipientATA = new PublicKey(escrow.recipientATA);

    // Check decimals
    const mintInfo = await connection.getParsedAccountInfo(mintPubkey);
    const decimals = mintInfo.value.data.parsed.info.decimals;
    const amountRaw = BigInt(Math.floor(escrow.amount * Math.pow(10, decimals)));

    const transaction = new Transaction().add(
      createTransferInstruction(
        senderATA,
        recipientATA,
        keypair.publicKey,
        amountRaw
      )
    );

    const signature = await sendAndConfirmTransaction(
      connection,
      transaction,
      [keypair]
    );

    // Update escrow status
    escrow.status = 'released';
    escrow.releasedAt = new Date().toISOString();
    escrow.signature = signature;
    saveEscrows(escrows);

    console.log('✅ Escrow Released!');
    console.log(`   Signature: ${signature}`);
    console.log(`   Explorer: https://explorer.solana.com/tx/${signature}?cluster=${NETWORK}`);

  } catch (error) {
    console.error('❌ Release failed:', error.message);
  }
}

// List all escrows
export function listEscrows() {
  const escrows = loadEscrows();
  
  console.log(`📋 Escrows (${escrows.length} total)`);
  console.log('='.repeat(60));
  
  const now = Date.now();
  
  escrows.forEach(e => {
    const unlockTime = new Date(e.unlockTime).getTime();
    const isUnlocked = now >= unlockTime;
    const status = e.status === 'released' ? '✅ Released' : 
                   isUnlocked ? '🔓 Ready' : '🔒 Locked';
    
    console.log(`\n${e.id}`);
    console.log(`   Status: ${status}`);
    console.log(`   To: ${e.recipient}`);
    console.log(`   Amount: ${e.amount}`);
    console.log(`   Unlock: ${e.unlockTime}`);
    if (e.signature) {
      console.log(`   Tx: ${e.signature}`);
    }
  });
}

// CLI
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const command = args[0];

  switch (command) {
    case 'create':
      if (args.length < 4) {
        console.log('Usage: node escrow-tool.js create <recipient> <mint> <amount> <minutes>');
        process.exit(1);
      }
      createEscrow(args[1], args[2], parseFloat(args[3]), parseInt(args[4]));
      break;
    
    case 'release':
      if (args.length < 2) {
        console.log('Usage: node escrow-tool.js release <escrow-id>');
        process.exit(1);
      }
      releaseEscrow(args[1]);
      break;
    
    case 'list':
      listEscrows();
      break;
    
    default:
      console.log('PDA Escrow Tool');
      console.log('');
      console.log('Commands:');
      console.log('  create <recipient> <mint> <amount> <minutes>  Create time-locked escrow');
      console.log('  release <escrow-id>                           Release unlocked escrow');
      console.log('  list                                          Show all escrows');
      console.log('');
      console.log('Example:');
      console.log('  node escrow-tool.js create RECIPIENT_MINT MINT_ADDRESS 100 60');
  }
}
