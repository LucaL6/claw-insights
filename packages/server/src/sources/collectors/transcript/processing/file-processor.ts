import type { FileResult, FileState, FileTask, TranscriptSink } from '../types.js';

export interface FileProcessorOpts {
  process: (task: FileTask, opts?: { maxBytes?: number }) => Promise<FileResult>;
  sink: TranscriptSink;
  chunkBytes?: number;
}

export function createFileProcessor(opts: FileProcessorOpts) {
  const chunkBytes = opts.chunkBytes ?? Number.POSITIVE_INFINITY;

  return async (task: FileTask): Promise<FileState> => {
    if (chunkBytes === Number.POSITIVE_INFINITY) {
      const result = await opts.process(task);
      opts.sink.accept(result);
      return result.newState;
    }

    let currentTask: FileTask = task;

    while (true) {
      const result = await opts.process(currentTask, { maxBytes: chunkBytes });
      opts.sink.accept(result);

      if (result.newState.offset === currentTask.offset) {
        return result.newState;
      }

      currentTask = {
        ...currentTask,
        offset: result.newState.offset,
        partial: result.newState.partial,
        inode: result.newState.inode,
        birthtimeMs: result.newState.birthtimeMs,
      };
    }
  };
}
