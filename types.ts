import { AccountUpdate, Bool, PublicKey, SmartContract, VerificationKey } from "o1js"

export type FungibleTokenAdminBase = SmartContract & {
  canMint(accountUpdate: AccountUpdate): Promise<Bool>
  canChangeAdmin(admin: PublicKey): Promise<Bool>
  canPause(): Promise<Bool>
  canResume(): Promise<Bool>
  canChangeVerificationKey(vk: VerificationKey): Promise<Bool>
}