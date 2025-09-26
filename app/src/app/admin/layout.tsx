import React from 'react';

// Every page in Next.js needs a root layout.
// This layout applies to the /admin route and its children.
export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
