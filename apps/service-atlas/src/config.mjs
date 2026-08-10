export async function loadCatalogue(
  fetchCatalogue = globalThis.fetch,
  url = "./config/catalogue.json",
) {
  const response = await fetchCatalogue(url, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Unable to load service catalogue (${response.status})`);
  }
  return response.json();
}
