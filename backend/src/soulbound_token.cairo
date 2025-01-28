#[starknet::interface]
pub trait ISoulboundToken<TContractState> {
    fn mint(
        ref self: TContractState, recipient: starknet::ContractAddress, token_id: u64, uri: felt252,
    );
    fn get_token_uri(self: @TContractState, token_id: u64) -> felt252;
    fn get_owner_of(self: @TContractState, token_id: u64) -> starknet::ContractAddress;
}

#[starknet::contract]
pub mod SoulboundToken {
    use super::ISoulboundToken;
    use openzeppelin_access::ownable::OwnableComponent;
    use starknet::ContractAddress;
    use starknet::storage::{StorageMapWriteAccess, StorageMapReadAccess, Map};
    use core::num::traits::Zero;

    // Déclaration du composant Ownable
    component!(path: OwnableComponent, storage: ownable, event: OwnableEvent);

    // Ownable Mixin
    #[abi(embed_v0)]
    impl OwnableImpl = OwnableComponent::OwnableImpl<ContractState>;
    impl InternalImpl = OwnableComponent::InternalImpl<ContractState>;

    #[storage]
    struct Storage {
        owner_of: Map<u64, ContractAddress>,
        token_uri: Map<u64, felt252>,
        #[substorage(v0)]
        ownable: OwnableComponent::Storage,
    }


    #[event]
    #[derive(Drop, starknet::Event)]
    pub enum Event {
        Transfer: Transfer,
        #[flat]
        OwnableEvent: OwnableComponent::Event,
    }

    #[derive(Drop, starknet::Event)]
    struct Transfer {
        to: ContractAddress,
        token_id: u64,
    }

    pub mod Errors {
        pub const TokenAlreadyMinted: felt252 = 'Token already minted';
        pub const NonTransferable: felt252 = 'SBTs are non-transferable';
    }


    #[constructor]
    fn constructor(ref self: ContractState, owner: ContractAddress) {
        self.ownable.initializer(owner);
    }

    #[abi(embed_v0)]
    impl SoulboundTokenImpl of ISoulboundToken<ContractState> {
        fn mint(ref self: ContractState, recipient: ContractAddress, token_id: u64, uri: felt252) {
            self.ownable.assert_only_owner();
            let current_owner = self.owner_of.read(token_id);
            println!("current_owner: {:?}", current_owner);
            assert(current_owner.is_zero(), Errors::TokenAlreadyMinted);

            self.owner_of.write(token_id, recipient);
            self.token_uri.write(token_id, uri);
            self.emit(Transfer { to: recipient, token_id });
        }
        fn get_token_uri(self: @ContractState, token_id: u64) -> felt252 {
            self.token_uri.read(token_id)
        }

        fn get_owner_of(self: @ContractState, token_id: u64) -> ContractAddress {
            self.owner_of.read(token_id)
        }
    }
    #[external(v0)]
    fn transfer(
        ref self: ContractState, from: ContractAddress, to: ContractAddress, token_id: u64,
    ) {
        panic(array![Errors::NonTransferable]);
    }
}

