import { expect, type Page, type Route } from "@playwright/test";

type Row = Record<string, unknown>;
type TableName =
  | "accounts"
  | "categories"
  | "subcategories"
  | "transactions"
  | "trip_projects"
  | "recurring_rules"
  | "rental_bookings"
  | "properties"
  | "import_batches";

export type MockFinanceDatabase = Record<TableName, Row[]>;

const now = "2026-07-23T12:00:00.000Z";
const userId = "00000000-0000-4000-8000-000000000001";

function jwtPart(value: Row) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function accessToken() {
  const expiresAt = Math.floor(Date.now() / 1000) + 60 * 60;
  return `${jwtPart({ alg: "HS256", typ: "JWT" })}.${jwtPart({
    aud: "authenticated",
    exp: expiresAt,
    sub: userId,
    email: "movil@example.com",
    role: "authenticated",
  })}.test-signature`;
}

function mockUser() {
  return {
    id: userId,
    aud: "authenticated",
    role: "authenticated",
    email: "movil@example.com",
    email_confirmed_at: now,
    phone: "",
    app_metadata: { provider: "email", providers: ["email"] },
    user_metadata: {},
    identities: [],
    created_at: now,
    updated_at: now,
    is_anonymous: false,
  };
}

function corsHeaders(extra: Record<string, string> = {}) {
  return {
    "access-control-allow-origin": "*",
    "access-control-allow-headers": "apikey, authorization, content-type, prefer, range, x-client-info",
    "access-control-allow-methods": "GET, POST, PATCH, DELETE, OPTIONS",
    "access-control-expose-headers": "Content-Range",
    ...extra,
  };
}

function idFilter(url: URL) {
  const value = url.searchParams.get("id");
  return value?.startsWith("eq.") ? value.slice(3) : null;
}

function rowsForRequest(rows: Row[], url: URL) {
  const id = idFilter(url);
  if (id) return rows.filter((row) => row.id === id);

  const fileHash = url.searchParams.get("file_hash");
  if (fileHash?.startsWith("eq.")) {
    return rows.filter((row) => row.file_hash === fileHash.slice(3));
  }
  return rows;
}

async function fulfillJson(route: Route, body: unknown, status = 200) {
  await route.fulfill({
    status,
    headers: corsHeaders({ "content-type": "application/json; charset=utf-8" }),
    body: JSON.stringify(body),
  });
}

