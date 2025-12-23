import { ExtendedCategory } from '@/pages/lib/types';

// Helper function to find parent category from all categories
export function findParentCategory(
  categoryId: string,
  allCategories: ExtendedCategory[],
): ExtendedCategory | null {
  function search(cats: ExtendedCategory[]): ExtendedCategory | null {
    // Check if any category has this as a direct child
    const directParent = cats.find((cat) =>
      cat.successorCategories?.some((subCat) => subCat.id === categoryId),
    );
    if (directParent) {
      return directParent;
    }

    // Recursively search in subcategories
    const recursiveResults = cats
      .filter(
        (cat) => cat.successorCategories && cat.successorCategories.length > 0,
      )
      .map((cat) => search(cat.successorCategories!))
      .filter((result): result is ExtendedCategory => result !== null);

    return recursiveResults[0] || null;
  }
  return search(allCategories);
}

export function findCategory(
  cats: ExtendedCategory[],
  targetId: string,
): ExtendedCategory | null {
  const directMatch = cats.find((cat) => cat.id === targetId);
  if (directMatch) {
    return directMatch;
  }

  // Search in subcategories
  const subcategoryResults = cats
    .filter(
      (cat) => cat.successorCategories && cat.successorCategories.length > 0,
    )
    .map((cat) => findCategory(cat.successorCategories!, targetId))
    .filter((result): result is ExtendedCategory => result !== null);

  return subcategoryResults[0] || null;
}

// Helper function to build full category path from root to current category
export function buildCategoryPath(
  categoryId: string,
  allCategories: ExtendedCategory[],
): ExtendedCategory[] {
  const path: ExtendedCategory[] = [];

  // Build path recursively from current to root
  function buildPath(currentId: string): boolean {
    const current = findCategory(allCategories, currentId);
    if (!current) {
      return false;
    }

    // Add current category to path
    path.unshift(current);

    // Find parent and continue building path
    const parent = findParentCategory(currentId, allCategories);
    if (parent) {
      return buildPath(parent.id);
    }

    return true; // Reached root
  }
  // Find the current category

  buildPath(categoryId);
  return path;
}
