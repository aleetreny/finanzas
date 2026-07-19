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

export type RentalBooking = {
  id: string;
  platform: "airbnb" | "booking" | "direct" | "other";
  booking_date: string | null;
  check_in_date: string | null;
  check_out_date: string | null;
  discount_amount: number;
  cleaning_fee: number;
  guest_paid_after_discount: number;
  gross_before_discount: number;
  platform_commission_rate: number;
  platform_commission_amount: number;
  bank_fee_rate: number;
  bank_fee_amount: number;
  manager_rate: number;
  manager_commission_amount: number;
  manager_cleaning_amount: number;
  payout_received: number;
  amount_payable_to_manager: number;
  owner_net_after_manager: number;
  calculation_status: "draft" | "reconciled" | "needs_review";
};

export type Property = {
  id: string;
  name: string;
  property_type: string;
  is_active: boolean;
};
