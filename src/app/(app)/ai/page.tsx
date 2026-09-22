import { getCurrentUser } from "@/lib/auth/current-user";
import { AIPage } from "@/components/ai/AIPage";

export default async function AiPage() {
  const user = await getCurrentUser();

  return (
    <AIPage
      userId={user?.id ?? ""}
      firstName={user?.firstName ?? ""}
      lastName={user?.lastName ?? ""}
      avatarUrl={user?.avatarUrl ?? null}
    />
  );
}
