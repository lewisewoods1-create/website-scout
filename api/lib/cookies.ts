/**
 * Returns cookie serialization options appropriate for the current environment.
 * Uses SameSite=Lax for maximum browser compatibility.
 */
export function getSessionCookieOptions(_headers?: Headers) {
  // Always use Lax for same-origin apps - works with all browsers
  return {
    httpOnly: true,
    path: "/",
    sameSite: "Lax" as const,
    secure: true, // Render serves over HTTPS
  };
}
