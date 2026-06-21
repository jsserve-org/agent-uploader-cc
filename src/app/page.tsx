import Link from "next/link";
import { Button } from "@/components/ui/button";
import { getSession } from "@/lib/session";

export default async function Home() {
  const session = await getSession();

  return (
    <main className="flex flex-1 flex-col">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-5">
        <span className="font-mono text-sm font-semibold tracking-tight">
          agent-uploader
        </span>
        <nav className="flex items-center gap-2">
          {session ? (
            <Button asChild size="sm">
              <Link href="/dashboard">Dashboard</Link>
            </Button>
          ) : (
            <>
              <Button asChild variant="ghost" size="sm">
                <Link href="/login">Log in</Link>
              </Button>
              <Button asChild size="sm">
                <Link href="/signup">Sign up</Link>
              </Button>
            </>
          )}
        </nav>
      </header>

      <section className="mx-auto flex w-full max-w-5xl flex-1 flex-col items-center justify-center gap-8 px-6 py-20 text-center">
        <div className="space-y-5">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
            Upload keys for AI agents.
          </h1>
          <p className="mx-auto max-w-2xl text-lg text-muted-foreground">
            Mint a single-use key and a ready-to-paste prompt. Your agent
            <code className="mx-1 rounded bg-muted px-1.5 py-0.5 font-mono text-sm">
              curl
            </code>
            s a file — an APK, a build artifact, anything — to your endpoint, and
            it self-destructs after the window you choose.
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <Button asChild size="lg">
            <Link href={session ? "/dashboard" : "/signup"}>
              {session ? "Go to dashboard" : "Get started"}
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="#how">How it works</Link>
          </Button>
        </div>

        <div
          id="how"
          className="mt-16 grid w-full gap-6 text-left sm:grid-cols-3"
        >
          {[
            {
              step: "1",
              title: "Create a key",
              body: "Pick a retention window (24h by default) and how many uploads it allows. Single-use by default.",
            },
            {
              step: "2",
              title: "Hand the agent the prompt",
              body: "We generate a prompt embedding the key and the exact curl command. Paste it into your agent.",
            },
            {
              step: "3",
              title: "Files expire",
              body: "The upload is reachable at a share link until its window closes, then it's deleted automatically.",
            },
          ].map((c) => (
            <div key={c.step} className="rounded-xl border bg-card p-5">
              <div className="mb-3 flex h-8 w-8 items-center justify-center rounded-full bg-primary font-mono text-sm font-bold text-primary-foreground">
                {c.step}
              </div>
              <h3 className="font-semibold">{c.title}</h3>
              <p className="mt-1.5 text-sm text-muted-foreground">{c.body}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="mx-auto w-full max-w-5xl px-6 py-8 text-center text-sm text-muted-foreground">
        Self-hosted file drop for agents · jsserve-org/agent-uploader-cc
      </footer>
    </main>
  );
}
