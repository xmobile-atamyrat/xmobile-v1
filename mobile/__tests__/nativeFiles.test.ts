import { NativeModules } from 'react-native';
import {
  filesResultScript,
  handleFilesRequest,
  parseFilesRequest,
} from '../src/lib/nativeFiles';

const file = { name: 'a.xlsx', mimeType: 'application/x', base64: 'aGk=' };

describe('parseFilesRequest', () => {
  it('accepts a well-formed request', () => {
    expect(
      parseFilesRequest({ requestId: 'r1', title: 'Store', files: [file] }),
    ).toEqual({ requestId: 'r1', title: 'Store', files: [file] });
  });

  it.each([
    ['no payload', null],
    ['no request id', { files: [file] }],
    ['no files', { requestId: 'r1', files: [] }],
    ['blank name', { requestId: 'r1', files: [{ ...file, name: ' ' }] }],
    ['empty data', { requestId: 'r1', files: [{ ...file, base64: '' }] }],
    ['too many files', { requestId: 'r1', files: Array(51).fill(file) }],
  ])('rejects %s', (_label, payload) => {
    expect(parseFilesRequest(payload)).toBeNull();
  });
});

describe('handleFilesRequest', () => {
  afterEach(() => {
    delete (NativeModules as any).XFileShare;
  });

  it('calls the native module and passes its status back', async () => {
    const share = jest.fn().mockResolvedValue('shared');
    const save = jest.fn().mockResolvedValue('saved');
    (NativeModules as any).XFileShare = { share, save };

    await expect(
      handleFilesRequest('share', { requestId: 'r1', files: [file] }),
    ).resolves.toEqual({ requestId: 'r1', status: 'shared' });
    expect(share).toHaveBeenCalledWith([file], null);

    await expect(
      handleFilesRequest('save', {
        requestId: 'r2',
        title: 'T',
        files: [file],
      }),
    ).resolves.toEqual({ requestId: 'r2', status: 'saved' });
    expect(save).toHaveBeenCalledWith([file], 'T');
  });

  it('reports a failure instead of throwing', async () => {
    (NativeModules as any).XFileShare = {
      share: jest.fn().mockRejectedValue(new Error('disk full')),
    };
    await expect(
      handleFilesRequest('share', { requestId: 'r1', files: [file] }),
    ).resolves.toEqual({
      requestId: 'r1',
      status: 'failed',
      error: 'disk full',
    });
  });

  it('fails cleanly when the module is missing or the request is bad', async () => {
    await expect(
      handleFilesRequest('share', { requestId: 'r1', files: [file] }),
    ).resolves.toMatchObject({ requestId: 'r1', status: 'failed' });
    await expect(
      handleFilesRequest('share', { requestId: 'r2', files: [] }),
    ).resolves.toMatchObject({ requestId: 'r2', status: 'failed' });
    await expect(
      handleFilesRequest('share', { files: [] }),
    ).resolves.toBeNull();
  });

  it('builds the reply script as a FILES_RESULT message event', () => {
    const script = filesResultScript({ requestId: 'r1', status: 'saved' });
    expect(script).toContain('"type":"FILES_RESULT"');
    expect(script).toContain('"requestId":"r1"');
    expect(script.trim().endsWith('true;')).toBe(true);
  });
});
