import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Matters",
};

export default function MattersLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
