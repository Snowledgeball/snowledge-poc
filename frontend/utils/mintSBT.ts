import { Provider, Account, Contract } from "starknet";
import { abiSBT, addressSBT } from "./abi";

export const mintSBT = async (recipient: any, uri: any) => {
    console.log("mintSBerztznrozehrozehrozeorhoezhrozehroT");
    const NODE_URL = process.env.NEXT_PUBLIC_STARKNET_NODE_URL;
    const FUNDER_PRIVATE_KEY = process.env.FUNDER_PRIVATE_KEY;
    const FUNDER_ADDRESS = process.env.FUNDER_ADDRESS;

    console.log("FUNDER_ADDRESS", FUNDER_ADDRESS);
    console.log("FUNDER_PRIVATE_KEY", FUNDER_PRIVATE_KEY);
    console.log("NODE_URL", NODE_URL);
    console.log("Network URL:", NODE_URL);
    console.log("Contract Address:", addressSBT);
    console.log("Recipient:", recipient);
    console.log("URI:", uri);

    if (!FUNDER_ADDRESS || !FUNDER_PRIVATE_KEY) {
        throw new Error("Missing funder credentials");
    }

    const provider = new Provider({ nodeUrl: NODE_URL });
    const funderAccount = new Account(provider, FUNDER_ADDRESS, FUNDER_PRIVATE_KEY);
    const contract = new Contract(
        abiSBT,
        addressSBT,
        funderAccount
    );

    console.log("uri", uri);

    try {
        const estimatedFee = await contract.estimate("safe_mint", [recipient, uri]);

        console.log("estimatedFee", estimatedFee);

        const txResponse = await contract.invoke("safe_mint", [recipient, uri], {
            maxFee: estimatedFee.overall_fee * BigInt(2)
        });
        const transactionHash = txResponse.transaction_hash;

        console.log("Transaction Hash :", transactionHash);
        return txResponse;

    } catch (error: unknown) {
        if (error instanceof Error) {
            console.error("Erreur lors de la création du SBT :", error.stack);
        } else {
            console.error("Erreur lors de la création du SBT :", error);
        }
        throw error;
    }

}

