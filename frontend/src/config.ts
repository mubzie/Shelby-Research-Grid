// Use Vite's import.meta.env in the browser. Cast to any so ts-jest tests keep working.
export const API_BASE_URL = ((import.meta as any).env?.VITE_API_BASE_URL) ?? 'http://localhost:3001'
export const APTOS_FULLNODE_URL = ((import.meta as any).env?.VITE_APTOS_FULLNODE_URL) ?? 'https://fullnode.testnet.aptoslabs.com/v1'
