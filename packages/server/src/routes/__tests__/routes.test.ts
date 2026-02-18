import { describe, it, expect } from 'vitest';

describe('route modules export expected functions', () => {
  it('graphql.ts exports registerGraphQL', async () => {
    const mod = await import('../graphql');
    expect(mod.registerGraphQL).toBeTypeOf('function');
  });

  it('snapshot.ts exports registerSnapshot', async () => {
    const mod = await import('../snapshot');
    expect(mod.registerSnapshot).toBeTypeOf('function');
  });

  it('snapshot-handler.ts exports createSnapshotHandler', async () => {
    const mod = await import('../snapshot-handler');
    expect(mod.createSnapshotHandler).toBeTypeOf('function');
  });

  it('createSnapshotHandler returns a function (request handler)', async () => {
    const { createSnapshotHandler } = await import('../snapshot-handler');
    const handler = createSnapshotHandler({} as any, {} as any);
    expect(handler).toBeTypeOf('function');
  });
});
