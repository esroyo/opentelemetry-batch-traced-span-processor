import { ReadableSpan, TraceFlags } from '../deps.ts';
import { assertEquals, assertSpyCalls, InMemorySpanExporter, FakeTime, spy } from '../dev_deps.ts';

import { BatchTracedSpanProcessor } from './batch-traced-span-processor.ts';

type ReadableSpanOptions = {
  parentSpanId?: string;
  traceId: string;
  traceFlags?: TraceFlags;
};

const createReadableSpan = (
  { traceId, parentSpanId, traceFlags = TraceFlags.SAMPLED }:
    ReadableSpanOptions,
) => ({
  parentSpanId,
  resource: {},
  spanContext: () => ({ traceId, traceFlags }),
} as ReadableSpan);

Deno.test('BatchTracedSpanProcessor', async (t) => {
  await t.step('onEnd', async (t) => {
    await t.step(
      'should await the configured millis before pushing a non-root span to the buffer',
      async (t) => {
        using time = new FakeTime();
        const processor = new BatchTracedSpanProcessor(
          new InMemorySpanExporter(),
          {
            maxWaitByTraceMillis: 5000,
          },
        );
        // @ts-ignore private
        const addToBufferSpy = processor._addToBuffer = spy(
          // @ts-ignore private
          processor._addToBuffer,
        );
        const span = createReadableSpan({
          traceId: '1',
          parentSpanId: '2',
        });

        assertSpyCalls(addToBufferSpy, 0);
        processor.onEnd(span);

        assertSpyCalls(addToBufferSpy, 0);
        await time.tickAsync(5000);

        assertSpyCalls(addToBufferSpy, 1);
        assertEquals(
          addToBufferSpy.calls?.[0]?.args?.[0],
          span,
        );
        await processor.shutdown();
      },
    );

    await t.step(
      'should renew the awaiting on each span end',
      async (t) => {
        using time = new FakeTime();
        const processor = new BatchTracedSpanProcessor(
          new InMemorySpanExporter(),
          {
            maxWaitByTraceMillis: 5000,
          },
        );
        // @ts-ignore private
        const addToBufferSpy = processor._addToBuffer = spy(
          // @ts-ignore private
          processor._addToBuffer,
        );
        const span = createReadableSpan({
          traceId: '1',
          parentSpanId: '2',
        });

        assertSpyCalls(addToBufferSpy, 0);
        processor.onEnd(span);

        await time.tickAsync(4000);

        assertSpyCalls(addToBufferSpy, 0);
        const anotherSpan = createReadableSpan({
          traceId: '1',
          parentSpanId: 'x',
        });

        processor.onEnd(anotherSpan);
        await time.tickAsync(4000);
        assertSpyCalls(addToBufferSpy, 0);

        await time.tickAsync(1000);

        assertSpyCalls(addToBufferSpy, 2);
        assertEquals(
          addToBufferSpy.calls?.[0]?.args?.[0],
          span,
        );
        assertEquals(
          addToBufferSpy.calls?.[1]?.args?.[0],
          anotherSpan,
        );
        await processor.shutdown();
      },
    );

    await t.step(
      'should push to the buffer the spans of a given trace once a root span has ended',
      async (t) => {
        using time = new FakeTime();
        const processor = new BatchTracedSpanProcessor(
          new InMemorySpanExporter(),
          {
            maxWaitByTraceMillis: 5000,
          },
        );
        // @ts-ignore private
        const addToBufferSpy = processor._addToBuffer = spy(
          // @ts-ignore private
          processor._addToBuffer,
        );
        const span = createReadableSpan({
          traceId: '1',
          parentSpanId: '2',
        });

        assertSpyCalls(addToBufferSpy, 0);
        processor.onEnd(span);

        await time.tickAsync(4000);

        assertSpyCalls(addToBufferSpy, 0);
        const rootSpan = createReadableSpan({
          traceId: '1',
        });

        processor.onEnd(rootSpan);
        await time.runMicrotasks();

        assertSpyCalls(addToBufferSpy, 2);
        assertEquals(
          addToBufferSpy.calls?.[0]?.args?.[0],
          span,
        );
        assertEquals(
          addToBufferSpy.calls?.[1]?.args?.[0],
          rootSpan,
        );
        await processor.shutdown();
      },
    );

    await t.step(
      'should await independently for each traceId',
      async (t) => {
        using time = new FakeTime();
        const processor = new BatchTracedSpanProcessor(
          new InMemorySpanExporter(),
          {
            maxWaitByTraceMillis: 5000,
          },
        );
        // @ts-ignore private
        const addToBufferSpy = processor._addToBuffer = spy(
          // @ts-ignore private
          processor._addToBuffer,
        );
        const span = createReadableSpan({
          traceId: '1',
          parentSpanId: '2',
        });

        assertSpyCalls(addToBufferSpy, 0);
        processor.onEnd(span);

        await time.tickAsync(4000);

        assertSpyCalls(addToBufferSpy, 0);
        const anotherSpan = createReadableSpan({
          traceId: '2',
          parentSpanId: 'x',
        });

        processor.onEnd(anotherSpan);

        await time.tickAsync(1000);

        assertSpyCalls(addToBufferSpy, 1);
        assertEquals(
          addToBufferSpy.calls?.[0]?.args?.[0],
          span,
        );

        await time.tickAsync(3000);
        assertSpyCalls(addToBufferSpy, 1);

        await time.tickAsync(1000);

        assertSpyCalls(addToBufferSpy, 2);
        assertEquals(
          addToBufferSpy.calls?.[1]?.args?.[0],
          anotherSpan,
        );
        await processor.shutdown();
      },
    );
  });
});
