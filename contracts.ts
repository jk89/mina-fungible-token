import { FungibleTokenAdmin } from './FungibleTokenAdmin.js';
import { FungibleToken } from './FungibleToken.js';

FungibleToken.AdminContract = FungibleTokenAdmin;
FungibleTokenAdmin.TokenContract = FungibleToken;

export { FungibleToken, FungibleTokenAdmin };