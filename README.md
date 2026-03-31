# NightScore Credit Oracle 00000000

Privacy-preserving credit attestation on the Midnight Network.

## Prerequisites:
- Node.js v22+
- Docker Desktop running
- Compact compiler installed:
  ```bash
  curl --proto '=https' --tlsv1.2 -LsSf https://github.com/midnightntwrk/compact/releases/latest/download/compact-installer.sh | sh
  source $HOME/.local/bin/env
  compact update 0.28.0
  ```

## Steps to deploy and run:

1. **Clone the repo and install dependencies:**
   ```bash
   git clone https://github.com/barnazaka/nightscore
   cd nightscore
   npm install
   ```

2. **Start the proof server in a separate terminal and keep it running:**
   ```bash
   npm run start-proof-server
   ```
   Wait until you see: "listening on: 0.0.0.0:6300"

3. **Compile the Compact contract:**
   ```bash
   npm run compile
   ```

4. **Deploy to Preprod testnet:**
   ```bash
   npm run deploy
   ```
   - Choose option 1 to create a new wallet
   - **SAVE** the seed phrase displayed
   - Copy your wallet address
   - Visit [https://faucet.preprod.midnight.network/](https://faucet.preprod.midnight.network/) and request tNight tokens using your address
   - The script will automatically detect funds, register for DUST, and deploy the contract
   - Copy the contract address from the output

5. **Interact with the deployed contract:**
   ```bash
   npm run interact
   ```
   - The script restores your wallet from `deployment.json`
   - Choose to register a credit score
   - Enter a private score (Financial data like repayments, age, volume, defaults)
   - A ZK proof is generated locally proving your score is valid
   - Only your tier (BRONZE/SILVER/GOLD) is disclosed on-chain
   - The transaction is submitted to Preprod and confirmed
