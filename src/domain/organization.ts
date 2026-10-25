function sameName(left: string, right: string): boolean {
  return left.localeCompare(right, undefined, { sensitivity: 'accent' }) === 0;
}

function findExistingName(value: string, knownNames: string[]): string | undefined {
  return knownNames.find((name) => sameName(name, value));
}

export function normalizeFolderName(value: string | undefined, knownFolders: string[] = []): string | undefined {
  const folder = value?.trim().slice(0, 40);
  if (!folder) {
    return undefined;
  }

  return findExistingName(folder, knownFolders) ?? folder;
}

export function uniqueOrganizationNames(names: Array<string | undefined>): string[] {
  return names.reduce<string[]>((unique, name) => {
    const normalized = name?.trim();
    if (!normalized || unique.some((existing) => sameName(existing, normalized))) {
      return unique;
    }

    return [...unique, normalized];
  }, []);
}
