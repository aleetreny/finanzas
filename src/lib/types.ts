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

export type RentalPlatform = "airbnb" | "booking" | "direct" | "other";

export type RentalCommissionModel =
  | "airbnb_shared_legacy"
  | "airbnb_host_only"
  | "booking_standard"
  | "direct"
  | "other";

export type RentalBooking = {
  id: string;
  user_id: string | null;
  property_id: string;
  name: string;
  check_in_date: string;
  check_out_date: string;
  platform: RentalPlatform;
  commission_model: RentalCommissionModel;
  accommodation_final: number;
  cleaning_fee: number;
  discount_amount: number;
  gross_before_discount: number;
  platform_commission_rate: number;
  platform_commission_amount: number;
  platform_commission_override_amount: number | null;
  manager_rate: number;
  manager_commission_amount: number;
  manager_cleaning_amount: number;
  manager_payment_override_amount: number | null;
  amount_payable_to_manager: number;
  owner_net_after_manager: number;
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
  | "platform"
  | "commission_model"
  | "accommodation_final"
  | "cleaning_fee"
  | "discount_amount"
  | "platform_commission_rate"
  | "platform_commission_override_amount"
  | "manager_rate"
  | "manager_payment_override_amount"
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

export type RecurringInput = Pick<
  RecurringRule,
  | "name"
  | "amount"
  | "frequency"
  | "effective_from"
  | "effective_until"
  | "category_id"
  | "subcategory_id"
  | "notes"
> & {
  direction: "income" | "expense";
};

export type Property = {
  id: string;
  name: string;
  property_type: string;
  is_active: boolean;
};
