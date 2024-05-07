# OpenTelemetry BatchTracedSpanProcessor

[![JSR](https://jsr.io/badges/@esroyo/otel-batch-traced-span-processor)](https://jsr.io/@esroyo/otel-batch-traced-span-processor) [![JSR Score](https://jsr.io/badges/@esroyo/otel-batch-traced-span-processor/score)](https://jsr.io/@esroyo/otel-batch-traced-span-processor) [![codecov](https://codecov.io/gh/esroyo/opentelemetry-batch-traced-span-processor/graph/badge.svg?token=XIQYWSW3H8)](https://codecov.io/gh/esroyo/opentelemetry-batch-traced-span-processor)

`BatchTracedSpanProcessor` is a class that extends from the official [BatchSpanProcessor](https://www.npmjs.com/package/@opentelemetry/sdk-trace-base) ([@opentelemetry/sdk-trace-base](https://www.npmjs.com/package/@opentelemetry/sdk-trace-base)). It allows to wait for some time before adding the spans into the `BatchSpanProcessor` internal buffer. The intention of the delay is to give more room for a root span to end, before the export happens.

## Use case

If your application is instrumented by the OpenTelemetry SDK library, but the ingestion of the traces is done by a third party agent (for instance [Datadog Agent](https://docs.datadoghq.com/opentelemetry/#otlp-ingest-in-datadog-agent)). Then you have the risk to be sending ended child spans that might be --from the point of view of the third-party collector-- orphan. Depending of the eagerness of the collector, those child spans might be processed too fast and end-up aggregated as "standalone" traces (`resource.name` in Datadog). By waiting some time for at least a root span to exist in a given trace, It is possible to greatly alleviate that situation.
 
## Usage

```ts
import { BasicTracerProvider } from '@opentelemetry/sdk-trace-base';
import { BatchTracedSpanProcessor } from '@esroyo/otel-batch-traced-span-processor'; 
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';

const collectorOptions = {
  url: '<opentelemetry-collector-url>', // url is optional and can be omitted - default is http://localhost:4318/v1/traces
  headers: {
    foo: 'bar'
  }, // an optional object containing custom headers to be sent with each request will only work with http
  concurrencyLimit: 10, // an optional limit on pending requests
};

const provider = new BasicTracerProvider();
const exporter = new OTLPTraceExporter(collectorOptions);
provider.addSpanProcessor(new BatchSpanProcessor(exporter, {
  // The maximum time to wait for the trace to contain a root span
  // before adding the spans into the regular BatchSpanProcessor buffer
  maxWaitByTraceMillis: 30000,
  // All other options of BatchSpanProcessor apply
  // ...
}));

provider.register();
```
