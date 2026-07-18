/**
 * Boundary validation and parsing for all externally supplied data.
 *
 * Every uploaded graph or crowd dataset passes through a strict `zod` schema
 * (`.strict()` rejects unknown fields) plus semantic checks before it can reach
 * the routing core. Malformed input yields a typed {@link ValidationError} — it
 * never throws an unhandled exception or reaches the engine. Treating all
 * uploads as hostile here is what keeps the rest of the code able to trust its
 * inputs.
 */

import { z } from 'zod';

import {
  COORD_MAX,
  COORD_MIN,
  DENSITY_MAX,
  DENSITY_MIN,
  MAX_CROWD_SAMPLES,
  MAX_EDGES,
  MAX_NODES,
  MAX_UPLOAD_CHARS,
  MINUTE_MAX,
  MINUTE_MIN,
} from './constants';
import { ValidationError } from './errors';
import { segmentKey } from './graph';
import type { CrowdDataset, CrowdSample, StadiumGraphData } from './types';
import { runSchema } from './validation';

const MAX_ID_LENGTH = 64;
const MAX_LABEL_LENGTH = 120;
const MAX_DISTANCE_M = 100000;
const MAX_WIDTH_M = 1000;
const CROWD_HEADER: readonly string[] = ['from', 'to', 'minute', 'density'];
/** CSV data rows start on line 2 (after the header); offset for messages. */
const DATA_ROW_LINE_OFFSET = 2;

const nodeSchema = z
  .object({
    id: z.string().trim().min(1).max(MAX_ID_LENGTH),
    label: z.string().trim().min(1).max(MAX_LABEL_LENGTH),
    kind: z.enum(['gate', 'concourse', 'transition', 'seat', 'exit', 'facility']),
    x: z.number().min(COORD_MIN).max(COORD_MAX),
    y: z.number().min(COORD_MIN).max(COORD_MAX),
  })
  .strict();

const edgeSchema = z
  .object({
    from: z.string().trim().min(1).max(MAX_ID_LENGTH),
    to: z.string().trim().min(1).max(MAX_ID_LENGTH),
    distanceMeters: z.number().positive().max(MAX_DISTANCE_M),
    mode: z.enum(['level', 'ramp', 'stairs', 'elevator', 'escalator']),
    widthMeters: z.number().positive().max(MAX_WIDTH_M),
    bidirectional: z.boolean(),
  })
  .strict();

const graphSchema = z
  .object({
    nodes: z.array(nodeSchema).min(2).max(MAX_NODES),
    edges: z.array(edgeSchema).min(1).max(MAX_EDGES),
  })
  .strict();

const crowdJsonSchema = z
  .object({
    label: z.string().trim().min(1).max(MAX_LABEL_LENGTH).optional(),
    samples: z
      .array(
        z
          .object({
            from: z.string().trim().min(1).max(MAX_ID_LENGTH),
            to: z.string().trim().min(1).max(MAX_ID_LENGTH),
            minute: z.number().int().min(MINUTE_MIN).max(MINUTE_MAX),
            density: z.number().min(DENSITY_MIN).max(DENSITY_MAX),
          })
          .strict(),
      )
      .min(1)
      .max(MAX_CROWD_SAMPLES),
  })
  .strict();

const crowdSampleSchema = z
  .object({
    segment: z.string().min(1),
    minuteOfDay: z.number().int().min(MINUTE_MIN).max(MINUTE_MAX),
    density: z.number().min(DENSITY_MIN).max(DENSITY_MAX),
  })
  .strict();

function assertUploadSize(text: string): void {
  if (text.length > MAX_UPLOAD_CHARS) {
    throw new ValidationError(`Upload exceeds the ${MAX_UPLOAD_CHARS}-character limit.`);
  }
}

function assertUniqueNodeIds(nodes: StadiumGraphData['nodes']): void {
  const seen = new Set<string>();
  for (const node of nodes) {
    if (seen.has(node.id)) {
      throw new ValidationError(`Duplicate node id "${node.id}".`);
    }
    seen.add(node.id);
  }
}

function assertNoSelfLoops(edges: StadiumGraphData['edges']): void {
  for (const edge of edges) {
    if (edge.from === edge.to) {
      throw new ValidationError(`Edge cannot start and end at the same node "${edge.from}".`);
    }
  }
}

