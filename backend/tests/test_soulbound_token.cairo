use snforge_std::{
    declare, ContractClassTrait, DeclareResultTrait, start_cheat_caller_address,
    stop_cheat_caller_address,
};
use starknet::{ContractAddress};
use core::starknet::contract_address::contract_address_const;
use backend::{ISoulboundTokenDispatcher, ISoulboundTokenDispatcherTrait};

#[test]
fn test_mint() {
    // Déclarer et déployer le contrat
    let owner: ContractAddress = contract_address_const::<1>();
    let contract = declare("SoulboundToken").unwrap().contract_class();

    let (contract_address, _) = contract.deploy(@array![owner.into()]).unwrap();

    // Créer un dispatcher pour interagir avec le contrat déployé
    let dispatcher = ISoulboundTokenDispatcher { contract_address };

    // On set le caller à l'owner
    start_cheat_caller_address(contract_address, owner);

    // Adresse du destinataire
    let recipient = contract_address_const::<2>();
    let token_id = 1_u64;
    let uri = 'https://example.com/token/1';

    // Appeler la fonction mint
    dispatcher.mint(recipient, token_id, uri);

    // On stop le caller
    stop_cheat_caller_address(contract_address);

    // Vérifier que le propriétaire du token est correct
    let stored_owner = dispatcher.get_owner_of(token_id);
    assert!(stored_owner == recipient, "Le proprietaire du token est incorrect");

    // Vérifier que l'URI du token est correct
    let stored_uri = dispatcher.get_token_uri(token_id);
    assert!(stored_uri == uri, "L'URI du token est incorrect");
}
