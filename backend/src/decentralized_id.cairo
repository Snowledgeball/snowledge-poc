// SPDX-License-Identifier: MIT
#[derive(Drop, Serde)]
struct ArrayBytes {
    data: Array<felt252>,
    pending_word: felt252,
    pending_word_len: usize,
}


#[starknet::interface]
pub trait IDecentralizedId<TContractState> {
    #[external(v0)]
    fn safe_mint(ref self: TContractState, recipient: starknet::ContractAddress, uri: ArrayBytes);
    #[external(v0)]
    fn get_token_uri(self: @TContractState, token_id: u256) -> ArrayBytes;
    #[external(v0)]
    fn get_owner_of(self: @TContractState, token_id: u256) -> starknet::ContractAddress;
    #[external(v0)]
    fn transfer(
        ref self: TContractState,
        from: starknet::ContractAddress,
        to: starknet::ContractAddress,
        token_id: u256,
    );
}


#[starknet::contract]
pub mod DecentralizedId {
    use super::IDecentralizedId;
    use super::ArrayBytes;
    use openzeppelin_introspection::src5::SRC5Component;
    use openzeppelin_token::erc721::{ERC721Component, ERC721HooksEmptyImpl};
    use openzeppelin_access::ownable::OwnableComponent;
    use openzeppelin_access::ownable::OwnableComponent::InternalTrait as OwnableInternalTrait;
    use starknet::ContractAddress;
    use starknet::storage::{
        StorageMapReadAccess, StorageMapWriteAccess, Map, StoragePointerWriteAccess,
        StoragePointerReadAccess,
    };
    use core::num::traits::Zero;
    use core::array::{ArrayTrait, ToSpanTrait, Span};
    component!(path: ERC721Component, storage: erc721, event: ERC721Event);
    component!(path: SRC5Component, storage: src5, event: SRC5Event);
    component!(path: OwnableComponent, storage: ownable, event: OwnableEvent);


    #[abi(embed_v0)]
    impl OwnableImpl = OwnableComponent::OwnableImpl<ContractState>;

    // External
    #[abi(embed_v0)]
    impl ERC721MixinImpl = ERC721Component::ERC721MixinImpl<ContractState>;

    // Internal
    impl ERC721InternalImpl = ERC721Component::InternalImpl<ContractState>;


    #[storage]
    struct Storage {
        owner_of: Map<u256, ContractAddress>,
        token_uri_data: Map<(u256, usize), felt252>,
        token_uri_len: Map<u256, usize>,
        total_supply: u256,
        #[substorage(v0)]
        erc721: ERC721Component::Storage,
        #[substorage(v0)]
        src5: SRC5Component::Storage,
        #[substorage(v0)]
        ownable: OwnableComponent::Storage,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {
        #[flat]
        ERC721Event: ERC721Component::Event,
        #[flat]
        SRC5Event: SRC5Component::Event,
        #[flat]
        OwnableEvent: OwnableComponent::Event,
    }

    pub mod Errors {
        pub const TokenAlreadyMinted: felt252 = 'Token already minted';
        pub const NonTransferable: felt252 = 'SBTs are non-transferable';
    }

    #[constructor]
    fn constructor(ref self: ContractState, owner: ContractAddress) {
        let name = "DecentralizedId";
        let symbol = "DID";
        let base_uri = "https://hindigo-hidden-meerkat-77.mypinata.cloud/ipfs/";

        self.total_supply.write(0);
        self.erc721.initializer(name, symbol, base_uri);
        self.ownable.initializer(owner);
    }


    #[abi(embed_v0)]
    impl DecentralizedIdImpl of IDecentralizedId<ContractState> {
        fn safe_mint(ref self: ContractState, recipient: ContractAddress, uri: ArrayBytes) {
            self.ownable.assert_only_owner();
            let token_id = self.total_supply.read();
            let current_owner = self.owner_of.read(token_id);
            assert(current_owner.is_zero(), Errors::TokenAlreadyMinted);

            self.owner_of.write(token_id, recipient);
            self.token_uri_len.write(token_id, uri.data.len());
            let mut i: usize = 0;
            loop {
                if i >= uri.data.len() {
                    break;
                }
                self.token_uri_data.write((token_id, i), *uri.data.at(i));
                i += 1;
            };

            let data: Array<felt252> = array![];
            self.erc721.safe_mint(recipient, token_id.into(), data.span());
            self.total_supply.write(self.total_supply.read() + 1);
        }

        fn get_token_uri(self: @ContractState, token_id: u256) -> ArrayBytes {
            let len = self.token_uri_len.read(token_id);
            let mut data = array![];
            let mut i: usize = 0;
            loop {
                if i >= len {
                    break;
                }
                data.append(self.token_uri_data.read((token_id, i)));
                i += 1;
            };

            ArrayBytes { data, pending_word: 0, pending_word_len: len }
        }

        fn get_owner_of(self: @ContractState, token_id: u256) -> ContractAddress {
            self.owner_of.read(token_id)
        }

        fn transfer(
            ref self: ContractState, from: ContractAddress, to: ContractAddress, token_id: u256,
        ) {
            panic(array![Errors::NonTransferable]);
        }
    }
}
