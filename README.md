# Solana Agent Toolkit

> A comprehensive, open-source toolkit of 20+ JavaScript tools for Solana development. Built for AI agents and developers.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Solana](https://img.shields.io/badge/Solana-Devnet-blue)](https://solana.com)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green)](https://nodejs.org)

## 🚀 Quick Start

```bash
# Clone the repository
git clone https://github.com/ebreen/solana-agent-toolkit.git
cd solana-agent-toolkit

# Install dependencies
npm install

# Set up your wallet
cp wallet.example.json wallet.json
# Edit wallet.json with your keypair

# Start using the tools
node src/wallet/check-balance.js
```

## 📦 What's Included

### Wallet Operations
| Tool | Description |
|------|-------------|
| `check-balance.js` | Query SOL and token balances |
| `create-wallet.js` | Generate new Solana wallets |
| `transfer.js` | Transfer SOL between wallets |

### SPL Token Management
| Tool | Description |
|------|-------------|
| `create-token-mint.js` | Create new token mints |
| `mint-tokens.js` | Mint tokens to wallets |
| `transfer-tokens.js` | Transfer SPL tokens |

### Trading & DeFi
| Tool | Description |
|------|-------------|
| `check-prices.js` | Real-time price feeds via Jupiter |
| `portfolio.js` | Multi-token portfolio tracking |
| `arbitrage-scanner.js` | Detect price discrepancies |
| `swap-tokens.js` | Execute token swaps via Jupiter |
| `dashboard.js` | **Deriverse-style trading dashboard** with P&L tracking |
| `dashboard.html` | Web dashboard with Chart.js visualizations |

### Automation
| Tool | Description |
|------|-------------|
| `dca-bot.js` | Dollar-cost averaging automation |
| `monitor.js` | Balance and price monitoring |

### NFT Operations
| Tool | Description |
|------|-------------|
| `create-nft.js` | Mint NFTs with Metaplex Umi |
| `create-collection.js` | Batch mint NFT collections |

### Advanced Features
| Tool | Description |
|------|-------------|
| `escrow-tool.js` | Time-locked token escrows |
| `jlp-monitor.js` | Jupiter Liquidity Provider tracking |
| `yield-dashboard.js` | 6 yield opportunities with calculator |
| `position-tracker.js` | Real-time position monitoring |

## 💻 Usage Examples

### Check Balance
```bash
node src/wallet/check-balance.js
```

### Create a Token
```bash
node src/tokens/create-token-mint.js
```

### Mint Tokens
```bash
node src/tokens/mint-tokens.js <mint-address> <amount>
```

### Swap Tokens
```bash
node src/trading/swap-tokens.js SOL USDC 0.1
```

### Create NFT
```bash
node src/nft/create-nft.js "My NFT" "MNFT" "https://arweave.net/metadata.json" 5.5
```

### Track Yield Opportunities
```bash
node src/yield/yield-dashboard.js
node src/yield/yield-dashboard.js calc 10000
```

### Launch Trading Dashboard
```bash
# CLI version
node src/trading/dashboard.js

# Web version
open dashboard.html
```

## 🏗️ Architecture

```
solana-agent-toolkit/
├── src/
│   ├── wallet/           # Wallet operations
│   ├── tokens/           # SPL token management
│   ├── trading/          # Trading & DeFi tools
│   ├── nft/              # NFT operations
│   ├── yield/            # Yield tracking & monitoring
│   └── utils/            # Shared utilities
├── tests/                # Test suite
├── docs/                 # Documentation
├── examples/             # Usage examples
└── package.json
```

## 🔧 Requirements

- Node.js 18+
- Solana CLI (optional)
- A Solana wallet with devnet SOL

## 📚 Documentation

See individual tool files for detailed usage instructions.

## 🧪 Testing

All tools are tested on Solana devnet with real transactions.

## 🤖 AI-Agent Native

These tools are designed to be called programmatically by AI agents.

## 🌐 Network Support

- ✅ Devnet (fully tested)
- ✅ Testnet (supported)
- ⚠️ Mainnet (use with caution, test on devnet first)

## 🔐 Security

- No private keys committed to git
- Secure keypair management
- Comprehensive error handling
- Minimal external dependencies

## 📈 Roadmap

- [x] 19 core tools
- [ ] Yield rebalancer (auto-rebalance between sources)
- [ ] Liquidity bot (automated LP management)
- [ ] Governance voter (DAO voting automation)
- [ ] Airdrop claimer (automated claiming)
- [ ] Tax reporter (transaction history & reporting)

## 🤝 Contributing

Contributions welcome! Please read [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [Solana Foundation](https://solana.org) for grants and support
- [Jupiter](https://jup.ag) for swap and price APIs
- [Metaplex](https://metaplex.com) for NFT standards

---

**Built with ❤️ by AI agents, for AI agents and developers.**

*Note: This is experimental software. Use at your own risk. Always test on devnet before using on mainnet.*
