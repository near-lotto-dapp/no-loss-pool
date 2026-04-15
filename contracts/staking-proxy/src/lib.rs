use near_sdk::near;
use near_sdk::store::IterableMap;
use near_sdk::json_types::U128;
use near_sdk::{env, log, AccountId, Gas, NearToken, Promise, PromiseOrValue, PromiseError, ext_contract, require};

pub type Balance = u128;

// Gas constants for cross-contract calls
const GAS_FOR_STAKING: Gas = Gas::from_tgas(150);
const GAS_FOR_CALLBACK: Gas = Gas::from_tgas(30);
const GAS_FOR_FT_TRANSFER: Gas = Gas::from_tgas(15);

// --- Constants ---
const JOMO_FEE_BPS: u128 = 0;

// --- Cross-Contract Interfaces ---

#[ext_contract(ext_validator)]
pub trait ExtValidator {
    fn deposit_and_stake(&mut self) -> U128;
    fn instant_unstake(&mut self, amount: U128) -> U128;
    fn withdraw(&mut self, amount: U128) -> U128;
    fn unstake(&mut self, amount: U128);
}

#[ext_contract(ext_nep141)]
pub trait ExtNep141 {
    fn ft_transfer(&mut self, receiver_id: AccountId, amount: U128, memo: Option<String>);
}

#[ext_contract(ext_self)]
pub trait ExtSelf {
    fn on_deposit_and_stake(&mut self, user_id: AccountId, provider_id: AccountId, deposited_amount: Balance) -> bool;
    fn on_instant_withdraw(&mut self, user_id: AccountId, provider_id: AccountId, shares_burned: Balance) -> PromiseOrValue<()>;
    fn on_delayed_withdraw(&mut self, user_id: AccountId, provider_id: AccountId, shares_amount: Balance, fee_shares: Balance) -> bool;
    fn on_delayed_unstake(&mut self, user_id: AccountId, provider_id: AccountId, shares_burned: Balance) -> bool;
    fn on_withdraw(&mut self, user_id: AccountId, provider_id: AccountId) -> PromiseOrValue<()>;
}

// --- Data Structures ---

#[near(serializers = [borsh, json])]
#[derive(Clone, Debug)]
pub struct UnstakeRequest {
    pub provider_id: AccountId,
    pub amount: Balance,
    pub initial_deposit_value: Balance,
    pub unlock_epoch: u64,
    pub is_claimed: bool,
}

#[near(serializers = [borsh, json])]
#[derive(Clone, Debug)]
pub struct StakingProvider {
    pub provider_id: AccountId,
    pub total_staked: Balance,
    pub is_active: bool,
}

#[near(serializers = [borsh, json])]
#[derive(Clone, Debug, Default)]
pub struct UserMetrics {
    pub total_deposited: Balance,
    pub total_withdrawn: Balance,
}

#[near(contract_state)]
pub struct JomoStakingProxy {
    pub owner_id: AccountId,
    pub fee_collector_id: AccountId,
    pub providers: IterableMap<AccountId, StakingProvider>,
    pub user_unstake_requests: IterableMap<AccountId, UnstakeRequest>,
    pub user_shares: IterableMap<String, Balance>,
    pub user_metrics: IterableMap<AccountId, UserMetrics>,
}

impl Default for JomoStakingProxy {
    fn default() -> Self {
        env::panic_str("Contract should be initialized before usage")
    }
}

#[near]
impl JomoStakingProxy {
    #[init]
    pub fn new(owner_id: AccountId, fee_collector_id: AccountId) -> Self {
        require!(!env::state_exists(), "Already initialized");
        log!("Initialized JomoStakingProxy with owner: {}, fee_collector: {}", owner_id, fee_collector_id);
        Self {
            owner_id,
            fee_collector_id,
            providers: IterableMap::new(b"p"),
            user_unstake_requests: IterableMap::new(b"r"),
            user_shares: IterableMap::new(b"s"),
            user_metrics: IterableMap::new(b"m"),
        }
    }

