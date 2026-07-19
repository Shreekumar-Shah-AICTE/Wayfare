'use client';

import { useCallback, useEffect, useState, type ReactElement } from 'react';

import { PlannerLayout } from '@/components/Planner';
import {
  ApiError,
  fetchMetadata,
  narrateRouteRequest,
  planRoute,
  type DatasetSummary,
  type MetadataPayload,
  type NarrationPayload,
  type RoutePayload,
} from '@/lib/api';
import type { RouteForm, Status } from '@/lib/types';

function initialForm(metadata: MetadataPayload): RouteForm {
  return {
    originId: metadata.demo.originId,
    destinationId: metadata.demo.destinationId,
    minuteOfDay: metadata.demo.minuteOfDay,
    profile: 'standard',
    locale: 'en',
    datasetId: metadata.datasets[0]?.id ?? '',
  };
}

/**
 * The stateful client page: it loads stadium metadata, auto-plans the demo
 * route, and owns the form, route, and narration state that {@link PlannerLayout}
 * renders. All routing decisions come from the server/core; this component only
 * orchestrates fetches and holds UI state.
 */
export default function HomePage(): ReactElement {
  const [metadata, setMetadata] = useState<MetadataPayload | null>(null);
  const [datasets, setDatasets] = useState<readonly DatasetSummary[]>([]);
  const [form, setForm] = useState<RouteForm | null>(null);
  const [routeData, setRouteData] = useState<RoutePayload | null>(null);
  const [narration, setNarration] = useState<NarrationPayload | null>(null);
  const [pending, setPending] = useState(false);
  const [narrating, setNarrating] = useState(false);
  const [status, setStatus] = useState<Status | null>(null);

  const runPlan = useCallback(async (query: RouteForm): Promise<void> => {
    setPending(true);
    setStatus(null);
    try {
      const payload = await planRoute(query);
      setRouteData(payload);
      setNarration(null);
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Could not compute a route.';
      setStatus({ tone: 'error', message });
    } finally {
      setPending(false);
    }
  }, []);

  const runNarrate = useCallback(async (query: RouteForm): Promise<void> => {
    setNarrating(true);
    try {
      setNarration(await narrateRouteRequest(query));
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Could not narrate the route.';
      setStatus({ tone: 'error', message });
    } finally {
      setNarrating(false);
    }
  }, []);

  useEffect(() => {
    fetchMetadata()
      .then((payload) => {
        setMetadata(payload);
        setDatasets(payload.datasets);
        const startForm = initialForm(payload);
        setForm(startForm);
        return runPlan(startForm);
      })
      .catch(() => {
        setStatus({ tone: 'error', message: 'Failed to load stadium data.' });
      });
  }, [runPlan]);

  const patchForm = useCallback((patch: Partial<RouteForm>): void => {
    setForm((current) => (current === null ? current : { ...current, ...patch }));
  }, []);

  const onUploaded = useCallback((summary: DatasetSummary): void => {
    setDatasets((current) => [...current.filter((item) => item.id !== summary.id), summary]);
    setForm((current) => (current === null ? current : { ...current, datasetId: summary.id }));
  }, []);

  if (metadata === null || form === null) {
    return (
      <main id="main" className="layout">
        <p>Loading stadium data…</p>
      </main>
    );
  }

  return (
    <PlannerLayout
      metadata={metadata}
      datasets={datasets}
      form={form}
      routeData={routeData}
      narration={narration}
      pending={pending}
      narrating={narrating}
      status={status}
      onChange={patchForm}
      onSubmit={() => {
        void runPlan(form);
      }}
      onNarrate={() => {
        void runNarrate(form);
      }}
      onUploaded={onUploaded}
    />
  );
}
