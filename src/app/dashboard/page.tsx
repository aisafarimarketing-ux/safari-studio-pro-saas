import { CommandCenter } from "@/components/dashboard/CommandCenter";

// /dashboard renders the Follow-Up Command Center — a 3-column deal-
// focused interface (sidebar · priorities · today's tasks). The previous
// DashboardWorkspace tile-grid is preserved in the codebase but no
// longer mounted here; swap the import to restore it if needed.

export default function DashboardPage() {
  return <CommandCenter />;
}
