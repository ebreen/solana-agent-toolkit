// NFT Minter using Metaplex Umi
// Creates an NFT with metadata on Solana

import { createUmi } from '@metaplex-foundation/umi-bundle-defaults';
import { 
  createNft,
  mplTokenMetadata 
} from '@metaplex-foundation/mpl-token-metadata';
import { 
  generateSigner, 
  percentAmount,
  signerIdentity,
  createSignerFromKeypair
} from '@metaplex-foundation/umi';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load wallet
const walletPath = process.env.WALLET_PATH || path.join(__dirname, 'wallet.json');
const walletFile = JSON.parse(fs.readFileSync(walletPath, 'utf-8'));
const secretKey = new Uint8Array(walletFile.secretKey);

// Configuration
const NETWORK = process.env.NETWORK || 'devnet';
const RPC_URL = NETWORK === 'mainnet' 
  ? 'https://api.mainnet-beta.solana.com'
  : 'https://api.devnet.solana.com';

export async function createNFT(name, symbol, uri, options = {}) {
  console.log(`🎨 Creating NFT on ${NETWORK}...`);
  console.log(`   Name: ${name}`);
  console.log(`   Symbol: ${symbol}`);
  console.log(`   URI: ${uri}`);

  // Create Umi instance
  const umi = createUmi(RPC_URL);
  
  // Create signer from keypair using Umi's eddsa
  const umiKeypair = umi.eddsa.createKeypairFromSecretKey(secretKey);
  const signer = createSignerFromKeypair(umi, umiKeypair);
  umi.use(signerIdentity(signer));
  umi.use(mplTokenMetadata());

  // Generate mint signer
  const mint = generateSigner(umi);

  try {
    // Create NFT
    const result = await createNft(umi, {
      mint,
      name,
      symbol,
      uri,
      sellerFeeBasisPoints: percentAmount(options.royalty || 5.5), // 5.5% royalty
      creators: options.creators || [
        { address: signer.publicKey, verified: true, share: 100 }
      ],
    }).sendAndConfirm(umi);

    const mintAddress = mint.publicKey.toString();
    
    console.log('✅ NFT Created Successfully!');
    console.log(`   Mint Address: ${mintAddress}`);
    console.log(`   Signature: ${result.signature}`);
    console.log(`   Explorer: https://explorer.solana.com/address/${mintAddress}?cluster=${NETWORK}`);

    // Save to file
    const nftData = {
      name,
      symbol,
      uri,
      mint: mintAddress,
      signature: result.signature.toString(),
      network: NETWORK,
      createdAt: new Date().toISOString()
    };
    
    const outputPath = path.join(__dirname, `nft-${Date.now()}.json`);
    fs.writeFileSync(outputPath, JSON.stringify(nftData, null, 2));
    console.log(`   Saved to: ${outputPath}`);

    return nftData;
  } catch (error) {
    console.error('❌ Error creating NFT:', error.message);
    if (error.logs) {
      console.error('   Logs:', error.logs);
    }
    throw error;
  }
}

// CLI usage
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  
  if (args.length < 3) {
    console.log('Usage: node create-nft.js <name> <symbol> <uri> [royalty]');
    console.log('');
    console.log('Example:');
    console.log('  node create-nft.js "My First NFT" "MFN" "https://arweave.net/xxx" 5.5');
    console.log('');
    console.log('Note: URI should point to metadata JSON following Metaplex standard');
    console.log('');
    console.log('Metadata JSON format:');
    console.log(JSON.stringify({
      name: "My NFT #1",
      symbol: "MNFT",
      description: "A unique digital asset",
      image: "https://arweave.net/xxx",
      attributes: [
        { trait_type: "Background", value: "Blue" },
        { trait_type: "Rarity", value: "Rare" }
      ],
      properties: {
        files: [{ uri: "https://arweave.net/xxx", type: "image/png" }],
        creators: [{ address: "...", share: 100 }]
      }
    }, null, 2));
    process.exit(1);
  }

  const [name, symbol, uri, royalty] = args;
  
  createNFT(name, symbol, uri, { royalty: parseFloat(royalty) || 5.5 })
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}
