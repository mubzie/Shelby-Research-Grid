// Use Vite's import.meta.env in the browser. Tests replace this module via jest.mock.
export const API_BASE_URL = (import.meta.env?.VITE_API_BASE_URL) ?? 'http://localhost:3001'
export const APTOS_FULLNODE_URL = (import.meta.env?.VITE_APTOS_FULLNODE_URL) ?? 'https://fullnode.testnet.aptoslabs.com/v1'
