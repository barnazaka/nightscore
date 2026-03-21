# NightScore — Privacy-Preserving Credit Oracle on Midnight

NightScore is a credit attestation protocol built on the Midnight Network.
It solves the core problem blocking undercollateralized DeFi lending: how
do you prove someone is creditworthy without exposing their financial data?

## The Problem

Over 90% of DeFi loans are overcollateralized. Protocols have no way to
assess creditworthiness without doxxing borrowers. This locks out billions
of people globally — especially in emerging markets — who have real
financial track records but no large crypto collateral to post.

## How NightScore Solves It

Using Midnight's ZK proof architecture:

1. A borrower privately inputs their financial history (repayments,
   wallet age, volume, default count) into the local client
2. A Compact circuit computes their credit tier (Bronze, Silver, Gold)
   from this private data
3. A ZK proof is generated proving the computation was correct
4. Only the credit tier is written to the public Midnight ledger —
   the raw financial data never leaves the borrower's device
5. Any DeFi protocol on Midnight can read the public attestation and
   offer undercollateralized loans accordingly

![NightScore circuits compiled](pic/Screenshot%202026-03-21%20at%2011.35.31.png)

## Credit Tiers

| Tier   | Repayments | Wallet Age  | Volume | Max Loan |
|--------|-----------|-------------|--------|----------|
| Bronze | 3+        | 30+ days    | $1K+   | $500     |
| Silver | 10+       | 180+ days   | $10K+  | $5,000   |
| Gold   | 20+       | 365+ days   | $50K+  | $50,000  |

## What Makes This Different

Every existing on-chain credit protocol (Goldfinch, RociFi, Credix)
requires the borrower to reveal their financial data to a third party
for off-chain assessment. NightScore eliminates the trusted third party
entirely. The proof IS the assessment.

## Getting Started

### Prerequisites
- Node.js v22.15+
- Docker with docker compose
- Compact devtools:
```bash
  curl --proto '=https' --tlsv1.2 -LsSf https://github.com/midnightntwrk/compact/releases/latest/download/compact-installer.sh | sh
  source $HOME/.local/bin/env
  compact update 0.28.0
```

### Install
```bash
npm install
```

### Build the contract
```bash
cd contract
npm run compact
```

### Run the CLI
```bash
cd nightscore-cli
npx tsx src/index.ts
```

![NightScore CLI output](pic/Screenshot%202026-03-21%20at%2011.39.06.png)

## Built With
- Midnight Network SDK (midnight-js)
- Compact smart contract language
- ZK proof generation via the Midnight proof server
