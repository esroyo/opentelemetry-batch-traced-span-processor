import {
    type BufferConfig,
    type ReadableSpan,
    type SpanContext,
} from '../deps.ts';

export type TraceId = SpanContext['traceId'];

export type SpanGroup = {
  spans: ReadableSpan[];
  traceId: TraceId;
  timer?: ReturnType<typeof setTimeout>;
};


export type BufferTracedConfig = BufferConfig & {
  /**
   * The deadline in milliseconds to await for the end of the Trace's span root
   * before dispatching the spans to the regular BatchSpanProcessor scheduler.
   * The default value is 30000ms.
   */
  maxWaitByTraceMillis?: number;
};

export type HasPartialSpanContext = {
  spanContext: () => Pick<SpanContext, 'traceId' | 'traceFlags'>;
};

export type PartialReadableSpan =
  & Pick<ReadableSpan, 'parentSpanId'>
  & HasPartialSpanContext;
