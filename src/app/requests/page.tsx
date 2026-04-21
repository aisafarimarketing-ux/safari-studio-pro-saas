import { RequestsInbox } from "@/components/requests/RequestsInbox";

// Pipeline inbox — the operator's daily driver. Left sidebar = stage
// counts (New / Working / Open / Booked / Completed / Not Booked).
// Right pane = scrollable request list with filter bar.

export default function RequestsPage() {
  return <RequestsInbox />;
}
