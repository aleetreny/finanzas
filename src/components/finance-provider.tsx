"use client";

import type { Session } from "@supabase/supabase-js";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { getSupabase } from "@/lib/supabase";
import type {
  Account,
  Category,
  PropertyRecurringInput,
  Property,
  RecurringRule,
  RentalBooking,
  RentalBookingInput,
  Subcategory,
  Transaction,
  TransactionInput,
} from "@/lib/types";

type FinanceContextValue = {
  configured: boolean;
  session: Session | null;
  loading: boolean;
  error: string | null;
  notice: string | null;
  accounts: Account[];
  categories: Category[];
  subcategories: Subcategory[];
  transactions: Transaction[];
  recurringRules: RecurringRule[];
  bookings: RentalBooking[];
  properties: Property[];
  signIn: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
  addTransaction: (input: TransactionInput) => Promise<void>;
  updateTransaction: (id: string, input: TransactionInput) => Promise<void>;
  deleteTransaction: (id: string) => Promise<void>;
  saveBooking: (booking: RentalBookingInput, id?: string) => Promise<void>;
  deleteBooking: (id: string) => Promise<void>;
  savePropertyRecurring: (rule: PropertyRecurringInput, id?: string) => Promise<void>;
  deletePropertyRecurring: (id: string) => Promise<void>;
};

const FinanceContext = createContext<FinanceContextValue | null>(null);

function messageFrom(error: unknown) {
  return error instanceof Error ? error.message : "Ha ocurrido un error inesperado.";
}

