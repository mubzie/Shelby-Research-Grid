declare module '*.css' {
  const content: Record<string, string>
  export default content
}

declare module '*.scss' {
  const content: Record<string, string>
  export default content
}

interface AptosWalletProvider {
  connect: () => Promise<{ address: string }>
  disconnect?: () => Promise<void>
  account?: () => Promise<{ address: string }>
}

declare global {
  interface Window {
    aptos?: AptosWalletProvider
  }
}

export {}
