'use client';

import { SectionTabs } from '@/components/section-tabs';
import NotificationsPage from '@/app/notifications/page';
import CampaignsPage from '@/app/campaigns/page';
import ModerationPage from '@/app/moderation/page';

/**
 * Everything that reaches a user, and everything they flag back.
 *
 * Notifications, Campaigns and Moderation were three separate rows describing
 * one relationship: what Spllit says to people, and what people say about each
 * other. Moderation sits here rather than under Content because it is about
 * people, not about the thing they made.
 */
export default function MessagesPage() {
  return (
    <SectionTabs
      title="Messages"
      description="What Spllit sends, and what gets reported back."
      tabs={[
        { key: 'notifications', label: 'Notifications', permission: 'content.view', render: () => <NotificationsPage /> },
        { key: 'campaigns', label: 'Campaigns', permission: 'notifications.send', render: () => <CampaignsPage /> },
        { key: 'moderation', label: 'Moderation', permission: 'moderation.view', render: () => <ModerationPage /> },
      ]}
    />
  );
}
