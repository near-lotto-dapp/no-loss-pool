use near_sdk::store::IterableMap;
use near_sdk::json_types::U128;
use near_sdk::{
    env, near, AccountId, PanicOnDefault, Promise,
    NearToken, assert_one_yocto, Gas, ext_contract
};

const LINEAR_CONTRACT: &str = "linear-protocol.near";
const GAS_FOR_STAKE: Gas = Gas::from_tgas(100);
const GAS_FOR_CALLBACK: Gas = Gas::from_tgas(20);
const GAS_FOR_CLAIM: Gas = Gas::from_tgas(50);

// 3 days in nanoseconds (3 * 24 * 60 * 60 * 1_000_000_000)
const UNSTAKE_PERIOD_NS: u64 = 259_200_000_000_000;

#[ext_contract(ext_linear)]
pub trait LinearInterface {
    #[payable]
    fn deposit_and_stake(&mut self);
    fn get_account_total_balance(&self, account_id: AccountId) -> U128;

    // New methods for Two-Step Withdrawal
    fn unstake(&mut self, amount: U128);
    fn withdraw_all(&mut self);
}

// OLD structure used ONLY for migration
#[near(serializers = ["borsh"])]
#[derive(Clone)]
pub struct OldUser {
    pub active_balance: u128,
    pub pending_balance: u128,
}

// NEW structure with unstaking tracking
#[near(serializers = ["borsh"])]
#[derive(Clone, Default, Debug, PartialEq)]
pub struct User {
    pub active_balance: u128,
    pub pending_balance: u128,
    pub unstaking_balance: u128,    // Amount currently unlocking
    pub unstake_unlock_time: u64,   // Timestamp (in ns) when funds are ready
}

#[near(serializers = ["json"])]
pub struct UserView {
    pub active_balance: U128,
    pub pending_balance: U128,
    pub unstaking_balance: U128,
    pub unstake_unlock_time: String, // Stringified for frontend safety
}

#[near(serializers = ["json"])]
pub struct PoolInfoView {
    pub total_active: U128,
    pub total_pending: U128,
    pub total_staked: U128,
}

#[near(contract_state)]
#[derive(PanicOnDefault)]
pub struct NoLossPool {
    pub users: IterableMap<AccountId, User>,
    pub total_active_staked: u128,
    pub total_pending_staked: u128,
    pub owner_id: AccountId,
    pub total_staked_in_linear: u128,
}

#[near]
impl NoLossPool {
    #[init]
    pub fn new(owner_id: AccountId) -> Self {
        assert!(!env::state_exists(), "Already initialized");
        Self {
            users: IterableMap::new(b"v3".to_vec()), // Initializing directly with v3
            total_active_staked: 0,
            total_pending_staked: 0,
            total_staked_in_linear: 0,
            owner_id,
        }
    }

    // Safely migrates data from v2 to v3 without losing user balances
    #[private]
    #[init(ignore_state)]
    pub fn migrate() -> Self {
        let old_state: NoLossPool = env::state_read().expect("Failed to read state");

        let mut new_users = IterableMap::new(b"v3".to_vec());
        let old_users: IterableMap<AccountId, OldUser> = IterableMap::new(b"v2".to_vec());

        // Transfer all old users to the new structure
        for (account_id, old_user) in old_users.iter() {
            let new_user = User {
                active_balance: old_user.active_balance,
                pending_balance: old_user.pending_balance,
                unstaking_balance: 0,
                unstake_unlock_time: 0,
            };
            new_users.insert(account_id.clone(), new_user);
        }

        Self {
            owner_id: old_state.owner_id,
            users: new_users,
            total_active_staked: old_state.total_active_staked,
            total_pending_staked: old_state.total_pending_staked,
            total_staked_in_linear: old_state.total_staked_in_linear,
        }
    }

    #[private]
    pub fn on_deposit_and_stake_callback(&mut self, staked_amount: U128) -> bool {
        let amount = staked_amount.0;

        match env::promise_result(0) {
            near_sdk::PromiseResult::Successful(_) => {
                self.total_staked_in_linear += amount;
                true
            },
            _ => false
        }
    }