    pub fn fix_broken_map(&mut self) {
        require!(env::predecessor_account_id() == self.owner_id, "Only owner can fix state");

        self.user_unstake_requests = IterableMap::new(b"req_v2".to_vec());

        log!("State fixed: user_unstake_requests mapped to a clean prefix.");
    }

    pub fn withdraw_treasury_near(&mut self, amount: U128) -> Promise {
        require!(env::predecessor_account_id() == self.owner_id, "Only owner can withdraw treasury");

        Promise::new(self.owner_id.clone()).transfer(NearToken::from_yoctonear(amount.0))
    }

    #[payable]
    pub fn withdraw_treasury_shares(&mut self, provider_id: AccountId, amount: U128) -> Promise {
        require!(env::predecessor_account_id() == self.owner_id, "Only owner can withdraw treasury");
        require!(env::attached_deposit().as_yoctonear() >= 1, "Requires 1 yoctoNEAR attached for NEP-141 transfer");

        ext_nep141::ext(provider_id)
            .with_attached_deposit(NearToken::from_yoctonear(1))
            .with_static_gas(GAS_FOR_FT_TRANSFER)
            .ft_transfer(
                self.owner_id.clone(),
                amount,
                Some("JOMO Treasury Withdraw".to_string())
            )
    }

    pub fn add_provider(&mut self, provider_id: AccountId) {
        require!(env::predecessor_account_id() == self.owner_id, "Only owner can add providers");
        self.providers.insert(provider_id.clone(), StakingProvider { provider_id: provider_id.clone(), total_staked: 0, is_active: true });
        log!("Provider added: {}", provider_id);
    }

    fn calculate_fee(amount: Balance) -> (Balance, Balance) {
        if amount == 0 { return (0, 0); }
        (amount, 0)
    }

    // --- 1. Deposit and Stake ---

    #[payable]
    pub fn deposit_and_stake(&mut self, provider_id: AccountId) -> Promise {
        let account_id = env::predecessor_account_id();
        let deposit = env::attached_deposit();
        let amount = deposit.as_yoctonear();

        require!(amount > 0, "Deposit must be greater than 0");
        require!(self.providers.contains_key(&provider_id), "Provider not supported");

        ext_validator::ext(provider_id.clone())
            .with_attached_deposit(deposit)
            .with_static_gas(GAS_FOR_STAKING)
            .deposit_and_stake()
            .then(
                ext_self::ext(env::current_account_id())
                    .with_static_gas(GAS_FOR_CALLBACK)
                    .on_deposit_and_stake(account_id, provider_id, amount)
            )
    }

    #[private]
    pub fn on_deposit_and_stake(
        &mut self,
        #[callback_result] call_result: Result<U128, PromiseError>,
        user_id: AccountId,
        provider_id: AccountId,
        deposited_amount: Balance
    ) -> bool {
        if let Ok(shares_minted) = call_result {
            let received_shares: u128 = shares_minted.0;
            let stake_key = format!("{}:{}", user_id, provider_id);

            let current_shares = self.user_shares.get(&stake_key).copied().unwrap_or(0);
            self.user_shares.insert(stake_key, current_shares + received_shares);

            if let Some(provider) = self.providers.get_mut(&provider_id) {
                provider.total_staked += deposited_amount;
            }

            let mut metrics = self.user_metrics.get(&user_id).cloned().unwrap_or_default();
            metrics.total_deposited += deposited_amount;
            self.user_metrics.insert(user_id.clone(), metrics);

            log!("SUCCESS: Staked {} NEAR. Received {} Shares.", deposited_amount, received_shares);
            return true;
        }

        log!("FAIL: Staking failed.");
        false
    }

    // --- 2. Instant Withdraw ---

