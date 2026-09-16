'use client';

import { SectionTabs } from '@/components/section-tabs';
import { PlatformSettings } from '@/components/platform-settings';
import FlagsPage from '@/app/flags/page';
import AdminsPage from '@/app/admins/page';
import AuditPage from '@/app/audit/page';
import SystemPage from '@/app/system/page';

/**
 * Everything you change rarely and check when something looks wrong.
 *
 * Five sidebar rows — Flags, Settings, Admins, Audit, System — for things
 * opened once a week between them. They earned one row, and the tabs keep them
 * a click apart rather than a scan of the whole sidebar apart.
 *
 * Audit sits here rather than under Insights on purpose: it answers "what did
 * somebody change", which is the same question as the rest of this section, not
 * "how is Spllit doing".
 */
export default function SettingsPage() {
  return (
    <SectionTabs
      title="Settings"
      description="Configuration, access, and what changed."
      tabs={[
        { key: 'platform', label: 'Platform', permission: 'settings.view', render: () => <PlatformSettings /> },
        { key: 'flags', label: 'Feature flags', permission: 'settings.view', render: () => <FlagsPage /> },
        { key: 'admins', label: 'Admins', permission: 'admins.manage', render: () => <AdminsPage /> },
        { key: 'audit', label: 'Audit log', permission: 'audit.view', render: () => <AuditPage /> },
        { key: 'system', label: 'System', permission: 'system.view', render: () => <SystemPage /> },
      ]}
    />
  );
}
