// Keep Prisma's migration history and raw queries in the app's own namespace.
export function demoTrackerDatabaseUrl(value) {
  if (!value) {
    throw new Error("Set DATABASE_URL to the FindIT PostgreSQL connection string in the app service's environment variables.");
  }
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error("DATABASE_URL must be a valid PostgreSQL connection string.");
  }
  if (!["postgres:", "postgresql:"].includes(url.protocol)) {
    throw new Error("DATABASE_URL must use PostgreSQL.");
  }
  url.searchParams.set("schema", "demo_tracker");
  return url.toString();
}
