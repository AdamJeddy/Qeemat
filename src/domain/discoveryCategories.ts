/** Independent shopping interests. Groups organize browsing; budgets belong to interests. */
export const DISCOVERY_CATEGORY_LABELS = {
  clothing: 'Clothing', footwear: 'Footwear', bags: 'Bags', accessories: 'Accessories', jewellery: 'Jewellery', watches: 'Watches',
  makeup: 'Makeup', skincare: 'Skincare', fragrance: 'Fragrance', haircare: 'Haircare', bath_body: 'Bath & body', beauty_tools: 'Beauty tools', grooming: 'Grooming',
  phones: 'Phones', tablets: 'Tablets', computers: 'Computers', televisions: 'TVs & projectors', audio: 'Audio', gaming: 'Gaming', cameras: 'Cameras', wearables: 'Wearables', tech_accessories: 'Tech accessories',
  appliances: 'Appliances', kitchen: 'Kitchen', furniture: 'Furniture', home: 'Home décor', garden: 'Garden', cleaning: 'Cleaning', stationery: 'Stationery', books: 'Books',
  baby: 'Baby', toys: 'Toys', pets: 'Pets', health: 'Health',
  fresh_food: 'Fresh food', pantry: 'Pantry', beverages: 'Beverages', frozen_food: 'Frozen food',
  fitness: 'Fitness', sports: 'Sports equipment', outdoors: 'Outdoors', cycling: 'Cycling', swimming: 'Swimming', motorcycle: 'Motorcycle gear', marine: 'Marine', automotive: 'Car accessories'
} as const;

export type ShoppingCategory = keyof typeof DISCOVERY_CATEGORY_LABELS;

export const DISCOVERY_CATEGORY_GROUPS = [
  { id: 'style', label: 'Style', categories: ['clothing', 'footwear', 'bags', 'accessories', 'jewellery', 'watches'] },
  { id: 'beauty', label: 'Beauty', categories: ['makeup', 'skincare', 'fragrance', 'haircare', 'bath_body', 'beauty_tools', 'grooming'] },
  { id: 'technology', label: 'Technology', categories: ['phones', 'tablets', 'computers', 'televisions', 'audio', 'gaming', 'cameras', 'wearables', 'tech_accessories'] },
  { id: 'home', label: 'Home', categories: ['appliances', 'kitchen', 'furniture', 'home', 'garden', 'cleaning', 'stationery', 'books'] },
  { id: 'everyday', label: 'Everyday', categories: ['baby', 'toys', 'pets', 'health'] },
  { id: 'groceries', label: 'Groceries', categories: ['fresh_food', 'pantry', 'beverages', 'frozen_food'] },
  { id: 'active', label: 'Active', categories: ['fitness', 'sports', 'outdoors', 'cycling', 'swimming', 'motorcycle', 'marine', 'automotive'] }
] as const satisfies ReadonlyArray<{ id: string; label: string; categories: readonly ShoppingCategory[] }>;

const LEGACY_CATEGORIES: Record<string, readonly ShoppingCategory[]> = {
  fashion: ['clothing', 'footwear', 'bags', 'accessories', 'jewellery', 'watches'],
  beauty: ['makeup', 'skincare', 'fragrance', 'haircare', 'bath_body', 'beauty_tools', 'grooming'],
  electronics: ['phones', 'tablets', 'computers', 'televisions', 'audio', 'gaming', 'cameras', 'wearables', 'tech_accessories'],
  sport: ['footwear', 'clothing', 'fitness', 'sports', 'outdoors', 'cycling', 'swimming', 'motorcycle', 'marine']
};

function isCategory(value: string): value is ShoppingCategory {
  return Object.prototype.hasOwnProperty.call(DISCOVERY_CATEGORY_LABELS, value);
}

export function normalizeDiscoveryCategories(value: unknown): ShoppingCategory[] {
  if (!Array.isArray(value)) { return []; }
  return [...new Set(value.flatMap((category) => typeof category !== 'string' ? [] :
    LEGACY_CATEGORIES[category] ?? (isCategory(category) ? [category] : [])))];
}

export function migrateDiscoveryBudgets(value: unknown): Partial<Record<ShoppingCategory, number>> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) { return {}; }
  const raw = value as Record<string, unknown>;
  const result: Partial<Record<ShoppingCategory, number>> = {};
  const valid = (amount: unknown): amount is number => typeof amount === 'number' && Number.isFinite(amount) && amount >= 0;
  for (const [legacy, categories] of Object.entries(LEGACY_CATEGORIES)) {
    const amount = raw[legacy];
    if (!valid(amount)) { continue; }
    for (const category of categories) { result[category] = Math.min(result[category] ?? amount, amount); }
  }
  for (const [category, amount] of Object.entries(raw)) {
    if (isCategory(category) && valid(amount)) { result[category] = amount; }
  }
  return result;
}
