"use client";

import type { Session } from "@supabase/supabase-js";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { getSupabase } from "@/lib/supabase";
import { calculateRentalBooking } from "@/lib/property-rental";
import { todayIso } from "@/lib/format";
import type {
  Account,
  Category,
  PropertyRecurringInput,
  Property,
  RecurringInput,
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
  hasMalagaAccess: boolean;
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
  signInWithPassword: (email: string, password: string) => Promise<boolean>;
  signUp: (email: string, password: string, displayName: string) => Promise<void>;
  sendAccessLink: (email: string) => Promise<boolean>;
  updatePassword: (password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
  addTransaction: (input: TransactionInput) => Promise<void>;
  updateTransaction: (id: string, input: TransactionInput) => Promise<void>;
  deleteTransaction: (id: string) => Promise<void>;
  saveBooking: (booking: RentalBookingInput, id?: string) => Promise<void>;
  deleteBooking: (id: string) => Promise<void>;
  savePropertyRecurring: (rule: PropertyRecurringInput, id?: string) => Promise<void>;
  deletePropertyRecurring: (id: string) => Promise<void>;
  saveRecurring: (rule: RecurringInput, id?: string) => Promise<void>;
  deleteRecurring: (id: string) => Promise<void>;
  toggleRecurring: (id: string, isActive: boolean) => Promise<void>;
};

const FinanceContext = createContext<FinanceContextValue | null>(null);

export function messageFrom(error: unknown) {
  const message = error instanceof Error ? error.message : "Ha ocurrido un error inesperado.";
  const code = error && typeof error === "object" && "code" in error
    ? String(error.code)
    : "";
  const normalized = message.toLowerCase();
  if (normalized.includes("invalid login credentials")) return "El correo o la clave no son correctos.";
  if (normalized.includes("password should be")) return "La clave no cumple la longitud mínima requerida.";
  if (normalized.includes("user already registered")) return "Ya existe una cuenta con ese correo. Entra con tu clave o solicita un enlace de acceso.";
  if (code === "over_email_send_rate_limit") {
    return "Se ha alcanzado el límite de correos de acceso. Prueba de nuevo más tarde.";
  }
  if (normalized.includes("rate limit")) return "Espera un minuto antes de volver a intentarlo.";
  return message;
}

export function FinanceProvider({ children }: { children: ReactNode }) {
  const supabase = getSupabase();
  const [session, setSession] = useState<Session | null>(null);
  const [hasMalagaAccess, setHasMalagaAccess] = useState(false);
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
  // Con datos ya cargados, los refrescos son silenciosos: no se desmonta la
  // interfaz ni se pierde el estado de filtros, gráficos o desplazamiento.
  const hasLoadedRef = useRef(false);
  const hasMalagaAccessRef = useRef(false);
  const lastRecurringGenerationRef = useRef("");

  const clearData = useCallback(() => {
    hasLoadedRef.current = false;
    setAccounts([]);
    setCategories([]);
    setSubcategories([]);
    setTransactions([]);
    setRecurringRules([]);
    setBookings([]);
    setProperties([]);
    hasMalagaAccessRef.current = false;
    lastRecurringGenerationRef.current = "";
    setHasMalagaAccess(false);
  }, []);

  const loadData = useCallback(async (includeMalaga: boolean) => {
    if (!supabase) return;
    if (!hasLoadedRef.current) setLoading(true);
    setError(null);
    try {
      const [
        accountsResult,
        categoriesResult,
        subcategoriesResult,
        transactionsResult,
        recurringResult,
      ] = await Promise.all([
        supabase.from("accounts").select("id,name,currency,is_default").order("name"),
        supabase.from("categories").select("id,name,sort_order,is_active,category_scope").order("sort_order"),
        supabase.from("subcategories").select("id,category_id,name,sort_order,is_active").order("sort_order"),
        supabase.from("transactions").select("*").order("transaction_date", { ascending: false }).range(0, 4999),
        supabase.from("recurring_rules").select("*").order("effective_from", { ascending: false }),
      ]);

      const firstError = [
        accountsResult,
        categoriesResult,
        subcategoriesResult,
        transactionsResult,
        recurringResult,
      ].find((result) => result.error)?.error;
      if (firstError) throw firstError;

      const loadedCategories = (categoriesResult.data ?? []) as Category[];
      const visibleCategories = includeMalaga
        ? loadedCategories
        : loadedCategories.filter((category) => category.category_scope !== "property");
      const visibleCategoryIds = new Set(visibleCategories.map((category) => category.id));
      const loadedTransactions = (transactionsResult.data ?? []) as Transaction[];
      const loadedRecurring = (recurringResult.data ?? []) as RecurringRule[];

      setAccounts((accountsResult.data ?? []) as Account[]);
      setCategories(visibleCategories);
      setSubcategories(((subcategoriesResult.data ?? []) as Subcategory[])
        .filter((subcategory) => visibleCategoryIds.has(subcategory.category_id)));
      setTransactions(includeMalaga
        ? loadedTransactions
        : loadedTransactions.filter((transaction) =>
          (!transaction.category_id || visibleCategoryIds.has(transaction.category_id))
          && transaction.context?.toLocaleLowerCase("es") !== "piso málaga"));
      setRecurringRules(includeMalaga
        ? loadedRecurring
        : loadedRecurring.filter((rule) =>
          (!rule.category_id || visibleCategoryIds.has(rule.category_id))
          && rule.context?.toLocaleLowerCase("es") !== "piso málaga"));

      if (includeMalaga) {
        const [bookingsResult, propertiesResult] = await Promise.all([
          supabase.from("rental_bookings").select("*").order("check_in_date", { ascending: false }),
          supabase.from("properties").select("id,name,property_type,is_active").order("name"),
        ]);
        if (bookingsResult.error) throw bookingsResult.error;
        if (propertiesResult.error) throw propertiesResult.error;
        setBookings((bookingsResult.data ?? []) as RentalBooking[]);
        setProperties((propertiesResult.data ?? []) as Property[]);
      } else {
        setBookings([]);
        setProperties([]);
      }
      hasLoadedRef.current = true;
    } catch (caught) {
      setError(messageFrom(caught));
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  const refresh = useCallback(async () => {
    await loadData(hasMalagaAccessRef.current);
  }, [loadData]);

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

  // Depende del id de usuario, no del objeto de sesión: así un refresco de
  // token no relanza el alta ni vuelve a descargar todos los datos.
  const userId = session?.user.id;

  useEffect(() => {
    if (!supabase || !userId) return;
    let active = true;

    async function bootstrapAndLoad() {
      setLoading(true);
      const { data: bootstrapData, error: bootstrapError } = await supabase!.rpc("bootstrap_user_workspace");
      if (!active) return;
      if (bootstrapError) {
        setError(messageFrom(bootstrapError));
        setLoading(false);
        return;
      }
      const access = Boolean(
        bootstrapData
        && typeof bootstrapData === "object"
        && "has_malaga_access" in bootstrapData
        && bootstrapData.has_malaga_access,
      );
      hasMalagaAccessRef.current = access;
      setHasMalagaAccess(access);

      const { error: recurringError } = await supabase!.rpc("generate_due_recurring_transactions");
      if (!active) return;
      lastRecurringGenerationRef.current = todayIso();
      await loadData(access);
      if (recurringError) setError(messageFrom(recurringError));
    }

    void bootstrapAndLoad();
    return () => {
      active = false;
    };
  }, [loadData, supabase, userId]);

  useEffect(() => {
    if (!supabase || !userId) return;
    let running = false;
    async function generateAfterDayChange() {
      if (document.visibilityState !== "visible" || running) return;
      const today = todayIso();
      if (lastRecurringGenerationRef.current === today) return;
      running = true;
      const { error: recurringError } = await supabase!.rpc("generate_due_recurring_transactions");
      if (recurringError) {
        setError(messageFrom(recurringError));
      } else {
        lastRecurringGenerationRef.current = today;
        await refresh();
      }
      running = false;
    }
    document.addEventListener("visibilitychange", generateAfterDayChange);
    window.addEventListener("focus", generateAfterDayChange);
    return () => {
      document.removeEventListener("visibilitychange", generateAfterDayChange);
      window.removeEventListener("focus", generateAfterDayChange);
    };
  }, [refresh, supabase, userId]);

  const signInWithPassword = useCallback(async (email: string, password: string) => {
    if (!supabase) return false;
    setError(null);
    setNotice(null);
    setLoading(true);
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) throw signInError;
      return true;
    } catch (caught) {
      setError(messageFrom(caught));
      return false;
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  const signUp = useCallback(async (email: string, password: string, displayName: string) => {
    if (!supabase) throw new Error("Supabase no está configurado.");
    setError(null);
    setNotice(null);
    setLoading(true);
    try {
      const invite = new URLSearchParams(window.location.search).get("invite") ?? "";
      if (!invite) {
        throw new Error("Abre el enlace de invitación completo para crear una cuenta.");
      }
      const { error: signUpError } = await supabase.functions.invoke("public-signup", {
        body: {
          email,
          password,
          display_name: displayName.trim(),
          invite,
          website: "",
        },
      });
      if (signUpError) {
        let detail = signUpError.message;
        if ("context" in signUpError && signUpError.context instanceof Response) {
          try {
            const body = await signUpError.context.json() as { error?: string };
            if (body.error) detail = body.error;
          } catch {
            // Conserva el mensaje original si la respuesta no contiene JSON.
          }
      }
        throw new Error(detail);
      }
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) throw signInError;
      setNotice("Cuenta creada. Tu libreta personal ya está lista.");
    } catch (caught) {
      setError(messageFrom(caught));
      throw caught;
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  const sendAccessLink = useCallback(async (email: string) => {
    if (!supabase) return false;
    setError(null);
    setNotice(null);
    setLoading(true);
    try {
      const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
      const redirectUrl = new URL(`${basePath}/ajustes/`, window.location.origin);
      redirectUrl.searchParams.set("configurar-acceso", "1");
      const { error: signInError } = await supabase.auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser: false,
          emailRedirectTo: redirectUrl.toString(),
        },
      });
      if (signInError) throw signInError;
      setNotice("Enlace enviado. Ábrelo desde el correo para entrar en tu cuenta.");
      return true;
    } catch (caught) {
      setError(messageFrom(caught));
      return false;
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  const updatePassword = useCallback(async (password: string) => {
    if (!supabase) throw new Error("Supabase no está configurado.");
    setError(null);
    setNotice(null);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;
      setNotice("Clave guardada.");
    } catch (caught) {
      setError(messageFrom(caught));
      throw caught;
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
    if (!hasMalagaAccess) throw new Error("Esta sección solo está disponible para la cuenta propietaria.");
    const property = properties.find((item) => item.name === "Piso Málaga") ?? properties[0];
    if (!property) throw new Error("No existe la propiedad Piso Málaga.");

    const calculation = calculateRentalBooking({
      checkInDate: booking.check_in_date,
      checkOutDate: booking.check_out_date,
      accommodationFinal: Number(booking.accommodation_final),
      cleaning: Number(booking.cleaning_fee),
      platformRate: Number(booking.platform_commission_rate),
      managerRate: Number(booking.manager_rate),
      platformCommissionOverride: booking.platform_commission_override_amount,
      managerPaymentOverride: booking.manager_payment_override_amount,
    });
    const payload = {
      ...booking,
      booking_date: booking.check_in_date,
      gross_before_discount: calculation.totalGross,
      guest_paid_after_discount: calculation.totalGross,
      platform_commission_amount: calculation.platformCommissionUsed,
      bank_fee_rate: 0,
      bank_fee_amount: 0,
      manager_commission_amount: calculation.managerCommissionCalculated,
      manager_cleaning_amount: Number(booking.cleaning_fee),
      payout_received: calculation.netAfterPlatform,
      amount_payable_to_manager: calculation.managerPaymentUsed,
      owner_net_after_manager: calculation.ownerNet,
      calculation_status: "reconciled" as const,
      manual_override: booking.platform_commission_override_amount !== null
        || booking.manager_payment_override_amount !== null,
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
  }, [hasMalagaAccess, properties, refresh, session, supabase]);

  const deleteBooking = useCallback(async (id: string) => {
    if (!supabase) throw new Error("Supabase no está configurado.");
    if (!hasMalagaAccess) throw new Error("Esta sección solo está disponible para la cuenta propietaria.");
    const { error: bookingError } = await supabase.from("rental_bookings").delete().eq("id", id);
    if (bookingError) throw bookingError;
    setBookings((current) => current.filter((booking) => booking.id !== id));
  }, [hasMalagaAccess, supabase]);

  const savePropertyRecurring = useCallback(async (rule: PropertyRecurringInput, id?: string) => {
    if (!supabase || !session) throw new Error("Inicia sesión para guardar.");
    if (!hasMalagaAccess) throw new Error("Esta sección solo está disponible para la cuenta propietaria.");
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
  }, [categories, hasMalagaAccess, refresh, session, supabase]);

  const deletePropertyRecurring = useCallback(async (id: string) => {
    if (!supabase) throw new Error("Supabase no está configurado.");
    if (!hasMalagaAccess) throw new Error("Esta sección solo está disponible para la cuenta propietaria.");
    const { error: recurringError } = await supabase.from("recurring_rules").delete().eq("id", id);
    if (recurringError) throw recurringError;
    setRecurringRules((current) => current.filter((rule) => rule.id !== id));
  }, [hasMalagaAccess, supabase]);

  const saveRecurring = useCallback(async (rule: RecurringInput, id?: string) => {
    if (!supabase || !session) throw new Error("Inicia sesión para guardar.");
    const category = categories.find((item) =>
      item.id === rule.category_id
      && item.category_scope === rule.direction);
    if (!category) throw new Error("Selecciona una categoría válida.");
    const subcategory = rule.subcategory_id
      ? subcategories.find((item) =>
          item.id === rule.subcategory_id && item.category_id === category.id)
      : null;
    if (rule.subcategory_id && !subcategory) {
      throw new Error("Selecciona una subcategoría válida.");
    }

    const start = new Date(`${rule.effective_from}T00:00:00Z`);
    const existing = id ? recurringRules.find((item) => item.id === id) : null;
    const payload = {
      name: rule.name.trim(),
      amount: rule.direction === "expense"
        ? -Math.abs(Number(rule.amount))
        : Math.abs(Number(rule.amount)),
      frequency: rule.frequency,
      effective_from: rule.effective_from,
      effective_until: rule.effective_until || null,
      user_id: session.user.id,
      category_id: category.id,
      subcategory_id: subcategory?.id ?? null,
      context: null,
      day_of_month: start.getUTCDate(),
      auto_generate: true,
      is_active: existing?.is_active ?? true,
      notes: rule.notes?.trim() || null,
    };

    const query = id
      ? supabase.from("recurring_rules").update(payload).eq("id", id)
      : supabase.from("recurring_rules").insert(payload);
    const { error: recurringError } = await query;
    if (recurringError) throw recurringError;
    const { error: generationError } = await supabase.rpc("generate_due_recurring_transactions");
    if (generationError) throw generationError;
    await refresh();
  }, [categories, recurringRules, refresh, session, subcategories, supabase]);

  const deleteRecurring = useCallback(async (id: string) => {
    if (!supabase) throw new Error("Supabase no está configurado.");
    const target = recurringRules.find((rule) => rule.id === id);
    if (target?.context?.toLocaleLowerCase("es") === "piso málaga") {
      throw new Error("Gestiona este recurrente desde Piso Málaga.");
    }
    const { error: recurringError } = await supabase.from("recurring_rules").delete().eq("id", id);
    if (recurringError) throw recurringError;
    setRecurringRules((current) => current.filter((rule) => rule.id !== id));
  }, [recurringRules, supabase]);

  const toggleRecurring = useCallback(async (id: string, isActive: boolean) => {
    if (!supabase) throw new Error("Supabase no está configurado.");
    const target = recurringRules.find((rule) => rule.id === id);
    if (target?.context?.toLocaleLowerCase("es") === "piso málaga") {
      throw new Error("Gestiona este recurrente desde Piso Málaga.");
    }
    const { error: recurringError } = await supabase
      .from("recurring_rules")
      .update({ is_active: isActive })
      .eq("id", id);
    if (recurringError) throw recurringError;
    if (isActive) {
      const { error: generationError } = await supabase.rpc("generate_due_recurring_transactions");
      if (generationError) throw generationError;
    }
    await refresh();
  }, [recurringRules, refresh, supabase]);

  const value = useMemo<FinanceContextValue>(() => ({
    configured: Boolean(supabase),
    session,
    hasMalagaAccess,
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
    signInWithPassword,
    signUp,
    sendAccessLink,
    updatePassword,
    signOut,
    refresh,
    addTransaction,
    updateTransaction,
    deleteTransaction,
    saveBooking,
    deleteBooking,
    savePropertyRecurring,
    deletePropertyRecurring,
    saveRecurring,
    deleteRecurring,
    toggleRecurring,
  }), [
    accounts, addTransaction, bookings, categories, deleteBooking, deletePropertyRecurring,
    deleteRecurring, deleteTransaction, error, hasMalagaAccess, loading, notice, properties,
    recurringRules, refresh, saveBooking, savePropertyRecurring, saveRecurring, session,
    sendAccessLink, signInWithPassword, signOut, signUp, subcategories, supabase,
    toggleRecurring, transactions, updatePassword, updateTransaction,
  ]);

  return <FinanceContext.Provider value={value}>{children}</FinanceContext.Provider>;
}

export function useFinance() {
  const value = useContext(FinanceContext);
  if (!value) throw new Error("useFinance must be used inside FinanceProvider");
  return value;
}
