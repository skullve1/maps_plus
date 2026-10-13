import { MapWorkspace } from "@/components/map-workspace";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function HomePage() {
  const supabase = await createClient();
  if (supabase) {
    const {
      data: { user },
      error
    } = await supabase.auth.getUser();

    if (error && error.name !== "AuthSessionMissingError") {
      console.error("Could not verify the current Supabase session", error);
      redirect("/sign-in?error=session");
    }
    if (!user) redirect("/sign-in");
  }

  return <MapWorkspace />;
}
