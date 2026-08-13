import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@ant-design/v5-patch-for-react-19'
import './index.css'
import '@aptos-labs/wallet-adapter-ant-design/dist/index.css'
import App from './App.tsx'
import { AptosWalletAdapterProvider } from '@aptos-labs/wallet-adapter-react'
import { Network } from '@aptos-labs/ts-sdk'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AptosWalletAdapterProvider
      autoConnect={true}
      dappConfig={{ network: Network.TESTNET }}
      optInWallets={['Petra']}
      onError={(error) => console.error('Wallet error:', error)}
    >
      <App />
    </AptosWalletAdapterProvider>
  </StrictMode>,
)