export function createMockFinanceDatabase(): MockFinanceDatabase {
  return {
    accounts: [
      { id: "account-1", name: "Cuenta principal", currency: "EUR", is_default: true },
    ],
    categories: [
      { id: "cat-home", name: "Casa", sort_order: 1, is_active: true, category_scope: "expense" },
      { id: "cat-food", name: "Comida", sort_order: 2, is_active: true, category_scope: "expense" },
      { id: "cat-income", name: "Ingresos", sort_order: 3, is_active: true, category_scope: "income" },
      { id: "cat-property", name: "Piso Málaga", sort_order: 4, is_active: true, category_scope: "property" },
    ],
    subcategories: [
      { id: "sub-home", category_id: "cat-home", name: "Suministros", sort_order: 1, is_active: true },
      { id: "sub-food", category_id: "cat-food", name: "Supermercado", sort_order: 1, is_active: true },
      { id: "sub-salary", category_id: "cat-income", name: "Nómina", sort_order: 1, is_active: true },
      { id: "sub-rent", category_id: "cat-property", name: "Ingreso alquiler", sort_order: 1, is_active: true },
      { id: "sub-clean", category_id: "cat-property", name: "Limpieza", sort_order: 2, is_active: true },
      { id: "sub-community", category_id: "cat-property", name: "Comunidad", sort_order: 3, is_active: true },
    ],
    transactions: [
      {
        id: "tx-food",
        user_id: userId,
        account_id: "account-1",
        transaction_date: "2026-07-20",
        name: "Compra semanal",
        amount: -42.5,
        direction: "expense",
        category_id: "cat-food",
        subcategory_id: "sub-food",
        context: null,
        platform: null,
        trip_project_id: "trip-eclipse",
        recurring_rule_id: null,
        fiscal_property_status: null,
        notes: "Fruta y verdura",
        source: "manual",
        source_external_id: null,
        created_at: now,
      },
      {
        id: "tx-salary",
        user_id: userId,
        account_id: "account-1",
        transaction_date: "2026-07-01",
        name: "Nómina julio",
        amount: 2400,
        direction: "income",
        category_id: "cat-income",
        subcategory_id: "sub-salary",
        context: null,
        platform: null,
        trip_project_id: null,
        recurring_rule_id: null,
        fiscal_property_status: null,
        notes: null,
        source: "manual",
        source_external_id: null,
        created_at: now,
      },
      {
        id: "tx-property",
        user_id: userId,
        account_id: "account-1",
        transaction_date: "2026-06-15",
        name: "Cambio de cerradura",
        amount: -125,
        direction: "expense",
        category_id: "cat-property",
        subcategory_id: "sub-home",
        context: "Piso Málaga",
        platform: null,
        trip_project_id: null,
        recurring_rule_id: null,
        fiscal_property_status: null,
        notes: null,
        source: "manual",
        source_external_id: null,
        created_at: now,
      },
    ],
    trip_projects: [
      {
        id: "trip-eclipse",
        user_id: userId,
        name: "Eclipse",
        start_date: "2026-07-20",
        end_date: "2026-07-23",
        is_active: true,
        created_at: now,
        updated_at: now,
      },
    ],
    recurring_rules: [
      {
        id: "recurring-1",
        name: "Comunidad",
        amount: -80,
        frequency: "monthly",
        day_of_month: 1,
        effective_from: "2026-01-01",
        effective_until: null,
        category_id: "cat-property",
        subcategory_id: "sub-community",
        context: "Piso Málaga",
        auto_generate: true,
        is_active: true,
        notes: null,
      },
    ],
    rental_bookings: [
      {
        id: "booking-1",
        user_id: userId,
        property_id: "property-1",
        name: "Reserva verano",
        check_in_date: "2026-07-10",
        check_out_date: "2026-07-15",
        platform: "airbnb",
        commission_model: "airbnb_host_only",
        accommodation_final: 600,
        cleaning_fee: 60,
        discount_amount: 0,
        gross_before_discount: 660,
        guest_paid_after_discount: 660,
        platform_commission_rate: 0.154,
        platform_commission_amount: 101.64,
        platform_commission_override_amount: null,
        bank_fee_rate: 0,
        bank_fee_amount: 0,
        manager_rate: 0.15,
        manager_commission_amount: 90,
        manager_cleaning_amount: 60,
        manager_payment_override_amount: null,
        amount_payable_to_manager: 150,
        payout_received: 558.36,
        owner_net_after_manager: 408.36,
        calculation_status: "reconciled",
        allocation_method: "daily",
        source_key: null,
        linked_transaction_id: null,
        manual_override: false,
        notes: null,
        created_at: now,
      },
    ],
    properties: [
      { id: "property-1", name: "Piso Málaga", property_type: "rental", is_active: true },
    ],
    import_batches: [],
  };
}

