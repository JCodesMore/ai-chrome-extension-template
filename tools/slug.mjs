// Turn a human extension name into a filesystem-safe slug for zip artifacts.
// e.g. "My Cool Extension!" → "my-cool-extension". Shared by package.mjs and
// release.mjs so the zip name is derived one way everywhere.
export function slug(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}
