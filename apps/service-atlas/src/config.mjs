const CREDENTIAL_FILE_PATTERN = /^\.\/config\/secrets\/[a-z0-9]+(?:-[a-z0-9]+)*$/;

async function readCredentialFile(fetchCatalogue, path) {
  if (!CREDENTIAL_FILE_PATTERN.test(path)) {
    throw new Error(`Invalid credential file path: ${path}`);
  }

  const response = await fetchCatalogue(path, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Unable to load service credential (${response.status})`);
  }
  return response.text();
}

async function resolveCredentialFiles(catalogue, fetchCatalogue) {
  await Promise.all((catalogue.services ?? []).flatMap((service) => (
    (service.credentials ?? []).flatMap((credential) => {
      const reads = [];
      if (credential.usernameFile) {
        reads.push(readCredentialFile(fetchCatalogue, credential.usernameFile)
          .then((value) => { credential.username = value; }));
      }
      if (credential.passwordFile) {
        reads.push(readCredentialFile(fetchCatalogue, credential.passwordFile)
          .then((value) => { credential.password = value; }));
      }
      return reads;
    })
  )));
  return catalogue;
}

export async function loadCatalogue(
  fetchCatalogue = globalThis.fetch,
  url = "./config/catalogue.json",
) {
  const response = await fetchCatalogue(url, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Unable to load service catalogue (${response.status})`);
  }
  return resolveCredentialFiles(await response.json(), fetchCatalogue);
}
