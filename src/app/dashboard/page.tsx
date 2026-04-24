import { DashboardWorkspace } from "@/components/dashboard/DashboardWorkspace";

// NOTE: /dashboard previously rendered SupervisionDashboard — a
// request-inbound CRM-centric view. Swapped to DashboardWorkspace so
// the operator's first screen shows the full operational picture:
// KPI strip (proposals / deposits / engagement / pipeline), Today row
// (active proposal / inbox preview / month glance), request funnel,
// activity feed, action chips, workspace tiles, recent proposals.
//
// SupervisionDashboard is preserved in components/dashboard/ and can
// be restored with a one-line swap if the inbound-focused layout turns
// out to fit the operator flow better.

export default function DashboardPage() {
  return <DashboardWorkspace />;
}
