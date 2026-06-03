import ShelbyClient from '../services/ShelbyClient';
import axios from 'axios';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('ShelbyClient', () => {
  test('uploadDataset uses RPC when available', async () => {
    mockedAxios.post.mockResolvedValueOnce({ data: { blobId: 'blob_test', merkleRoot: '0xabc' } });
    const client = ShelbyClient;
    const res = await client.uploadDataset(Buffer.from('test'), { title: 't' });
    expect(res.blobId).toBe('blob_test');
    expect(res.merkleRoot).toBe('0xabc');
  });

  test('downloadDataset returns buffer when RPC available', async () => {
    const arr = Buffer.from('payload').buffer;
    mockedAxios.get.mockResolvedValueOnce({ data: arr });
    const client = ShelbyClient;
    const buf = await client.downloadDataset('blob_test');
    expect(Buffer.isBuffer(buf)).toBe(true);
  });
});
