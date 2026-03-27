# 🌊 JOMO Vault: Secure NEAR Staking & Custodial Ecosystem

[![Network](https://img.shields.io/badge/Network-NEAR_Mainnet-blue.svg)](https://near.org)
[![Security](https://img.shields.io/badge/Security-2FA_Secured-success.svg)]()
[![Status](https://img.shields.io/badge/Status-Operational-brightgreen.svg)]()

**JOMO Vault** is a highly secure, streamlined gateway to the **NEAR Protocol** ecosystem, built specifically for the Crypto JOMO community. It focuses entirely on safe asset management and sustainable yield generation through private staking, stripping away the noise of complex DeFi mechanics.

*"Stack crypto, ignore the noise. Steadily moving toward the goal!"*

## 🏢 Core Features

### 🔒 Secure Custodial Wallet
Maximum security within a personal, 2FA-protected dashboard.
* **Instant Onboarding:** A secure NEAR wallet is auto-generated upon registration. Keys are encrypted and managed seamlessly without the hassle of seed phrases for everyday use.
* **Zero Movement Fees:** Deposit and withdraw NEAR anytime. JOMO charges **0% platform fees** on standard wallet transfers. You only pay the microscopic network gas fees required by the NEAR blockchain.

### 📈 Private Staking (LiNEAR Protocol)
Put your NEAR to work safely. Stake assets directly via the LiNEAR liquid staking protocol to earn passive income.
* **Transparent Fee:** Only a flat 0.3% JOMO service fee is applied upon withdrawal from staking.
* **Network Unstake:** Standard unstaking utilizes the blockchain's native cooldown period of ~3 days (4 epochs).
* **Protocol Rules:** To ensure network stability, the protocol permits only one active unstake request per user at a time.

## 🛡️ Bulletproof Security Architecture
Security is the foundational layer of the JOMO Vault.
* **Mandatory 2FA:** Time-based One-Time Passwords (TOTP) via Authenticator apps are enforced for all custodial accounts. No login or critical action proceeds without confirmation.
* **Offline Recovery:** Secure, one-time 8-character recovery codes are generated client-side for emergency access.
* **AES-256 Encryption:** All sensitive data and private keys are encrypted at rest using military-grade standards.
* **Edge Execution:** Critical blockchain operations (wallet generation, transaction signing) run on isolated, highly secure serverless Edge Functions.

## 🚀 Roadmap
* [x] Seamless Custodial Wallet Generation
* [x] Mandatory 2FA & Security Architecture
* [x] Direct LiNEAR Staking Integration
* [ ] **Cloud Wallet (Non-Custodial):** The ultimate Web3 experience. Client-side encryption where the user holds the password and the Secret Recovery Phrase (Seed Phrase) as the ultimate backup. JOMO will have zero access to the funds.

## 🛠 Tech Stack
* **Frontend:** React, TypeScript, Vite, Bootstrap
* **Backend & Auth:** Supabase (PostgreSQL, Auth, RPC)
* **Serverless / Edge:** Deno (Supabase Edge Functions)
* **Blockchain Interaction:** `near-api-js`, NEAR Protocol, LiNEAR Smart Contracts

## 📜 License

This project is licensed under the **MIT License**. This means you are free to use, copy, modify, and distribute the code, provided that the original license and copyright notice are included.

For more details, please see the [LICENSE](./LICENSE) file.

---
**Disclaimer:** *This software is provided "as is", without warranty of any kind. Use at your own risk. Cryptocurrencies are subject to high market risks. The Crypto JOMO team is not responsible for any financial losses incurred through the use of this protocol or loss of account credentials.*