export function FinanceProvider({ children }: { children: ReactNode }) {
  const supabase = getSupabase();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(Boolean(supabase));
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [recurringRules, setRecurringRules] = useState<RecurringRule[]>([]);
  const [bookings, setBookings] = useState<RentalBooking[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);

  const clearData = useCallback(() => {
    setAccounts([]);
    setCategories([]);
    setSubcategories([]);
    setTransactions([]);
    setRecurringRules([]);
    setBookings([]);
    setProperties([]);
  }, []);

  const refresh = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    setError(null);
    try {
      const [
        accountsResult,
        categoriesResult,
        subcategoriesResult,
        transactionsResult,
        recurringResult,
        bookingsResult,
        propertiesResult,
      ] = await Promise.all([
        supabase.from("accounts").select("id,name,currency,is_default").order("name"),
        supabase.from("categories").select("id,name,sort_order,is_active,category_scope").order("sort_order"),
        supabase.from("subcategories").select("id,category_id,name,sort_order,is_active").order("sort_order"),
        supabase.from("transactions").select("*").order("transaction_date", { ascending: false }).range(0, 4999),
        supabase.from("recurring_rules").select("*").order("effective_from", { ascending: false }),
        supabase.from("rental_bookings").select("*").order("check_in_date", { ascending: false }),
        supabase.from("properties").select("id,name,property_type,is_active").order("name"),
      ]);

      const firstError = [
        accountsResult,
        categoriesResult,
        subcategoriesResult,
        transactionsResult,
        recurringResult,
        bookingsResult,
        propertiesResult,
      ].find((result) => result.error)?.error;
      if (firstError) throw firstError;

      setAccounts((accountsResult.data ?? []) as Account[]);
      setCategories((categoriesResult.data ?? []) as Category[]);
      setSubcategories((subcategoriesResult.data ?? []) as Subcategory[]);
      setTransactions((transactionsResult.data ?? []) as Transaction[]);
      setRecurringRules((recurringResult.data ?? []) as RecurringRule[]);
      setBookings((bookingsResult.data ?? []) as RentalBooking[]);
      setProperties((propertiesResult.data ?? []) as Property[]);
    } catch (caught) {
      setError(messageFrom(caught));
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    if (!supabase) return;
    let active = true;

    supabase.auth.getSession().then(({ data, error: sessionError }) => {
      if (!active) return;
      if (sessionError) setError(sessionError.message);
      setSession(data.session);
      if (!data.session) setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      if (!nextSession) {
        clearData();
        setLoading(false);
      }
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, [clearData, supabase]);

  useEffect(() => {
    if (!supabase || !session) return;
    let active = true;

    async function claimAndLoad() {
      setLoading(true);
      const { error: claimError } = await supabase!.rpc("claim_initial_dataset");
      if (!active) return;
      if (claimError && !claimError.message.includes("already assigned")) {
        setError(claimError.message);
        setLoading(false);
        return;
      }
      await refresh();
    }

    void claimAndLoad();
    return () => {
      active = false;
    };
  }, [refresh, session, supabase]);

  const signIn = useCallback(async (email: string) => {
    if (!supabase) return;
    setError(null);
    setNotice(null);
    setLoading(true);
    try {
      const { error: signInError } = await supabase.auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser: true,
          emailRedirectTo: window.location.href,
        },
      });
      if (signInError) throw signInError;
      setNotice("Te hemos enviado un enlace seguro. Revisa tu correo para entrar.");
    } catch (caught) {
      setError(messageFrom(caught));
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  const signOut = useCallback(async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    clearData();
  }, [clearData, supabase]);

  const addTransaction = useCallback(async (input: TransactionInput) => {
    if (!supabase || !session) throw new Error("Inicia sesión para guardar.");
    const account = accounts.find((item) => item.is_default) ?? accounts[0];
    if (!account) throw new Error("No existe una cuenta por defecto.");
    const { error: insertError } = await supabase.from("transactions").insert({
      ...input,
      user_id: session.user.id,
      account_id: account.id,
      source: "manual",
    });
    if (insertError) throw insertError;
    await refresh();
  }, [accounts, refresh, session, supabase]);

  const updateTransaction = useCallback(async (id: string, input: TransactionInput) => {
    if (!supabase) throw new Error("Supabase no está configurado.");
    const { error: updateError } = await supabase
      .from("transactions")
      .update(input)
      .eq("id", id);
    if (updateError) throw updateError;
    await refresh();
  }, [refresh, supabase]);

  const deleteTransaction = useCallback(async (id: string) => {
    if (!supabase) throw new Error("Supabase no está configurado.");
    const { error: deleteError } = await supabase.from("transactions").delete().eq("id", id);
    if (deleteError) throw deleteError;
    setTransactions((current) => current.filter((row) => row.id !== id));
  }, [supabase]);

  const saveBooking = useCallback(async (booking: RentalBookingInput, id?: string) => {
    if (!supabase || !session) throw new Error("Inicia sesión para guardar.");
    const property = properties.find((item) => item.name === "Piso Málaga") ?? properties[0];
    if (!property) throw new Error("No existe la propiedad Piso Málaga.");

    const gross = Number(booking.gross_before_discount);
    const discount = Number(booking.discount_amount);
    const platformCommission = Number(booking.platform_commission_amount);
    const managerCommission = Number(booking.manager_commission_amount);
    const cleaning = Number(booking.manager_cleaning_amount);
    const afterDiscount = gross - discount;
    const payload = {
      ...booking,
      platform: "other" as const,
      booking_date: booking.check_in_date,
      cleaning_fee: cleaning,
      guest_paid_after_discount: afterDiscount,
      platform_commission_rate: 0,
      bank_fee_rate: 0,
      bank_fee_amount: 0,
      manager_rate: 0,
      payout_received: afterDiscount - platformCommission,
      amount_payable_to_manager: managerCommission + cleaning,
      owner_net_after_manager: afterDiscount - platformCommission - managerCommission - cleaning,
      calculation_status: "reconciled" as const,
      manual_override: true,
    };

    const query = id
      ? supabase.from("rental_bookings").update(payload).eq("id", id)
      : supabase.from("rental_bookings").insert({
          ...payload,
          user_id: session.user.id,
          property_id: property.id,
        });
    const { error: bookingError } = await query;
    if (bookingError) throw bookingError;
    await refresh();
  }, [properties, refresh, session, supabase]);

  const deleteBooking = useCallback(async (id: string) => {
    if (!supabase) throw new Error("Supabase no está configurado.");
    const { error: bookingError } = await supabase.from("rental_bookings").delete().eq("id", id);
    if (bookingError) throw bookingError;
    setBookings((current) => current.filter((booking) => booking.id !== id));
  }, [supabase]);

  const savePropertyRecurring = useCallback(async (rule: PropertyRecurringInput, id?: string) => {
    if (!supabase || !session) throw new Error("Inicia sesión para guardar.");
    const category = categories.find((item) => item.category_scope === "property");
    if (!category) throw new Error("No existe la categoría del Piso Málaga.");
    const start = new Date(`${rule.effective_from}T00:00:00Z`);
    const payload = {
      ...rule,
      amount: -Math.abs(Number(rule.amount)),
      user_id: session.user.id,
      category_id: category.id,
      context: "Piso Málaga",
      day_of_month: start.getUTCDate(),
      auto_generate: true,
      is_active: true,
    };

    const query = id
      ? supabase.from("recurring_rules").update(payload).eq("id", id)
      : supabase.from("recurring_rules").insert(payload);
    const { error: recurringError } = await query;
    if (recurringError) throw recurringError;
    await refresh();
  }, [categories, refresh, session, supabase]);

  const deletePropertyRecurring = useCallback(async (id: string) => {
    if (!supabase) throw new Error("Supabase no está configurado.");
    const { error: recurringError } = await supabase.from("recurring_rules").delete().eq("id", id);
    if (recurringError) throw recurringError;
    setRecurringRules((current) => current.filter((rule) => rule.id !== id));
  }, [supabase]);

  const value = useMemo<FinanceContextValue>(() => ({
    configured: Boolean(supabase),
    session,
    loading,
    error,
    notice,
    accounts,
    categories,
    subcategories,
    transactions,
    recurringRules,
    bookings,
    properties,
    signIn,
    signOut,
    refresh,
    addTransaction,
    updateTransaction,
    deleteTransaction,
    saveBooking,
    deleteBooking,
    savePropertyRecurring,
    deletePropertyRecurring,
  }), [
    accounts, addTransaction, bookings, categories, deleteBooking, deletePropertyRecurring,
    deleteTransaction, error, loading, notice, properties, recurringRules, refresh,
    saveBooking, savePropertyRecurring, session,
    signIn, signOut, subcategories, supabase, transactions, updateTransaction,
  ]);

  return <FinanceContext.Provider value={value}>{children}</FinanceContext.Provider>;
}

export function useFinance() {
  const value = useContext(FinanceContext);
  if (!value) throw new Error("useFinance must be used inside FinanceProvider");
  return value;
}
