// Use Vite's import.meta.env in the browser. Tests replace this module via jest.mock.
export const API_BASE_URL = (import.meta.env?.VITE_API_BASE_URL) ?? 'http://localhost:3001'
export const APTOS_FULLNODE_URL = (import.meta.env?.VITE_APTOS_FULLNODE_URL) ?? 'https://fullnode.testnet.aptoslabs.com/v1'
export const APTOS_MODULE_ADDRESS = (import.meta.env?.VITE_APTOS_MODULE_ADDRESS) ?? '0xed8c57d7438e3a8ac788e9b166ec576c2f2ecfbd29d973815af294af4d755a4f'
