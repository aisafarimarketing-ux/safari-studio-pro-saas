import { RequestDetailPage } from "@/components/requests/RequestDetailPage";

export default async function RequestDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <RequestDetailPage id={id} />;
}
