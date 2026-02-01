export type Deal = {
  id?: string;
  title: string;
  url: string;
  source?: string | null;
  brand?: string | null;
  image?: string | null;
  priceText?: string | null;
  price?: number | null;
  originalPriceText?: string | null;
  originalPrice?: number | null;
  discountText?: string | null;
  rating?: number | null;
  reviews?: number | null;
  delivery?: string | null;
  tag?: string | null;
  reason?: string | null;
  // Computed fields for enhanced display
  savingsAmount?: number | null;
  savingsPercent?: number | null;
  valueScore?: number | null;
  freeShipping?: boolean;
  primeEligible?: boolean;
  isAffordable?: boolean;
};

export type SalesBudgetOutput = {
  remaining: number;
  spent: number;
  income: number;
  safeToSpend: number;
  daysLeftInMonth: number;
  totalDaysInMonth: number;
  spentPercent: number;
  lastUpdated: string;
};

export type SalesSearchInput = {
  query: string;
  priceMin?: number;
  priceMax?: number;
  womenFocus?: boolean;
  withReasons?: boolean;
  reasonsMax?: number;
  budgetMax?: number;
  onlyAffordable?: boolean;
};

export type SalesSearchOutput = {
  items: Deal[];
  querySent?: string;
  womenFocus?: boolean;
  count?: number;
};

export type SalesFeedbackInput = {
  dealId: string;
  type: "click" | "save" | "dismiss";
  query?: string;
  itemTitle?: string;
  budgetMax?: number;
};

export type SalesFeedbackOutput = {
  ok: boolean;
  stored: boolean;
};

export type SalesSuggestInput = {
  goal?: string;
  budgetMax?: number;
  womenFocus?: boolean;
};

export type SalesSuggestOutput = string[];
