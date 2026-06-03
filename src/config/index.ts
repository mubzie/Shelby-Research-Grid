export default {
  server: {
    port: parseInt(process.env.PORT || '3001', 10),
    env: process.env.NODE_ENV || 'development',
    logLevel: process.env.LOG_LEVEL || 'info'
  },
  database: {
    url: process.env.DATABASE_URL || 'postgresql://localhost/shelby_research_db',
    poolSize: parseInt(process.env.DB_POOL_SIZE || '10', 10)
  },
  aptos: {
    network: process.env.APTOS_NETWORK || 'testnet',
    rpcUrl: process.env.APTOS_RPC_URL || 'https://fullnode.testnet.aptoslabs.com/v1',
    privateKey: process.env.APTOS_PRIVATE_KEY || '',
    moduleAddress: process.env.APTOS_MODULE_ADDRESS || ''
  },
  shelby: {
    rpcUrl: process.env.SHELBY_RPC_URL || 'https://shelby-devnet.example.com',
    apiKey: process.env.SHELBY_API_KEY || ''
  },
  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000'
  },
  jwt: {
    secret: process.env.JWT_SECRET || 'dev-secret-change-in-prod'
  },
  encryption: {
    algorithm: process.env.ENCRYPTION_ALGORITHM || 'aes-256-gcm'
  },
  payment: {
    micropaymentRateMillAPT: parseInt(process.env.MICROPAYMENT_RATE_MILLAPT || '1', 10),
    platformFeePercentage: parseInt(process.env.PLATFORM_FEE_PERCENTAGE || '20', 10)
  }
};