/**
 * Validates and normalises an untrusted stadium graph payload. Rejects unknown
 * fields, duplicate node ids, and self-loop edges. Runs in `O(V + E)`.
 */
export function parseGraph(input: unknown): StadiumGraphData {
  const parsed = runSchema(graphSchema, input, 'Stadium graph failed validation.');
  assertUniqueNodeIds(parsed.nodes);
  assertNoSelfLoops(parsed.edges);
  return parsed;
}

/** Reads a quoted CSV field beginning after the opening quote. */
function readQuotedField(text: string, start: number): { value: string; next: number } {
  let value = '';
  let index = start;
  while (index < text.length) {
    const char = text[index] as string;
    if (char === '"') {
      if (text[index + 1] === '"') {
        value += '"';
        index += 2;
        continue;
      }
      return { value, next: index + 1 };
    }
    value += char;
    index += 1;
  }
  return { value, next: index };
}

/** Minimal RFC-4180-style CSV parser handling quotes, escapes, and CRLF. */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let started = false;
  let index = 0;
  while (index < text.length) {
    const char = text[index] as string;
    if (char === '"') {
      const quoted = readQuotedField(text, index + 1);
      field += quoted.value;
      index = quoted.next;
      started = true;
    } else if (char === ',') {
      row.push(field);
      field = '';
      started = true;
      index += 1;
    } else if (char === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
      started = false;
      index += 1;
    } else {
      if (char !== '\r') {
        field += char;
        started = true;
      }
      index += 1;
    }
  }
  if (started) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

function assertHeader(header: readonly string[]): void {
  const normalised = header.map((column) => column.trim().toLowerCase());
  const matches =
    normalised.length === CROWD_HEADER.length &&
    CROWD_HEADER.every((expected, index) => normalised[index] === expected);
  if (!matches) {
    throw new ValidationError(`CSV header must be exactly "${CROWD_HEADER.join(',')}".`);
  }
}

function parseNumericCell(raw: string, rowIndex: number, field: string): number {
  const value = Number(raw.trim());
  if (!Number.isFinite(value)) {
    throw new ValidationError(
      `Row ${rowIndex + DATA_ROW_LINE_OFFSET} has a non-numeric ${field}: "${raw}".`,
    );
  }
  return value;
}

function rowToSample(row: readonly string[], rowIndex: number): CrowdSample {
  if (row.length !== CROWD_HEADER.length) {
    throw new ValidationError(
      `Row ${rowIndex + DATA_ROW_LINE_OFFSET} must have ${CROWD_HEADER.length} columns.`,
    );
  }
  const from = (row[0] as string).trim();
  const to = (row[1] as string).trim();
  const minute = parseNumericCell(row[2] as string, rowIndex, 'minute');
  const density = parseNumericCell(row[3] as string, rowIndex, 'density');
  return runSchema(
    crowdSampleSchema,
    { segment: segmentKey(from, to), minuteOfDay: minute, density },
    `Row ${rowIndex + DATA_ROW_LINE_OFFSET} failed validation.`,
  );
}

/**
 * Parses a crowd-density CSV (`from,to,minute,density`) into a validated
 * dataset. Runs in `O(rows)`.
 */
export function parseCrowdCsv(text: string, id: string, label: string): CrowdDataset {
  assertUploadSize(text);
  const rows = parseCsv(text.trim());
  const header = rows[0];
  if (header === undefined) {
    throw new ValidationError('CSV is empty.');
  }
  assertHeader(header);
  const dataRows = rows.slice(1);
  if (dataRows.length === 0) {
    throw new ValidationError('CSV has a header but no data rows.');
  }
  const samples = dataRows.map((row, index) => rowToSample(row, index));
  return { id, label, samples };
}

/**
 * Parses a crowd-density JSON payload into a validated dataset, computing the
 * order-independent segment key for each sample. Runs in `O(samples)`.
 */
export function parseCrowdJson(input: unknown, id: string, fallbackLabel: string): CrowdDataset {
  const parsed = runSchema(crowdJsonSchema, input, 'Crowd dataset failed validation.');
  const samples: CrowdSample[] = parsed.samples.map((sample) => ({
    segment: segmentKey(sample.from, sample.to),
    minuteOfDay: sample.minute,
    density: sample.density,
  }));
  return { id, label: parsed.label ?? fallbackLabel, samples };
}
