export type TreasuryEntry = {
  id: string;
  name: string;
  percentage: number;
  color: string;
};

// Screenshot fixture only; no current company balances are implied.
export const referenceTreasuries: TreasuryEntry[] = [
  { id: "strategy", name: "Strategy", percentage: 61.99, color: "#C47A1D" },
  { id: "metaplanet", name: "Metaplanet Inc.", percentage: 3.22, color: "#304A98" },
  { id: "twenty-one-capital", name: "Twenty One Capital", percentage: 3.18, color: "#17735C" },
  { id: "xxl", name: "XXL", percentage: 3.18, color: "#89705A" },
  { id: "mara", name: "MARA Holdings, Inc.", percentage: 2.60, color: "#8B4B48" },
  { id: "strive", name: "Strive", percentage: 2.39, color: "#176F82" },
  { id: "bitcoin-standard-1", name: "Bitcoin Standard Treasury Company", percentage: 2.19, color: "#56329A" },
  { id: "bitcoin-standard-2", name: "Bitcoin Standard Treasury Company", percentage: 2.19, color: "#40579C" },
  { id: "bullish", name: "Bullish", percentage: 1.61, color: "#19745D" },
  { id: "spacex", name: "SpaceX", percentage: 1.37, color: "#8A796E" },
  { id: "others", name: "Others", percentage: 16.08, color: "#444A59" },
];
