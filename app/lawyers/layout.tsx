import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Lawyers",
};

export default function LawyersLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