    #[payable]
    pub fn instant_withdraw_shares(&mut self, amount: U128, provider_id: AccountId) -> Promise {
        let amount: Balance = amount.0;
        let account_id = env::predecessor_account_id();
        let stake_key = format!("{}:{}", account_id, provider_id);
        let current_shares = self.user_shares.get(&stake_key).copied().unwrap_or(0);

        require!(current_shares >= amount, "Not enough shares in this provider");
        require!(self.providers.contains_key(&provider_id), "Provider not supported");

        self.user_shares.insert(stake_key, current_shares - amount);
        if let Some(provider) = self.providers.get_mut(&provider_id) {
            provider.total_staked -= amount;
        }

        ext_validator::ext(provider_id.clone())
            .with_static_gas(GAS_FOR_STAKING)
            .instant_unstake(U128(amount))
            .then(
                ext_self::ext(env::current_account_id())
                    .with_static_gas(GAS_FOR_CALLBACK)
                    .on_instant_withdraw(account_id, provider_id, amount)
            )
    }

    #[private]
    pub fn on_instant_withdraw(
        &mut self,
        #[callback_result] call_result: Result<U128, PromiseError>,
        user_id: AccountId,
        provider_id: AccountId,
        shares_burned: Balance
    ) -> PromiseOrValue<()> {
        match call_result {
            Ok(received_near) => {
                let actual_near = received_near.0;
                let (user_payout, jomo_fee) = Self::calculate_fee(actual_near);

                let mut metrics = self.user_metrics.get(&user_id).cloned().unwrap_or_default();
                metrics.total_withdrawn += user_payout;
                self.user_metrics.insert(user_id.clone(), metrics);

                let mut transfer_promise = Promise::new(user_id.clone()).transfer(NearToken::from_yoctonear(user_payout));

                if jomo_fee > 0 {
                    transfer_promise = transfer_promise.and(
                        Promise::new(self.fee_collector_id.clone()).transfer(NearToken::from_yoctonear(jomo_fee))
                    );
                }

                PromiseOrValue::Promise(transfer_promise)
            },
            Err(_) => {
                let stake_key = format!("{}:{}", user_id, provider_id);
                let current_shares = self.user_shares.get(&stake_key).copied().unwrap_or(0);
                self.user_shares.insert(stake_key, current_shares + shares_burned);

                if let Some(provider) = self.providers.get_mut(&provider_id) {
                    provider.total_staked += shares_burned;
                }
                log!("FAIL: Instant Unstake failed at provider.");
                PromiseOrValue::Value(())
            }
        }
    }

    // --- 3. Delayed Withdraw (Shares via NEP-141) ---

    #[payable]
    pub fn delayed_withdraw_shares(&mut self, amount: U128, provider_id: AccountId) -> Promise {
        let amount: Balance = amount.0;
        let account_id = env::predecessor_account_id();
        let stake_key = format!("{}:{}", account_id, provider_id);
        let current_shares = self.user_shares.get(&stake_key).copied().unwrap_or(0);

        require!(current_shares >= amount, "Not enough shares in this provider");
        require!(self.providers.contains_key(&provider_id), "Provider not supported");
        require!(env::attached_deposit().as_yoctonear() == 1, "Requires 1 yoctoNEAR attached for NEP-141 transfer");

        self.user_shares.insert(stake_key, current_shares - amount);
        if let Some(provider) = self.providers.get_mut(&provider_id) {
            provider.total_staked -= amount;
        }

        let (user_payout_shares, jomo_fee_shares) = Self::calculate_fee(amount);

        ext_nep141::ext(provider_id.clone())
            .with_attached_deposit(NearToken::from_yoctonear(1))
            .with_static_gas(GAS_FOR_FT_TRANSFER)
            .ft_transfer(
                account_id.clone(),
                U128(user_payout_shares),
                Some("JOMO Delayed Withdraw".to_string())
            )
            .then(
                ext_self::ext(env::current_account_id())
                    .with_static_gas(GAS_FOR_CALLBACK)
                    .on_delayed_withdraw(account_id, provider_id, amount, jomo_fee_shares)
            )
    }

