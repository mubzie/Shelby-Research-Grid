export const ShelbyNodeClient = jest.fn()
export const createDefaultErasureCodingProvider = jest.fn().mockResolvedValue({})
export const generateCommitments = jest.fn()
export const generateMerkleRoot = jest.fn()
export const ClayErasureCodingProvider = { create: jest.fn().mockResolvedValue({}) }
