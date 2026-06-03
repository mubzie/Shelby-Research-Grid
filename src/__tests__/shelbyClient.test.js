const axios = require('axios');
jest.mock('axios');
const mockedAxios = axios;

describe('ShelbyClient', () => {
  test('uploadDataset uses RPC when available', async () => {
    mockedAxios.post = jest.fn().mockResolvedValueOnce({ data: { blobId: 'blob_test', merkleRoot: '0xabc' } });
    const client = require('../services/ShelbyClient').default;
    const res = await client.uploadDataset(Buffer.from('test'), { title: 't' });
    expect(res.blobId).toBeDefined();
    expect(res.merkleRoot).toBeDefined();
  });

  test('downloadDataset returns buffer when RPC available', async () => {
    const arr = Buffer.from('payload').buffer;
    mockedAxios.get = jest.fn().mockResolvedValueOnce({ data: arr });
    const client = require('../services/ShelbyClient').default;
    const buf = await client.downloadDataset('blob_test');
    expect(Buffer.isBuffer(buf)).toBe(true);
  });
});