    #[private]
    pub fn on_delayed_withdraw(
        &mut self,
        #[callback_result] call_result: Result<(), PromiseError>,
        user_id: AccountId,
        provider_id: AccountId,
        shares_amount: Balance,
        fee_shares: Balance
    ) -> bool {
        if call_result.is_err() {
            let stake_key = format!("{}:{}", user_id, provider_id);
            let current_shares = self.user_shares.get(&stake_key).copied().unwrap_or(0);
            self.user_shares.insert(stake_key, current_shares + shares_amount);

            if let Some(provider) = self.providers.get_mut(&provider_id) {
                provider.total_staked += shares_amount;
            }
            return false;
        }
        log!("SUCCESS: Transferred {} shares.", shares_amount - fee_shares);
        true
    }

    // --- 4. Delayed Unstake ---

    #[payable]
    pub fn delayed_unstake(&mut self, amount: U128, provider_id: AccountId) -> Promise {
        let amount: Balance = amount.0;
        let account_id = env::predecessor_account_id();
        let stake_key = format!("{}:{}", account_id, provider_id);
        let current_shares = self.user_shares.get(&stake_key).copied().unwrap_or(0);

        require!(current_shares >= amount, "Not enough shares in this provider");
        require!(self.providers.contains_key(&provider_id), "Provider not supported");

        require!(
            self.user_unstake_requests.get(&account_id).is_none(),
            "You already have an active unstake request. Please claim it first."
        );

        self.user_shares.insert(stake_key, current_shares - amount);
        if let Some(provider) = self.providers.get_mut(&provider_id) {
            provider.total_staked -= amount;
        }

        ext_validator::ext(provider_id.clone())
            .with_static_gas(GAS_FOR_STAKING)
            .unstake(U128(amount))
            .then(
                ext_self::ext(env::current_account_id())
                    .with_static_gas(GAS_FOR_CALLBACK)
                    .on_delayed_unstake(account_id, provider_id, amount)
            )
    }

    #[private]
    pub fn on_delayed_unstake(
        &mut self,
        #[callback_result] call_result: Result<(), PromiseError>,
        user_id: AccountId,
        provider_id: AccountId,
        shares_burned: Balance
    ) -> bool {
        if call_result.is_err() {
            let stake_key = format!("{}:{}", user_id, provider_id);
            let current_shares = self.user_shares.get(&stake_key).copied().unwrap_or(0);
            self.user_shares.insert(stake_key, current_shares + shares_burned);
            if let Some(provider) = self.providers.get_mut(&provider_id) {
                provider.total_staked += shares_burned;
            }
            return false;
        }

        let request = UnstakeRequest {
            provider_id,
            amount: shares_burned,
            initial_deposit_value: shares_burned,
            unlock_epoch: env::epoch_height() + 4,
            is_claimed: false,
        };

        self.user_unstake_requests.insert(user_id.clone(), request);

        log!("SUCCESS: Delayed unstake created for user [{}]", user_id);
        true
    }

    pub fn claim_unstaked(&mut self) -> Promise {
        let account_id = env::predecessor_account_id();

        let request = self.user_unstake_requests.get_mut(&account_id).expect("No active unstake request found");

        require!(!request.is_claimed, "Already claiming");
        require!(env::epoch_height() >= request.unlock_epoch, "Funds are still locked");

        request.is_claimed = true;

        let provider_id = request.provider_id.clone();
        let amount = request.amount;

        ext_validator::ext(provider_id.clone())
            .with_static_gas(GAS_FOR_STAKING)
            .withdraw(U128(amount))
            .then(
                ext_self::ext(env::current_account_id())
                    .with_static_gas(GAS_FOR_CALLBACK)
                    .on_withdraw(account_id, provider_id)
            )
    }