    #[payable]
    pub fn deposit(&mut self) {
        let account_id = env::predecessor_account_id();
        let attached_deposit = env::attached_deposit();
        let deposit_amount = attached_deposit.as_yoctonear();

        let min_deposit = NearToken::from_near(10).as_yoctonear();
        assert!(deposit_amount >= min_deposit, "Deposit must be at least 10 NEAR");

        let mut user = self.users.get(&account_id).cloned().unwrap_or_default();
        user.pending_balance += deposit_amount;

        self.total_pending_staked += deposit_amount;
        self.users.insert(account_id.clone(), user);

        // Always stake if it's over the threshold
        if deposit_amount >= min_deposit {
            let promise = ext_linear::ext(LINEAR_CONTRACT.parse().unwrap())
                .with_attached_deposit(attached_deposit)
                .with_static_gas(GAS_FOR_STAKE)
                .deposit_and_stake();

            promise.then(
                Self::ext(env::current_account_id())
                    .with_static_gas(GAS_FOR_CALLBACK)
                    .on_deposit_and_stake_callback(U128(deposit_amount))
            );
        }
    }

    pub fn admin_restore_balance(&mut self, account_id: AccountId, active: U128, pending: U128) {
        assert_eq!(
            env::predecessor_account_id(),
            self.owner_id,
            "Only the owner can restore balances"
        );

        let mut user = self.users.get(&account_id).cloned().unwrap_or_default();

        self.total_active_staked = self.total_active_staked.saturating_sub(user.active_balance);
        self.total_pending_staked = self.total_pending_staked.saturating_sub(user.pending_balance);

        user.active_balance = active.0;
        user.pending_balance = pending.0;

        self.total_active_staked += user.active_balance;
        self.total_pending_staked += user.pending_balance;

        self.users.insert(account_id.clone(), user);

        near_sdk::log!("Restored balance & updated totals for {}: Active {}, Pending {}", account_id, active.0, pending.0);
    }

    // STEP 1: Initiate Unstaking
    #[payable]
    pub fn withdraw(&mut self, amount: U128) {
        assert_one_yocto();

        let withdraw_amount: u128 = amount.0;
        let account_id = env::predecessor_account_id();

        let mut user = self.users.get(&account_id).cloned().expect("No deposit found");

        // Prevent multiple simultaneous unstaking requests to keep logic clean
        assert!(user.unstaking_balance == 0, "You already have an active unstake request. Claim it first.");

        let total_user_balance = user.active_balance + user.pending_balance;
        assert!(total_user_balance >= withdraw_amount, "Not enough staked");

        // Deduct from pending first, then active
        if user.pending_balance >= withdraw_amount {
            user.pending_balance -= withdraw_amount;
            self.total_pending_staked -= withdraw_amount;
        } else {
            let remainder = withdraw_amount - user.pending_balance;
            self.total_pending_staked -= user.pending_balance;
            user.pending_balance = 0;

            user.active_balance -= remainder;
            self.total_active_staked -= remainder;
        }

        // Start the 3-day timer
        user.unstaking_balance = withdraw_amount;
        user.unstake_unlock_time = env::block_timestamp() + UNSTAKE_PERIOD_NS;

        self.users.insert(account_id.clone(), user);

        // Tell LiNEAR to start unstaking
        ext_linear::ext(LINEAR_CONTRACT.parse().unwrap())
            .with_static_gas(GAS_FOR_STAKE)
            .unstake(U128(withdraw_amount));

        near_sdk::log!("Unstaking initiated. Ready in 3 days.");
    }

    // STEP 2: Claim unlocked funds
    pub fn claim(&mut self) {
        let account_id = env::predecessor_account_id();
        let mut user = self.users.get(&account_id).cloned().expect("No user found");

        assert!(user.unstaking_balance > 0, "No funds are currently unstaking");
        assert!(env::block_timestamp() >= user.unstake_unlock_time, "Unstaking period (3 days) is not over yet");

        let amount_to_claim = user.unstaking_balance;

        // Reset user unstaking state
        user.unstaking_balance = 0;
        user.unstake_unlock_time = 0;
        self.users.insert(account_id.clone(), user);

        // Tell LiNEAR to withdraw all physically unlocked NEAR to the pool, then send to user
        ext_linear::ext(LINEAR_CONTRACT.parse().unwrap())
            .with_static_gas(GAS_FOR_CLAIM)
            .withdraw_all()
            .then(
                Self::ext(env::current_account_id())
                    .with_static_gas(GAS_FOR_CALLBACK)
                    .on_claim_callback(account_id, U128(amount_to_claim))
            );
    }

