export type Direction = "income" | "expense" | "neutral";

export type CategoryScope = "expense" | "income" | "property";

export type Category = {
  id: string;
  name: string;
  sort_order: number;
  is_active: boolean;
  category_scope: CategoryScope;
};

export type Subcategory = {
  id: string;
  category_id: string;
  name: string;
  sort_order: number;
  is_active: boolean;
};

export type Account = {
  id: string;
  name: string;
  currency: string;
  is_default: boolean;
};

export type Transaction = {
  id: string;
  user_id: string | null;
  account_id: string;
  transaction_date: string;
  name: string;
  amount: number;
  direction: Direction;
  category_id: string | null;
  subcategory_id: string | null;
  context: string | null;
  platform: string | null;
  trip_project_id: string | null;
  recurring_rule_id: string | null;
  fiscal_property_status: string | null;
  notes: string | null;
  source: "manual" | "csv_import" | "recurring" | "rental_calculator";
  source_external_id: string | null;
  created_at: string;
};

export type TransactionInput = Pick<
  Transaction,
  | "transaction_date"
  | "name"
  | "amount"
  | "direction"
  | "category_id"
  | "subcategory_id"
  | "context"
  | "platform"
  | "fiscal_property_status"
  | "notes"
>;

export type RecurringRule = {
  id: string;
  name: string;
  amount: number;
  frequency: "weekly" | "monthly" | "quarterly" | "yearly";
  day_of_month: number | null;
  effective_from: string;
  effective_until: string | null;
  category_id: string | null;
  subcategory_id: string | null;
  context: string | null;
  auto_generate: boolean;
  is_active: boolean;
  notes: string | null;
};

export type RentalAllocationMethod = "daily" | "monthly";

export type RentalBooking = {
  id: string;
  user_id: string | null;
  property_id: string;
  name: string;
  check_in_date: string;
  check_out_date: string;
  discount_amount: number;
  gross_before_discount: number;
  platform_commission_amount: number;
  manager_commission_amount: number;
  manager_cleaning_amount: number;
  calculation_status: "draft" | "reconciled" | "needs_review";
  allocation_method: RentalAllocationMethod;
  source_key: string | null;
  linked_transaction_id: string | null;
  notes: string | null;
  created_at: string;
};

export type RentalBookingInput = Pick<
  RentalBooking,
  | "name"
  | "check_in_date"
  | "check_out_date"
  | "gross_before_discount"
  | "discount_amount"
  | "platform_commission_amount"
  | "manager_commission_amount"
  | "manager_cleaning_amount"
  | "allocation_method"
  | "notes"
>;

export type PropertyRecurringInput = Pick<
  RecurringRule,
  | "name"
  | "amount"
  | "frequency"
  | "effective_from"
  | "effective_until"
  | "subcategory_id"
  | "notes"
>;

export type Property = {
  id: string;
  name: string;
  property_type: string;
  is_active: boolean;
};