    #[private]
    pub fn on_withdraw(
        &mut self,
        #[callback_result] call_result: Result<U128, PromiseError>,
        user_id: AccountId,
        provider_id: AccountId
    ) -> PromiseOrValue<()> {
        match call_result {
            Ok(received_near) => {
                let actual_near = received_near.0;

                self.user_unstake_requests.remove(&user_id);

                let (user_payout, jomo_fee) = Self::calculate_fee(actual_near);

                let mut metrics = self.user_metrics.get(&user_id).cloned().unwrap_or_default();
                metrics.total_withdrawn += user_payout;
                self.user_metrics.insert(user_id.clone(), metrics);

                let mut transfer_promise = Promise::new(user_id.clone()).transfer(NearToken::from_yoctonear(user_payout));

                if jomo_fee > 0 {
                    transfer_promise = transfer_promise.and(
                        Promise::new(self.fee_collector_id.clone()).transfer(NearToken::from_yoctonear(jomo_fee))
                    );
                }

                PromiseOrValue::Promise(transfer_promise)
            },
            Err(_) => {
                if let Some(request) = self.user_unstake_requests.get_mut(&user_id) {
                    request.is_claimed = false;
                }
                log!("FAIL: Withdraw failed at provider.");
                PromiseOrValue::Value(())
            }
        }
    }

    // --- 5. View Functions ---

    pub fn get_user_shares(&self, account_id: AccountId, provider_id: AccountId) -> U128 {
        let stake_key = format!("{}:{}", account_id, provider_id);
        U128(self.user_shares.get(&stake_key).copied().unwrap_or(0))
    }

    pub fn get_provider_tvl(&self, provider_id: AccountId) -> U128 {
        U128(self.providers.get(&provider_id).map(|p| p.total_staked).unwrap_or(0))
    }

    pub fn get_user_unstake_request(&self, account_id: AccountId) -> Option<UnstakeRequest> {
        self.user_unstake_requests.get(&account_id).cloned()
    }

    pub fn get_user_metrics(&self, account_id: AccountId) -> UserMetrics {
        self.user_metrics.get(&account_id).cloned().unwrap_or_default()
    }

    pub fn get_current_epoch(&self) -> u64 { env::epoch_height() }

