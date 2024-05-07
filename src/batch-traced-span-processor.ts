import {
    BatchSpanProcessor,
    ReadableSpan,
    SpanExporter,
    TraceFlags,
} from '../deps.ts';

import { SpanGroup, TraceId } from './types.ts';

const DEFAULT_MAX_WAIT_BY_TRACE_MILLIS = 30000;

// @ts-ignore private
export class BatchTracedSpanProcessor<T extends BufferTracedConfig>
    extends BatchSpanProcessor {
    protected _pendingSpansByTrace = new Map<TraceId, SpanGroup>();

    protected _maxWaitByTraceMillis: number = DEFAULT_MAX_WAIT_BY_TRACE_MILLIS;

    constructor(_exporter: SpanExporter, config?: T) {
        super(_exporter, config);
        if (typeof config?.maxWaitByTraceMillis === 'number') {
            this._maxWaitByTraceMillis = config.maxWaitByTraceMillis;
        }
    }

    onEnd(span: ReadableSpan): void {
        // @ts-ignore private
        if (this._shutdownOnce.isCalled) {
            return;
        }

        if ((span.spanContext().traceFlags & TraceFlags.SAMPLED) === 0) {
            return;
        }

        const traceId = span.spanContext().traceId;
        const pending = this._pendingSpansByTrace.get(traceId) ||
            { spans: [], traceId };

        pending.spans.push(span as ReadableSpan);
        this._pendingSpansByTrace.set(traceId, pending);

        if (pending.timer) {
            clearTimeout(pending.timer);
        }

        const groupContainsRootSpan = pending.spans.some((span) =>
            !span.parentSpanId
        );

        if (groupContainsRootSpan) {
            this._flushPendingSpanGroup(pending);
        } else {
            pending.timer = setTimeout(() => {
                this._flushPendingSpanGroup(pending);
            }, this._maxWaitByTraceMillis);
        }
    }

    forceFlush() {
        // @ts-ignore private
        if (this._shutdownOnce.isCalled) {
            // @ts-ignore private
            return this._shutdownOnce.promise;
        }
        return Promise.resolve()
            .then(() => {
                return this._flushPendingSpanGroups();
            }).then(() => {
                return super.forceFlush();
            });
    }

    protected _flushPendingSpanGroup(pendingSpanGroup: SpanGroup) {
        delete pendingSpanGroup.timer;
        for (const span of pendingSpanGroup.spans) {
            // @ts-ignore private
            this._addToBuffer(span);
        }
        this._pendingSpansByTrace.delete(pendingSpanGroup.traceId);
    }

    protected _flushPendingSpanGroups() {
        for (const pendingGroup of this._pendingSpansByTrace.values()) {
            this._flushPendingSpanGroup(pendingGroup);
        }
    }

    // @ts-ignore private
    protected _shutdown() {
        return Promise.resolve()
            .then(() => {
                return this._flushPendingSpanGroups();
            })
            .then(() => {
                // @ts-ignore private
                return super._shutdown();
            });
    }
}
