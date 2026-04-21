import { TeamSupervisionPage } from "@/components/team/TeamSupervisionPage";

// Live team supervision dashboard. Shows everyone online, their current
// activity, workload, response time, and an org-wide activity feed.
// Distinct from /settings/team which hosts Clerk's invite/seat management.

export default function TeamPage() {
  return <TeamSupervisionPage />;
}
