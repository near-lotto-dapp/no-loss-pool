# 🌊 JOMO No-Loss Pool

[![Network](https://img.shields.io/badge/Network-NEAR_Mainnet-blue.svg)](https://near.org)
[![Protocol](https://img.shields.io/badge/Powered_by-LiNEAR-success.svg)](https://linearprotocol.org/)
[![Status](https://img.shields.io/badge/Status-Operational-brightgreen.svg)]()

**JOMO No-Loss Pool** is a decentralized, no-loss prize protocol built on the **NEAR Protocol** exclusively for the Crypto JOMO community.

*"Stack crypto, ignore the noise. Steadily moving toward the goal!"*

## 💡 How It Works
Unlike traditional lotteries where your ticket cost is lost, the JOMO Pool uses **Liquid Staking** to ensure you never lose your principal deposit.

1. **Stake NEAR:** Users deposit NEAR into the smart contract (Minimum: 10 NEAR). Your active balance acts as your ticket.
2. **Generate Yield:** The smart contract automatically routes all deposited NEAR into the **LiNEAR Protocol**, where it generates a constant yield (~8.4% APY).
3. **Win the Jackpot:** Periodically, a smart-contract algorithm randomly selects one winning ticket. The winner receives **97% of the total generated yield**.
4. **No-Loss Guarantee:** If you don't win, you lose nothing! You keep 100% of your initial deposit and automatically participate in the next draw.

## ✨ Key Features
* 🔒 **Non-Custodial:** The contract only manages the logic. All funds are backed by LiNEAR liquid staking.
* 🎲 **On-Chain Randomness:** Winners are selected using NEAR's native, secure on-chain random seed generation.
* ⏱️ **Two-Step Withdrawal:** True DeFi architecture. Unstaking initiates a 3-day (4 epochs) cooldown period, after which users can securely claim their liquid NEAR.
* 🤖 **Autonomous Execution:** Draws and yield distribution are handled purely on-chain.

## 🛠 Tech Stack
* **Smart Contract:** Rust (`near-sdk-rs`)
* **Frontend:** React, Next.js, TypeScript
* **Wallet Integration:** NEAR Wallet Selector
* **DeFi Integration:** LiNEAR Protocol Cross-Contract Calls

## 🚀 Getting Started (Local Development)

### Prerequisites
* Node.js (v18+)
* Rust & Cargo
* NEAR CLI (`cargo-near`)

### Installation
1. Clone the repository:
   ```bash
   git clone [https://github.com/crypto-jomo/crypto-jomo-pool.git](https://github.com/crypto-jomo/crypto-jomo-pool.git)
   cd crypto-jomo-pool
Install frontend dependencies:

Bash
npm install
Run the development server:

Bash
npm run dev
Smart Contract Deployment
To compile and deploy the smart contract to NEAR Mainnet:

Bash
cargo near build non-reproducible-wasm
near contract deploy <YOUR_POOL_ADDRESS>.near use-file target/near/back.wasm without-init-call network-config mainnet sign-with-keychain send
📜 Smart Contract Address
Mainnet: jomo-pool-v2.near

⚠️ Disclaimer
This protocol is provided "as is". JOMO Pool is a decentralized application. By using it, you acknowledge that you are responsible for your own funds. Please read the full Terms & Conditions on our website.