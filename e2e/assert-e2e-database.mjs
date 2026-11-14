// E2E reset drops schemas and deletes users. Only disposable E2E databases may be touched.
export function assertE2eDatabase(url) {
  let name = "";
  try {
    name = new URL(url).pathname.replace(/^\/+|\/+$/g, "");
  } catch {
    name = "";
  }
  if (!name.endsWith("_e2e")) {
    throw new Error(
      "Refusing to reset this database. E2E may only reset a database whose name ends with _e2e, so development and production data stay intact.",
    );
  }
}
