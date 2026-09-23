import { Medicine } from "./index";

export const shopCategories = [
  { name: "Medicines", icon: "pill", subcategories: ["Pain & fever", "Cold & allergy", "Digestive care", "Diabetes care", "Heart care", "Thyroid care", "Antibiotics", "Respiratory care", "Eye & ear"] },
  { name: "Skin & Personal Care", icon: "lotion-outline", subcategories: ["Skin care", "First aid"] },
  { name: "Baby Care", icon: "baby-face-outline", subcategories: ["Baby medicines", "Baby essentials"] },
  { name: "Vitamins & Wellness", icon: "bottle-tonic-plus-outline", subcategories: ["Vitamins", "Nutrition"] },
  { name: "Women & Family Care", icon: "human-male-female-child", subcategories: ["Women's care", "Family essentials"] },
] as const;

export function matchesCategory(medicine: Medicine, category: string) {
  if (!category) return true;
  const group = shopCategories.find(item => item.name === category);
  return group ? (group.subcategories as readonly string[]).includes(medicine.category) : medicine.category === category;
}