    #[private]
    pub fn on_claim_callback(&mut self, account_id: AccountId, amount: U128) {
        // Finally, send the physical NEAR to the user
        Promise::new(account_id).transfer(NearToken::from_yoctonear(amount.0));
        near_sdk::log!("Successfully claimed {} yoctoNEAR", amount.0);
    }

    pub fn process_draw(&mut self) {
        assert_eq!(
            env::predecessor_account_id(),
            self.owner_id,
            "Only the owner can process the draw"
        );

        let mut keys_to_update: Vec<AccountId> = vec![];
        for (account_id, user) in self.users.iter() {
            if user.pending_balance > 0 {
                keys_to_update.push(account_id.clone());
            }
        }

        for account_id in keys_to_update {
            if let Some(user) = self.users.get_mut(&account_id) {
                user.active_balance += user.pending_balance;
                user.pending_balance = 0;
            }
        }

        self.total_active_staked += self.total_pending_staked;
        self.total_pending_staked = 0;
    }

    #[private]
    pub fn admin_sync_staked_balance(&mut self, amount: U128) {
        self.total_staked_in_linear = amount.0;
    }

    pub fn draw_winner(&mut self) {
        assert_eq!(env::predecessor_account_id(), self.owner_id, "Only the owner can process the draw");
        assert!(self.total_active_staked > 0, "No active players in the pool.");

        ext_linear::ext(LINEAR_CONTRACT.parse().unwrap())
            .with_static_gas(Gas::from_tgas(10))
            .get_account_total_balance(env::current_account_id())
            .then(
                Self::ext(env::current_account_id())
                    .with_static_gas(Gas::from_tgas(50))
                    .on_draw_winner_callback()
            );
    }

    #[private]
    pub fn on_draw_winner_callback(
        &mut self,
        #[callback_result] call_result: Result<U128, near_sdk::PromiseError>,
    ) {
        let current_linear_balance = match call_result {
            Ok(balance) => balance.0,
            Err(_) => return,
        };

        if current_linear_balance <= self.total_staked_in_linear {
            return;
        }

        let prize = current_linear_balance - self.total_staked_in_linear;
        let dev_fee = (prize * 300) / 10000;
        let winner_prize = prize - dev_fee;

        let random_seed = env::random_seed();
        let mut bytes = [0u8; 16];
        bytes.copy_from_slice(&random_seed[0..16]);
        let random_num = u128::from_le_bytes(bytes);

        let winning_ticket = random_num % self.total_active_staked;
        let mut current_sum: u128 = 0;
        let mut winner_account: Option<AccountId> = None;

        for (account_id, user) in self.users.iter() {
            if user.active_balance > 0 {
                current_sum += user.active_balance;
                if current_sum > winning_ticket {
                    winner_account = Some(account_id.clone());
                    break;
                }
            }
        }

        if let Some(winner) = winner_account {
            let mut winner_data = self.users.get(&winner).cloned().unwrap_or_default();
            winner_data.active_balance += winner_prize;
            self.users.insert(winner.clone(), winner_data);

            let mut dev_data = self.users.get(&self.owner_id).cloned().unwrap_or_default();
            dev_data.active_balance += dev_fee;
            self.users.insert(self.owner_id.clone(), dev_data);

            self.total_active_staked += prize;
            self.total_staked_in_linear = current_linear_balance;
        }
    }

    pub fn get_user(&self, account_id: AccountId) -> Option<UserView> {
        let user = self.users.get(&account_id)?;
        Some(UserView {
            active_balance: U128(user.active_balance),
            pending_balance: U128(user.pending_balance),
            unstaking_balance: U128(user.unstaking_balance),
            unstake_unlock_time: user.unstake_unlock_time.to_string(),
        })
    }

    pub fn get_pool_info(&self) -> PoolInfoView {
        PoolInfoView {
            total_active: U128(self.total_active_staked),
            total_pending: U128(self.total_pending_staked),
            total_staked: U128(self.total_staked_in_linear),
        }
    }
}

/* --- UNIT TESTS --- */
#[cfg(test)]
mod tests {
    use super::*;
    use near_sdk::test_utils::VMContextBuilder;
    use near_sdk::testing_env;
    use near_sdk::NearToken;

