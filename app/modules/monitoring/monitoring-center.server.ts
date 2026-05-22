import { performance } from "node:perf_hooks";
import type { CompanyWorkspace } from "../company-workspace/company-workspace.server";
import { ActivityLogCenter } from "../activity-log/activity-log-center.server";
import { getRuntimeConfig, type RuntimeConfig } from "../runtime-config.server";

export type MetricEvent = {
  name: string;
  value?: number;
  tags?: Record<string, string | number | boolean | null | undefined>;
};

type StoredMetric = MetricEvent & {
  value: number;
  recordedAt: string;
};

const metrics: StoredMetric[] = [];

export class MetricsCenter {
  recordCounter(name: string, tags: MetricEvent["tags"] = {}) {
    this.recordMetric({ name, value: 1, tags });
  }

  recordDuration(name: string, ms: number, tags: MetricEvent["tags"] = {}) {
    this.recordMetric({ name, value: ms, tags: { ...tags, unit: "ms" } });
  }

  recordMetric(event: MetricEvent) {
    metrics.push({ ...event, value: event.value ?? 1, recordedAt: new Date().toISOString() });
    if (metrics.length > 1000) metrics.splice(0, metrics.length - 1000);
  }

  getOperationalMetrics() {
    const counters = new Map<string, number>();
    for (const metric of metrics) {
      const key = metricKey(metric);
      counters.set(key, (counters.get(key) ?? 0) + metric.value);
    }
    return {
      count: metrics.length,
      latest: metrics.slice(-50).reverse(),
      aggregates: [...counters.entries()].map(([name, value]) => ({ name, value })),
    };
  }
}

export class ErrorReporter {
  constructor(private readonly config: RuntimeConfig = getRuntimeConfig()) {}

  captureException(error: unknown, context: Record<string, unknown> = {}) {
    const message = error instanceof Error ? error.message : String(error);
    if (this.config.observabilityMode === "local") {
      console.error("[qitus:error]", JSON.stringify({ message, context: redact(context) }));
    }
    return { message, context: redact(context), reported: this.config.observabilityMode !== "disabled" };
  }
}

export class MonitoringCenter {
  constructor(
    private readonly metrics = new MetricsCenter(),
    private readonly errors = new ErrorReporter(),
    private readonly activity = new ActivityLogCenter()
  ) {}

  recordMetric(event: MetricEvent) {
    this.metrics.recordMetric(event);
  }

  recordDuration(name: string, ms: number, tags: MetricEvent["tags"] = {}) {
    this.metrics.recordDuration(name, ms, tags);
  }

  recordCounter(name: string, tags: MetricEvent["tags"] = {}) {
    this.metrics.recordCounter(name, tags);
  }

  captureException(error: unknown, context: Record<string, unknown> = {}) {
    return this.errors.captureException(error, context);
  }

  async recordProductMetric(workspace: CompanyWorkspace, name: string, metadata: Record<string, unknown> = {}) {
    this.recordCounter(name, { companyId: workspace.company.id, fiscalYearId: workspace.fiscalYear.id });
    await this.activity.recordActivity(workspace, {
      action: "monitoring.metric_recorded",
      entityType: "monitoring",
      entityId: name,
      metadata,
    });
  }

  getOperationalMetrics() {
    return this.metrics.getOperationalMetrics();
  }
}

export async function timed<T>(name: string, callback: () => Promise<T>, tags: MetricEvent["tags"] = {}) {
  const start = performance.now();
  try {
    const result = await callback();
    new MetricsCenter().recordDuration(name, performance.now() - start, { ...tags, status: "success" });
    return result;
  } catch (error) {
    new MetricsCenter().recordDuration(name, performance.now() - start, { ...tags, status: "failed" });
    new ErrorReporter().captureException(error, { metric: name, ...tags });
    throw error;
  }
}

function metricKey(metric: StoredMetric) {
  return `${metric.name}${metric.tags ? `:${JSON.stringify(metric.tags)}` : ""}`;
}

function redact(value: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [
    key,
    /secret|token|key|password/i.test(key) ? "[redacted]" : item,
  ]));
}
