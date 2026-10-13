import { SharedMap } from "@/components/shared-map";

export default async function SharedPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <SharedMap token={token} />;
}