    fn set_context(predecessor: AccountId, deposit: NearToken, timestamp: u64) {
        let mut builder = VMContextBuilder::new();
        builder
            .predecessor_account_id(predecessor)
            .attached_deposit(deposit)
            .block_timestamp(timestamp);
        testing_env!(builder.build());
    }

    #[test]
    fn test_deposit_goes_to_pending() {
        let account: AccountId = "alice.near".parse().unwrap();
        set_context(account.clone(), NearToken::from_near(10), 0);

        let mut contract = NoLossPool::new("owner.near".parse().unwrap());
        contract.deposit();

        let user = contract.get_user(account).unwrap();
        assert_eq!(user.active_balance.0, 0);
        assert_eq!(user.pending_balance.0, NearToken::from_near(10).as_yoctonear());
    }

    #[test]
    fn test_withdraw_starts_unstaking() {
        let account: AccountId = "alice.near".parse().unwrap();

        // 1. Deposit
        set_context(account.clone(), NearToken::from_near(10), 0);
        let mut contract = NoLossPool::new("owner.near".parse().unwrap());
        contract.deposit();

        // 2. Initiate Withdraw (Unstake)
        let current_time = 1_000_000;
        set_context(account.clone(), NearToken::from_yoctonear(1), current_time);
        contract.withdraw(U128(NearToken::from_near(4).as_yoctonear()));

        let user = contract.get_user(account).unwrap();

        // Balances should be updated
        assert_eq!(user.pending_balance.0, NearToken::from_near(6).as_yoctonear());
        assert_eq!(user.unstaking_balance.0, NearToken::from_near(4).as_yoctonear());

        // Timer should be set to 3 days from `current_time`
        let expected_time = current_time + UNSTAKE_PERIOD_NS;
        assert_eq!(user.unstake_unlock_time, expected_time.to_string());
    }

    #[test]
    #[should_panic(expected = "Unstaking period (3 days) is not over yet")]
    fn test_claim_panics_if_too_early() {
        let account: AccountId = "alice.near".parse().unwrap();

        set_context(account.clone(), NearToken::from_near(10), 0);
        let mut contract = NoLossPool::new("owner.near".parse().unwrap());
        contract.deposit();

        // Start unstaking at timestamp 0
        set_context(account.clone(), NearToken::from_yoctonear(1), 0);
        contract.withdraw(U128(NearToken::from_near(4).as_yoctonear()));

        // Try to claim at 2 days (too early)
        let two_days_ns = 2 * 24 * 60 * 60 * 1_000_000_000;
        set_context(account.clone(), NearToken::from_yoctonear(0), two_days_ns);
        contract.claim();
    }

    #[test]
    fn test_claim_success_after_3_days() {
        let account: AccountId = "alice.near".parse().unwrap();

        set_context(account.clone(), NearToken::from_near(10), 0);
        let mut contract = NoLossPool::new("owner.near".parse().unwrap());
        contract.deposit();

        // Start unstaking at timestamp 0
        set_context(account.clone(), NearToken::from_yoctonear(1), 0);
        contract.withdraw(U128(NearToken::from_near(4).as_yoctonear()));

        // Fast forward 4 days and claim
        let four_days_ns = 4 * 24 * 60 * 60 * 1_000_000_000;
        set_context(account.clone(), NearToken::from_yoctonear(0), four_days_ns);
        contract.claim();

        let user = contract.get_user(account).unwrap();

        // Unstaking balance and timer should be reset
        assert_eq!(user.unstaking_balance.0, 0);
        assert_eq!(user.unstake_unlock_time, "0");
    }

    #[test]
    #[should_panic(expected = "You already have an active unstake request. Claim it first.")]
    fn test_cannot_unstake_twice_at_once() {
        let account: AccountId = "alice.near".parse().unwrap();

        set_context(account.clone(), NearToken::from_near(10), 0);
        let mut contract = NoLossPool::new("owner.near".parse().unwrap());
        contract.deposit();

        set_context(account.clone(), NearToken::from_yoctonear(1), 0);
        contract.withdraw(U128(NearToken::from_near(4).as_yoctonear()));

        // Try to withdraw again while the first one is pending
        contract.withdraw(U128(NearToken::from_near(2).as_yoctonear()));
    }
}