import { PropertyEditor } from "@/components/properties/PropertyEditor";

export default async function PropertyEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <PropertyEditor propertyId={id} />;
}
