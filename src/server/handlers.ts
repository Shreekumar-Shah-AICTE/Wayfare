/**
 * Request handlers: the seam between validated input and the deterministic core.
 *
 * Each handler validates its input with a strict schema, drives the pure core
 * (routing, planning) and the store, and returns a transport-neutral
 * {@link ApiResult}. The thin Next.js route files only adapt `Request` in and
 * `NextResponse` out — all testable logic lives here.
 */

import { z } from 'zod';

import { parseCrowdCsv, parseCrowdJson } from '@/core/ingest';
import { planJourney } from '@/core/planner';
import { segmentKey } from '@/core/graph';
import type { CrowdIndex } from '@/core/crowd';
import { DEFAULT_CROWD_DATASET } from '@/core/seed-crowd';
import { DEFAULT_STADIUM, DEMO_ROUTE } from '@/core/stadium';
import type { RouteRequest } from '@/core/routing';
import type { CrowdDataset } from '@/core/types';
import { runSchema } from '@/core/validation';
import { getGenerationClient } from '@/ai/client';
import { narrateRoute } from '@/ai/narrator';

import { isRtlLocale, RTL_LOCALES, SUPPORTED_LOCALES } from './config';
import { success, type ApiResult } from './respond';
import { getStore } from './store';

const MAX_LABEL_LENGTH = 120;
const DEFAULT_LABEL = 'Uploaded crowd data';
const HTTP_CREATED = 201;
const PROFILE_VALUES = ['standard', 'stepFree', 'wheelchair', 'lowSensory'] as const;

const routeShape = {
  originId: z.string().trim().min(1).max(64),
  destinationId: z.string().trim().min(1).max(64),
  profile: z.enum(PROFILE_VALUES),
  minuteOfDay: z.number().int().min(0).max(1439),
  datasetId: z.string().trim().min(1).max(64).optional(),
};

const routeSchema = z.object(routeShape).strict();
const narrateSchema = z.object({ ...routeShape, locale: z.enum(SUPPORTED_LOCALES) }).strict();

type RouteInput = z.infer<typeof routeSchema>;

function toQuery(input: RouteInput): RouteRequest {
  return {
    originId: input.originId,
    destinationId: input.destinationId,
    profile: input.profile,
    minuteOfDay: input.minuteOfDay,
  };
}

function datasetIdOf(input: RouteInput): string {
  return input.datasetId ?? DEFAULT_CROWD_DATASET.id;
}

function newDatasetId(): string {
  return `ds-${globalThis.crypto.randomUUID()}`;
}

function normaliseLabel(label: string): string {
  const trimmed = label.trim();
  const base = trimmed.length === 0 ? DEFAULT_LABEL : trimmed;
  return base.slice(0, MAX_LABEL_LENGTH);
}

/** Density of every graph edge at a given time, for the map heat overlay. */
function computeHeat(
  crowd: CrowdIndex,
  minuteOfDay: number,
): { from: string; to: string; density: number }[] {
  return DEFAULT_STADIUM.edges.map((edge) => ({
    from: edge.from,
    to: edge.to,
    density: crowd.densityAt(segmentKey(edge.from, edge.to), minuteOfDay),
  }));
}

/** Computes a route and its navigation steps for a validated request body. */
export function planRouteHandler(input: unknown): ApiResult {
  const parsed = runSchema(routeSchema, input, 'Route request failed validation.');
  const store = getStore();
  const crowd = store.crowdIndex(datasetIdOf(parsed));
  const plan = planJourney(store.graph(), crowd, toQuery(parsed));
  return success({
    datasetId: datasetIdOf(parsed),
    route: plan.route,
    steps: plan.steps,
    heat: computeHeat(crowd, parsed.minuteOfDay),
  });
}

/** Registers a validated dataset and returns its summary envelope. */
function registerDataset(dataset: CrowdDataset): ApiResult {
  getStore().register(dataset);
  return success(
    { id: dataset.id, label: dataset.label, sampleCount: dataset.samples.length },
    HTTP_CREATED,
  );
}

/** Registers an uploaded crowd CSV and returns its summary. */
export function ingestCsvHandler(text: string, label: string): ApiResult {
  return registerDataset(parseCrowdCsv(text, newDatasetId(), normaliseLabel(label)));
}

/** Registers an uploaded crowd JSON payload and returns its summary. */
export function ingestJsonHandler(input: unknown, label: string): ApiResult {
  return registerDataset(parseCrowdJson(input, newDatasetId(), normaliseLabel(label)));
}

/** Returns the graph, dataset list, and locale metadata the UI needs to boot. */
export function metadataHandler(): ApiResult {
  const store = getStore();
  return success({
    graph: { nodes: DEFAULT_STADIUM.nodes, edges: DEFAULT_STADIUM.edges },
    datasets: store.summaries(),
    profiles: PROFILE_VALUES,
    locales: SUPPORTED_LOCALES,
    rtlLocales: RTL_LOCALES,
    demo: DEMO_ROUTE,
  });
}

/** Recomputes a route server-side and narrates it in the requested locale. */
export async function narrateHandler(input: unknown): Promise<ApiResult> {
  const parsed = runSchema(narrateSchema, input, 'Narration request failed validation.');
  const store = getStore();
  const crowd = store.crowdIndex(datasetIdOf(parsed));
  const plan = planJourney(store.graph(), crowd, toQuery(parsed));
  const narration = await narrateRoute(plan.steps, parsed.locale, {
    client: getGenerationClient(),
  });
  return success({
    narration,
    rtl: isRtlLocale(parsed.locale),
    route: plan.route,
    steps: plan.steps,
  });
}