    pub fn get_total_user_shares(&self) -> U128 {
        let mut total_user_shares: Balance = 0;

        for (_, shares) in self.user_shares.iter() {
            total_user_shares += shares;
        }

        U128(total_user_shares)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use near_sdk::test_utils::{accounts, VMContextBuilder};
    use near_sdk::testing_env;

    const ONE_NEAR: u128 = 1_000_000_000_000_000_000_000_000; // 10^24


    fn get_context(predecessor_account_id: AccountId) -> VMContextBuilder {
        let mut builder = VMContextBuilder::new();
        builder
            .current_account_id(accounts(0))
            .signer_account_id(predecessor_account_id.clone())
            .predecessor_account_id(predecessor_account_id);
        builder
    }

    fn setup_contract() -> (VMContextBuilder, JomoStakingProxy) {
        let mut context = get_context(accounts(1));
        testing_env!(context.build());
        let mut contract = JomoStakingProxy::new(accounts(1), accounts(2));

        contract.add_provider(accounts(3));
        (context, contract)
    }


    #[test]
    fn test_initialization_and_providers() {
        let (_, contract) = setup_contract();
        assert_eq!(contract.owner_id, accounts(1));
        assert_eq!(contract.fee_collector_id, accounts(2));
        assert!(contract.providers.contains_key(&accounts(3)));
    }

    #[test]
    fn test_fee_calculation() {
        let amount = 100_000;
        let (user_payout, fee) = JomoStakingProxy::calculate_fee(amount);
        assert_eq!(fee, 0);
        assert_eq!(user_payout, 100_000);

        let (user_payout_zero, fee_zero) = JomoStakingProxy::calculate_fee(0);
        assert_eq!(fee_zero, 0);
        assert_eq!(user_payout_zero, 0);
    }

    #[test]
    fn test_deposit_flow() {
        let (mut context, mut contract) = setup_contract();
        let user = accounts(4);
        let provider = accounts(3);

        testing_env!(context.predecessor_account_id(user.clone()).build());

        let deposited_amount = 10 * ONE_NEAR;
        let received_shares = 9 * ONE_NEAR;

        let success_result = Ok(U128(received_shares));
        let success = contract.on_deposit_and_stake(success_result, user.clone(), provider.clone(), deposited_amount);

        assert!(success);

        let shares = contract.get_user_shares(user.clone(), provider.clone());
        assert_eq!(shares.0, received_shares);

        let tvl = contract.get_provider_tvl(provider.clone());
        assert_eq!(tvl.0, deposited_amount);

        let metrics = contract.get_user_metrics(user.clone());
        assert_eq!(metrics.total_deposited, deposited_amount);
        assert_eq!(metrics.total_withdrawn, 0);

        let fail_result = Err(PromiseError::Failed);
        let is_success = contract.on_deposit_and_stake(fail_result, user.clone(), provider.clone(), deposited_amount);

        assert!(!is_success);
        assert_eq!(contract.get_user_shares(user.clone(), provider.clone()).0, received_shares);
    }

    #[test]
    fn test_instant_withdraw_flow() {
        let (mut context, mut contract) = setup_contract();
        let user = accounts(4);
        let provider = accounts(3);

        let initial_shares = 10 * ONE_NEAR;
        let stake_key = format!("{}:{}", user, provider);
        contract.user_shares.insert(stake_key.clone(), initial_shares);
        contract.providers.get_mut(&provider).unwrap().total_staked = initial_shares;

        testing_env!(context.predecessor_account_id(user.clone()).build());

        let amount_to_withdraw = 4 * ONE_NEAR;
        contract.instant_withdraw_shares(U128(amount_to_withdraw), provider.clone());

        assert_eq!(contract.get_user_shares(user.clone(), provider.clone()).0, 6 * ONE_NEAR);

        let received_near = 4_500_000_000_000_000_000_000_000;
        contract.on_instant_withdraw(Ok(U128(received_near)), user.clone(), provider.clone(), amount_to_withdraw);

        let metrics = contract.get_user_metrics(user.clone());
        let (expected_user_payout, _fee) = JomoStakingProxy::calculate_fee(received_near);
        assert_eq!(metrics.total_withdrawn, expected_user_payout);

        contract.on_instant_withdraw(Err(PromiseError::Failed), user.clone(), provider.clone(), amount_to_withdraw);

        assert_eq!(contract.get_user_shares(user.clone(), provider.clone()).0, 10 * ONE_NEAR);
    }

    #[test]
    fn test_delayed_unstake_and_claim_flow() {
        let (mut context, mut contract) = setup_contract();
        let user = accounts(4);
        let provider = accounts(3);

        let initial_shares = 10 * ONE_NEAR;
        let stake_key = format!("{}:{}", user, provider);
        contract.user_shares.insert(stake_key.clone(), initial_shares);

        testing_env!(context.predecessor_account_id(user.clone()).epoch_height(100).build());

        let amount_to_unstake = 5 * ONE_NEAR;
        contract.on_delayed_unstake(Ok(()), user.clone(), provider.clone(), amount_to_unstake);

        let request = contract.get_user_unstake_request(user.clone()).unwrap();
        assert_eq!(request.amount, amount_to_unstake);
        assert_eq!(request.unlock_epoch, 104); // поточна епоха (100) + 4
        assert!(!request.is_claimed);

        let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            contract.delayed_unstake(U128(2 * ONE_NEAR), provider.clone());
        }));
        assert!(result.is_err(), "Should panic because there is already an active request");

        testing_env!(context.epoch_height(102).build());
        let result_early_claim = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            contract.claim_unstaked();
        }));
        assert!(result_early_claim.is_err(), "Should panic because funds are still locked");

        testing_env!(context.epoch_height(105).build());

        contract.claim_unstaked();
        assert!(contract.get_user_unstake_request(user.clone()).unwrap().is_claimed);

        let received_near = 5_500_000_000_000_000_000_000_000;
        contract.on_withdraw(Ok(U128(received_near)), user.clone(), provider.clone());

        assert!(contract.get_user_unstake_request(user.clone()).is_none());

        let metrics = contract.get_user_metrics(user.clone());
        let (expected_payout, _) = JomoStakingProxy::calculate_fee(received_near);
        assert_eq!(metrics.total_withdrawn, expected_payout);
    }
}