export async function installMockFinanceBackend(
  page: Page,
  db = createMockFinanceDatabase(),
  options: { hasMalagaAccess?: boolean } = {},
) {
  const hasMalagaAccess = options.hasMalagaAccess ?? true;
  await page.route("**/auth/v1/**", async (route) => {
    const request = route.request();
    if (request.method() === "OPTIONS") {
      await route.fulfill({ status: 204, headers: corsHeaders() });
      return;
    }

    const url = new URL(request.url());
    if (url.pathname.endsWith("/token")) {
      const token = accessToken();
      await fulfillJson(route, {
        access_token: token,
        token_type: "bearer",
        expires_in: 3600,
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        refresh_token: "mock-refresh-token",
        user: mockUser(),
      });
      return;
    }
    if (url.pathname.endsWith("/logout")) {
      await route.fulfill({ status: 204, headers: corsHeaders() });
      return;
    }
    if (url.pathname.endsWith("/signup")) {
      await fulfillJson(route, { user: mockUser(), session: null });
      return;
    }
    await fulfillJson(route, { user: mockUser() });
  });

  await page.route("**/functions/v1/public-signup", async (route) => {
    if (route.request().method() === "OPTIONS") {
      await route.fulfill({ status: 204, headers: corsHeaders() });
      return;
    }
    await fulfillJson(route, { created: true }, 201);
  });

  await page.route("**/rest/v1/**", async (route) => {
    const request = route.request();
    if (request.method() === "OPTIONS") {
      await route.fulfill({ status: 204, headers: corsHeaders() });
      return;
    }

    const url = new URL(request.url());
    const resource = url.pathname.split("/rest/v1/")[1];
    if (!resource) {
      await fulfillJson(route, []);
      return;
    }
    if (resource.startsWith("rpc/")) {
      if (resource === "rpc/bootstrap_user_workspace") {
        await fulfillJson(route, {
          claimed: hasMalagaAccess,
          seeded: false,
          has_malaga_access: hasMalagaAccess,
        });
      } else if (resource === "rpc/generate_due_recurring_transactions") {
        await fulfillJson(route, 0);
      } else {
        await fulfillJson(route, null);
      }
      return;
    }

    const table = resource.split("/")[0] as TableName;
    const rows = db[table];
    if (!rows) {
      await fulfillJson(route, { message: `Mock table ${table} is not configured.` }, 404);
      return;
    }

    if (request.method() === "GET" || request.method() === "HEAD") {
      const result = rowsForRequest(rows, url);
      await route.fulfill({
        status: 200,
        headers: corsHeaders({
          "content-type": "application/json; charset=utf-8",
          "content-range": `0-${Math.max(result.length - 1, 0)}/${result.length}`,
        }),
        body: request.method() === "HEAD" ? "" : JSON.stringify(result),
      });
      return;
    }

    const posted = request.postDataJSON() as Row | Row[] | null;
    if (request.method() === "POST") {
      const values = (Array.isArray(posted) ? posted : [posted ?? {}]).map((value, index) => ({
        ...value,
        id: value.id ?? `${table}-${rows.length + index + 1}`,
        created_at: value.created_at ?? now,
      }));
      rows.push(...values);
      const wantsObject = request.headers().accept?.includes("application/vnd.pgrst.object");
      await fulfillJson(route, wantsObject ? values[0] : values, 201);
      return;
    }

    if (request.method() === "PATCH") {
      const id = idFilter(url);
      const changed: Row[] = [];
      rows.forEach((row) => {
        if (!id || row.id === id) {
          Object.assign(row, posted ?? {});
          changed.push(row);
        }
      });
      const wantsObject = request.headers().accept?.includes("application/vnd.pgrst.object");
      await fulfillJson(route, wantsObject ? changed[0] ?? null : changed);
      return;
    }

    if (request.method() === "DELETE") {
      const id = idFilter(url);
      const removed = rows.filter((row) => !id || row.id === id);
      db[table] = rows.filter((row) => id && row.id !== id);
      await fulfillJson(route, removed);
      return;
    }

    await fulfillJson(route, { message: `Unsupported method ${request.method()}.` }, 405);
  });

  return db;
}

export async function signInToMockFinance(page: Page) {
  await page.goto("/");
  await page.getByLabel("Correo electrónico").fill("movil@example.com");
  await page.getByLabel("Clave").fill("clave-segura-movil");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page.locator(".loading-state")).toHaveCount(0);
  await expect(page.locator(".app-frame.authenticated")).toBeVisible();
  await page.waitForFunction(() =>
    Object.entries(localStorage).some(([key, value]) => key.startsWith("sb-") && value.includes("mock-refresh-token")),
  );
}
