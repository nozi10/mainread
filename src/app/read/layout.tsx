import React from 'react';

/**
 * Layout for the /read route.
 * This file is necessary to resolve a Vercel deployment error where Next.js
 * requires each route to have its own layout file.
 */
export default function ReadLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return <>{children}</>;
}