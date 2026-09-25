'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import type { AdminRole, Permission } from '@/lib/permissions';
import { ROLE_LABELS } from '@/lib/permissions';
import { formatRelative } from '@/lib/utils';
import { Badge, Button, Card, PageHeader } from '@/components/ui/primitives';
import { AdminControls } from '@/components/admin-controls';
import { AddAdmin } from '@/components/add-admin';
import { ErrorState, PermissionState, SkeletonRows } from '@/components/ui/states';

interface AdminRow {
  id: string;
  name: string;
  email: string;
  consoleRole: AdminRole;
  isActive: boolean;
  lastSeen: string;
  /** Role plus overrides, resolved by the server. */
  effective: Permission[];
  adminGrants: Permission[];
  adminRevokes: Permission[];
  sessionsRevokedAt: string | null;
}

interface AdminsResponse {
  rows: AdminRow[];
  roles: RoleInfo[];
  permissions: Permission[];
  actorPermissions: Permission[];
  actorRole: AdminRole;
}

interface RoleInfo {
  value: AdminRole;
  label: string;
  permissions: Permission[];
}

export default function AdminsPage() {
  const { session, can } = useAuth();
  const [editing, setEditing] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const admins = useQuery({
    queryKey: ['admins'],
    queryFn: () => api<AdminsResponse>('/admins'),
  });

  if (admins.isError) {
    const error = admins.error;
    if (error instanceof ApiError && error.isForbidden) {
      return <PermissionState permission="admins.manage" />;
    }
    return <ErrorState title="Could not load admins" description={error.message} />;
  }

  const data = admins.data;

  return (
    <>
      <PageHeader
        title="Admins"
        description="Everyone who can reach this console, and exactly what each role may do."
        actions={
          can('admins.manage') && admins.data && !adding ? (
            <Button variant="primary" onClick={() => setAdding(true)}>
              Add admin
            </Button>
          ) : null
        }
      />

      {adding && data ? (
        <AddAdmin actorRole={data.actorRole} onClose={() => setAdding(false)} />
      ) : null}

      {admins.isLoading || !data ? (
        <SkeletonRows rows={5} />
      ) : (
        <>
          <div className="scroll-x rounded-lg border border-line bg-surface">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b border-line-strong">
                  {['Admin', 'Role', 'Status', 'Last seen', ''].map((heading) => (
                    <th
                      key={heading}
                      className="px-4 py-3 text-left font-mono text-[10px] font-semibold uppercase tracking-wider text-ink-subtle"
                    >
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.rows.map((admin) => (
                  <tr key={admin.id} className="border-b border-line last:border-0">
                    <td className="px-4 py-3">
                      <div className="flex flex-col">
                        <span className="font-semibold text-ink">
                          {admin.name}
                          {admin.id === session?.userId ? (
                            <span className="ml-2 font-normal text-ink-subtle">(you)</span>
                          ) : null}
                        </span>
                        <span className="font-mono text-xs text-ink-subtle">{admin.email}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone="info">{ROLE_LABELS[admin.consoleRole]}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      {/* Signed out is shown ahead of suspended: it is the more
                          recent, more reversible state, and the one somebody
                          looking at this table is most likely to have caused. */}
                      {admin.sessionsRevokedAt ? (
                        <Badge tone="bad">Signed out</Badge>
                      ) : (
                        <Badge tone={admin.isActive ? 'good' : 'bad'}>
                          {admin.isActive ? 'Active' : 'Suspended'}
                        </Badge>
                      )}
                    </td>
                    <td className="px-4 py-3 text-ink-muted">{formatRelative(admin.lastSeen)}</td>
                    <td className="px-4 py-3 text-right">
                      {can('admins.manage') ? (
                        <Button
                          variant="secondary"
                          className="px-2.5 py-1 text-xs"
                          onClick={() => setEditing(editing === admin.id ? null : admin.id)}
                        >
                          {editing === admin.id ? 'Close' : 'Manage'}
                        </Button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Below the table rather than in a modal: the list is 20 switches
              and a reason field, and a dialog that tall becomes its own page
              on a laptop while hiding the row it belongs to. */}
          {editing
            ? (() => {
                const admin = data.rows.find((row) => row.id === editing);
                if (!admin) return null;
                const role = data.roles.find((entry) => entry.value === admin.consoleRole);
                return (
                  <AdminControls
                    admin={admin}
                    rolePermissions={role?.permissions ?? []}
                    allPermissions={data.permissions}
                    actorPermissions={data.actorPermissions}
                    isSelf={admin.id === session?.userId}
                    onDone={() => setEditing(null)}
                  />
                );
              })()
            : null}

          <section className="flex flex-col gap-3">
            <h2 className="font-mono text-[10px] font-semibold uppercase tracking-widest text-ink-subtle">
              What each role may do
            </h2>
            <div className="grid gap-3 lg:grid-cols-2">
              {data.roles.map((role) => (
                <Card key={role.value} className="flex flex-col gap-3">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-ink">{role.label}</span>
                    <span className="tabular text-xs text-ink-subtle">
                      {role.permissions.length} permissions
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {role.permissions.map((permission) => (
                      <code
                        key={permission}
                        className="rounded-sm bg-surface-sunken px-1.5 py-0.5 font-mono text-[10px] text-ink-muted"
                      >
                        {permission}
                      </code>
                    ))}
                  </div>
                </Card>
              ))}
            </div>
          </section>
        </>
      )}
    </>
  );
}
