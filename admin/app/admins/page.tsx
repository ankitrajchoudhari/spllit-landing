'use client';

import { useQuery } from '@tanstack/react-query';

import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import type { AdminRole, Permission } from '@/lib/permissions';
import { ROLE_LABELS } from '@/lib/permissions';
import { formatRelative } from '@/lib/utils';
import { Badge, Card, PageHeader } from '@/components/ui/primitives';
import { ErrorState, PermissionState, SkeletonRows } from '@/components/ui/states';

interface AdminRow {
  id: string;
  name: string;
  email: string;
  consoleRole: AdminRole;
  isActive: boolean;
  lastSeen: string;
}

interface RoleInfo {
  value: AdminRole;
  label: string;
  permissions: Permission[];
}

export default function AdminsPage() {
  const { session } = useAuth();

  const admins = useQuery({
    queryKey: ['admins'],
    queryFn: () => api<{ rows: AdminRow[]; roles: RoleInfo[] }>('/admins'),
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
      />

      {admins.isLoading || !data ? (
        <SkeletonRows rows={5} />
      ) : (
        <>
          <div className="scroll-x rounded-lg border border-line bg-surface">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b border-line-strong">
                  {['Admin', 'Role', 'Status', 'Last seen'].map((heading) => (
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
                      <Badge tone={admin.isActive ? 'good' : 'bad'}>
                        {admin.isActive ? 'Active' : 'Suspended'}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-ink-muted">{formatRelative(admin.lastSeen)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

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
