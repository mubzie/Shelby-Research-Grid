export const Network = {
  SHELBYNET: 'shelbynet',
  DEVNET: 'devnet',
  TESTNET: 'testnet',
  MAINNET: 'mainnet',
  LOCAL: 'local',
}

export const AptosConfig = jest.fn()

export class Aptos {
  transaction = { build: { simple: jest.fn() } }
  signAndSubmitTransaction = jest.fn()
  waitForTransaction = jest.fn()
  view = jest.fn()
  getAccountModules = jest.fn()
  getAccountAPTAmount = jest.fn()
  getAccountBalance = jest.fn()
}

export const Account = {
  fromPrivateKey: jest.fn(() => ({
    accountAddress: { toString: () => '0xed8c', toUint8Array: () => new Uint8Array(32) },
    publicKey: { authKey: () => ({ data: new Uint8Array(32) }) },
  })),
}

export const AccountAddress = {
  from: jest.fn((a: string) => ({ toString: () => a })),
  fromString: jest.fn((a: string) => ({ toString: () => a })),
}

export const Ed25519PrivateKey = jest.fn()
