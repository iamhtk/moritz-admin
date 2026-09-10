import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Not found",
};

export default function NotFound() {
  return (
    <main className="flex min-h-[60vh] flex-col items-center justify-center gap-3 px-6 text-center">
      <p
        className="font-medium text-text-tertiary"
        style={{ fontSize: "var(--text-12)" }}
      >
        404
      </p>
      <h1
        className="font-heading font-medium text-foreground"
        style={{ fontSize: "var(--text-24)" }}
      >
        This page is not in the command center
      </h1>
      <p
        className="max-w-sm text-text-secondary"
        style={{ fontSize: "var(--text-14)" }}
      >
        Overview, Matters, and Lawyers are the live routes. Everything else is
        stubbed or intentional.
      </p>
      <Link
        href="/"
        className="mt-2 rounded-lg bg-primary px-3 py-2 font-medium text-primary-foreground"
        style={{ fontSize: "var(--text-13)" }}
      >
        Back to Overview
      </Link>
    </main>
  );
}
