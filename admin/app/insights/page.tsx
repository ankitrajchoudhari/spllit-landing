'use client';

import { SectionTabs } from '@/components/section-tabs';
import AnalyticsPage from '@/app/analytics/page';
import ExplorePage from '@/app/explore/page';
import ActivityPage from '@/app/activity/page';
import ReportsPage from '@/app/reports/page';

/**
 * The questions you ask when nothing is on fire.
 *
 * Analytics answers fixed questions, Explore answers the rest, and Activity
 * shows where they happen. They were three rows for one activity — sitting down
 * to understand the platform rather than operate it.
 */
export default function InsightsPage() {
  return (
    <SectionTabs
      title="Insights"
      description="Who comes back, what they use, and where."
      tabs={[
        { key: 'analytics', label: 'Overview', permission: 'analytics.view', render: () => <AnalyticsPage /> },
        { key: 'explore', label: 'Explore', permission: 'analytics.view', render: () => <ExplorePage /> },
        { key: 'activity', label: 'Map', permission: 'analytics.view', render: () => <ActivityPage /> },
        { key: 'reports', label: 'Reports', permission: 'analytics.view', render: () => <ReportsPage /> },
      ]}
    />
  );
}
