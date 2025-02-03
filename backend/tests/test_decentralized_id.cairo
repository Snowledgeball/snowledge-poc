use backend::IDecentralizedIdDispatcherTrait;
use openzeppelin_access::ownable::interface::IOwnableDispatcherTrait;
use snforge_std::{
    declare, ContractClassTrait, DeclareResultTrait, start_cheat_caller_address,
    stop_cheat_caller_address,
};
use starknet::{ContractAddress};
use core::starknet::contract_address::contract_address_const;
use backend::{IDecentralizedIdDispatcher};
use openzeppelin_access::ownable::interface::IOwnableDispatcher;
use openzeppelin_token::erc721::interface::IERC721Dispatcher;


fn OWNER() -> ContractAddress {
    'OWNER'.try_into().unwrap()
}

fn deploy_contract() -> (IDecentralizedIdDispatcher, ContractAddress) {
    let contract = declare("DecentralizedId").unwrap().contract_class();

    // serialize the calldata
    let mut calldata = array![];
    OWNER().serialize(ref calldata);

    let (contract_address, _) = contract.deploy(@calldata).unwrap();
    let dispatcher = IDecentralizedIdDispatcher { contract_address };
    return (dispatcher, contract_address);
}

#[test]
fn test_deploy() {
    let (_, contract_address) = deploy_contract();

    let ownableDispatcher = IOwnableDispatcher { contract_address: contract_address };
    let owner = ownableDispatcher.owner();
    assert!(owner == OWNER(), "Le proprietaire du contrat est incorrect");
}
// Je ne peux pas tester safe_mint car je ne peux pas simuler une adresse deployée
// #[test]
// fn test_safe_mint() {
//     // Déclarer et déployer le contrat
//     let (dispatcher, contract_address) = deploy_contract();

//     // Déployer un compte simulé pour le destinataire
//     let recipient = deploy_test_account();
//     // Simuler l'appel du propriétaire
//     start_cheat_caller_address(contract_address, OWNER());

//     // Adresse du destinataire et données du token
//     let recipient = contract_address_const::<2>();
//     let token_id = 1_u256;
//     let uri = 'https://example.com/token/1';

//     // Appeler la fonction safe_mint
//     dispatcher.safe_mint(recipient, token_id, uri);

//     // Arrêter la simulation du caller
//     stop_cheat_caller_address(contract_address);

//     // Vérifier que le propriétaire du token est correct
//     let stored_owner = dispatcher.get_owner_of(token_id);
//     assert!(stored_owner == recipient, "Le proprietaire du token est incorrect");

//     // Vérifier que l'URI du token est correct
//     let stored_uri = dispatcher.get_token_uri(token_id);
//     assert!(stored_uri == uri, "L'URI du token est incorrect");
// }

// #[test]
// #[should_panic]
// fn test_transfer_fails() {
//     // Déclarer et déployer le contrat
//     let owner: ContractAddress = contract_address_const::<1>();
//     let contract = declare("DecentralizedId").unwrap().contract_class();

//     let (contract_address, _) = contract.deploy(@array![owner.into()]).unwrap();

//     let dispatcher = IDecentralizedIdDispatcher { contract_address };

//     // Mint un NFT pour le test
//     start_cheat_caller_address(contract_address, owner);
//     let recipient = contract_address_const::<2>();
//     let token_id = 1_u256;
//     let uri = 'https://example.com/token/1';
//     dispatcher.safe_mint(recipient, token_id, uri);
//     stop_cheat_caller_address(contract_address);

//     // Simuler le transfert (qui doit échouer)
//     let recipient2 = contract_address_const::<3>();
//     dispatcher.transfer(recipient, recipient2, token_id);
// }


