'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Download } from 'lucide-react';

import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { config } from '@/lib/config';
import { currentIdToken } from '@/lib/firebase';
import { formatRelative } from '@/lib/utils';
import { Badge, Button, Card, Input, PageHeader } from '@/components/ui/primitives';
import { ConfirmDialog } from '@/components/ui/confirm';
import { useToast } from '@/components/ui/toast';
import { EmptyState, ErrorState, PermissionState, SkeletonRows } from '@/components/ui/states';

interface Setting {
  id: string;
  key: string;
  category: string;
  label: string;
  description: string | null;
  valueType: 'string' | 'number' | 'boolean' | 'json';
  value: unknown;
  requiresConfirmation: boolean;
  updatedAt: string;
}

const DATASETS = [
  { key: 'users', label: 'Users' },
  { key: 'rides', label: 'Rides' },
  { key: 'events', label: 'Events' },
  { key: 'audit', label: 'Audit log' },
] as const;

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const { can } = useAuth();

  const [pending, setPending] = useState<{ setting: Setting; value: unknown } | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const settings = useQuery({
    queryKey: ['settings'],
    queryFn: () => api<{ rows: Setting[] }>('/settings'),
  });

  const save = useMutation({
    mutationFn: (input: { key: string; value: unknown; reason: string }) =>
      api(`/settings/${input.key}`, {
        method: 'PATCH',
        body: { value: input.value, reason: input.reason },
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['settings'] });
      setPending(null);
      toast.success('Setting saved.');
    },
    onError: (error) =>
      toast.error(error instanceof ApiError ? error.message : 'Could not save the setting.'),
  });

  if (settings.isError) {
    if (settings.error instanceof ApiError && settings.error.isForbidden) {
      return <PermissionState permission="settings.view" />;
    }
    return <ErrorState title="Could not load settings" description={settings.error.message} />;
  }

  const rows = settings.data?.rows ?? [];
  const editable = can('settings.edit');

  // Grouped for display only — the server returns them already sorted by
  // category, so this preserves that order rather than imposing its own.
  const byCategory = rows.reduce<Record<string, Setting[]>>((acc, row) => {
    (acc[row.category] ??= []).push(row);
    return acc;
  }, {});

  return (
    <>
      <PageHeader
        title="Settings"
        description="Platform configuration and data exports."
      />

      {settings.isLoading ? (
        <SkeletonRows rows={5} />
      ) : rows.length === 0 ? (
        <EmptyState
          title="No settings defined"
          description="Settings are created in the database. None exist yet, so nothing here is being configured at runtime."
        />
      ) : (
        Object.entries(byCategory).map(([category, items]) => (
          <section key={category} className="flex flex-col gap-3">
            <h2 className="font-mono text-[10px] font-semibold uppercase tracking-widest text-ink-subtle">
              {category}
            </h2>

            {items.map((setting) => (
              <Card key={setting.id} className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex min-w-0 flex-col gap-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-ink">{setting.label}</span>
                    {setting.requiresConfirmation ? <Badge tone="warn">Sensitive</Badge> : null}
                  </div>
                  <code className="font-mono text-xs text-ink-subtle">{setting.key}</code>
                  {setting.description ? (
                    <p className="text-sm text-ink-muted">{setting.description}</p>
                  ) : null}
                  <span className="text-xs text-ink-subtle">
                    Updated {formatRelative(setting.updatedAt)}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {setting.valueType === 'boolean' ? (
                    <Button
                      variant={setting.value ? 'danger' : 'primary'}
                      disabled={!editable}
                      title={editable ? undefined : 'Your role cannot change settings.'}
                      onClick={() => setPending({ setting, value: !setting.value })}
                    >
                      {setting.value ? 'Turn off' : 'Turn on'}
                    </Button>
                  ) : (
                    <>
                      <Input
                        className="w-40"
                        value={drafts[setting.key] ?? String(setting.value ?? '')}
                        onChange={(event) =>
                          setDrafts((current) => ({ ...current, [setting.key]: event.target.value }))
                        }
                        disabled={!editable}
                        aria-label={setting.label}
                      />
                      <Button
                        variant="secondary"
                        disabled={!editable}
                        onClick={() => {
                          const raw = drafts[setting.key] ?? String(setting.value ?? '');
                          // Coerced to the declared type here as well as on the
                          // server: a number field posting "12" as a string is
                          // rejected there, and failing in the UI first is a
                          // clearer place to learn that.
                          const value =
                            setting.valueType === 'number'
                              ? Number(raw)
                              : setting.valueType === 'json'
                                ? safeJson(raw)
                                : raw;

                          if (setting.valueType === 'number' && !Number.isFinite(value)) {
                            toast.error('That is not a number.');
                            return;
                          }
                          if (setting.valueType === 'json' && value === undefined) {
                            toast.error('That is not valid JSON.');
                            return;
                          }

                          setPending({ setting, value });
                        }}
                      >
                        Save
                      </Button>
                    </>
                  )}
                </div>
              </Card>
            ))}
          </section>
        ))
      )}

      <ExportSection />

      {pending ? (
        <ConfirmDialog
          title={`Change “${pending.setting.label}”?`}
          description={
            <>
              This takes effect for users immediately.
              {pending.setting.requiresConfirmation ? (
                <strong className="block pt-1 text-ink">
                  This setting is marked sensitive — a reason is required.
                </strong>
              ) : null}
            </>
          }
          confirmLabel="Save"
          destructive={pending.setting.requiresConfirmation}
          requireReason={pending.setting.requiresConfirmation}
          pending={save.isPending}
          error={save.error instanceof ApiError ? save.error.message : null}
          onCancel={() => {
            setPending(null);
            save.reset();
          }}
          onConfirm={(reason) =>
            save.mutate({ key: pending.setting.key, value: pending.value, reason })
          }
        />
      ) : null}
    </>
  );
}

function safeJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}

/**
 * Controlled exports.
 *
 * The download is issued through fetch rather than a plain link, because the
 * API needs an Authorization header and an anchor cannot carry one. The blob is
 * revoked immediately after the click so the object URL does not outlive the
 * download it was created for.
 */
function ExportSection() {
  const toast = useToast();
  const { can } = useAuth();
  const [busy, setBusy] = useState<string | null>(null);

  if (!can('exports.run')) return null;

  async function download(dataset: string, label: string) {
    setBusy(dataset);
    try {
      const token = await currentIdToken();
      const response = await fetch(
        `${config.api.baseUrl.replace(/\/$/, '')}/admin-console/export/${dataset}?format=csv`,
        { headers: token ? { Authorization: `Bearer ${token}` } : {} },
      );

      if (!response.ok) {
        toast.error(`Could not export ${label.toLowerCase()} (${response.status}).`);
        return;
      }

      const truncated = response.headers.get('X-Export-Truncated') === 'true';
      const rows = response.headers.get('X-Export-Rows');

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `spllit-${dataset}-${new Date().toISOString().slice(0, 10)}.csv`;
      anchor.click();
      URL.revokeObjectURL(url);

      toast.success(
        truncated
          ? `${label} exported — capped at ${rows} rows, so this file is partial.`
          : `${label} exported (${rows} rows).`,
      );
    } catch {
      toast.error('The export did not complete.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-mono text-[10px] font-semibold uppercase tracking-widest text-ink-subtle">
        Exports
      </h2>
      <Card className="flex flex-col gap-3">
        <p className="text-sm text-ink-muted">
          CSV, capped at 10,000 rows and limited to non-sensitive columns. Every export is recorded
          in the audit log.
        </p>
        <div className="flex flex-wrap gap-2">
          {DATASETS.map((dataset) => (
            <Button
              key={dataset.key}
              variant="secondary"
              disabled={busy !== null}
              onClick={() => void download(dataset.key, dataset.label)}
            >
              <Download className="h-4 w-4" aria-hidden="true" />
              {busy === dataset.key ? 'Exporting…' : dataset.label}
            </Button>
          ))}
        </div>
      </Card>
    </section>
  );
}
