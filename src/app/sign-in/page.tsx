"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, LoaderCircle, MapPin } from "lucide-react";

export default function SignInPage() {
  const supabase = createClient();
  const router = useRouter();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [authError, setAuthError] = useState<"callback" | "session" | null>(null);

  useEffect(() => {
    const error = new URLSearchParams(location.search).get("error");
    setAuthError(error === "callback" || error === "session" ? error : null);
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!supabase) return;
    setBusy(true);
    setMessage("");
    const result = mode === "signin"
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({ email, password, options: { emailRedirectTo: `${location.origin}/auth/callback` } });
    setBusy(false);
    if (result.error) {
      setMessage(result.error.message);
    } else if (mode === "signup" && !result.data.session) {
      setMessage("Check your email to confirm your account.");
    } else {
      router.replace("/");
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f2f3ed] px-5 py-12">
      <section className="w-full max-w-md rounded-[30px] bg-white p-8 shadow-card sm:p-10">
        <Link href="/" className="mb-9 inline-flex items-center gap-2 text-sm font-medium text-[#687d61]">
          <ArrowLeft size={16} /> Back to the map
        </Link>
        <div className="mb-6 grid h-12 w-12 place-items-center rounded-2xl bg-[#edf0e8] text-[#687d61]"><MapPin /></div>
        <h1 className="font-serif text-3xl text-ink">{mode === "signin" ? "Welcome back" : "Keep your memories close"}</h1>
        <p className="mt-2 text-sm leading-6 text-[#73786f]">Sign in to save your places, photos, and songs in your own private map.</p>

        {authError && <p role="alert" className="mt-5 rounded-xl bg-red-50 p-3 text-sm text-red-700">
          {authError === "session"
            ? "We couldn't verify your session. Please sign in again."
            : "We couldn't complete sign-in. Please try again."}
        </p>}
        {message && <p role="status" className="mt-5 rounded-xl bg-[#f1f3ee] p-3 text-sm text-[#53664e]">{message}</p>}
        <form onSubmit={submit} className="mt-7 space-y-4">
          <label className="block text-sm font-medium text-ink">Email
            <Input required type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className="mt-2" />
          </label>
          <label className="block text-sm font-medium text-ink">Password
            <Input required minLength={8} type="password" autoComplete={mode === "signin" ? "current-password" : "new-password"} value={password} onChange={(e) => setPassword(e.target.value)} className="mt-2" />
          </label>
          <Button disabled={!supabase || busy} className="w-full">
            {busy && <LoaderCircle className="animate-spin" size={17} />}
            {mode === "signin" ? "Sign in" : "Create account"}
          </Button>
        </form>
        <button onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setMessage(""); }} className="mt-6 w-full text-sm text-[#687d61] hover:underline">
          {mode === "signin" ? "New here? Create an account" : "Already have an account? Sign in"}
        </button>
      </section>
    </main>
  );
}
