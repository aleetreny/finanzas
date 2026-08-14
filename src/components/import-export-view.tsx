"use client";

import { Download, FileCheck2, FileUp, LoaderCircle } from "lucide-react";
import Papa from "papaparse";
import { useMemo, useState } from "react";
import { useFinance } from "@/components/finance-provider";
import { PageHeader } from "@/components/page-header";
import { parseLocalizedDecimal } from "@/lib/decimal-input";
import { getSupabase } from "@/lib/supabase";

type CsvRow = Record<string, string>;

async function sha256(file: File) {
  const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function ImportExportView() {
  const { transactions, categories, subcategories, accounts, session, refresh } = useFinance();
  const supabase = getSupabase();
  const [file, setFile] = useState<File | null>(null);
  const [rows, setRows] = useState<CsvRow[]>([]);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [messageType, setMessageType] = useState<"success" | "error">("success");
  const categoryById = useMemo(() => new Map(categories.map((item) => [item.id, item.name])), [categories]);
  const subcategoryById = useMemo(() => new Map(subcategories.map((item) => [item.id, item.name])), [subcategories]);

  function selectFile(next: File | undefined) {
    setFile(next ?? null); setRows([]); setParseErrors([]); setMessage(null); setMessageType("success");
    if (!next) return;
    Papa.parse<CsvRow>(next, {
      header: true,
      delimiter: ";",
      skipEmptyLines: "greedy",
      encoding: "UTF-8",
      complete: (result) => {
        setRows(result.data);
        setParseErrors(result.errors.map((error) => `Fila ${(error.row ?? 0) + 2}: ${error.message}`));
      },
    });
  }

  function exportCsv() {
    const data = transactions.map((row) => ({
      id_origen: row.source_external_id ?? row.id,
      fecha: row.transaction_date,
      periodo_desde: row.allocation_start_date ?? "",
      periodo_hasta: row.allocation_end_date ?? "",
      nombre: row.name,
      importe_eur: Number(row.amount).toFixed(2),
      tipo: row.direction === "income" ? "Ingreso" : row.direction === "expense" ? "Gasto" : "Neutro",
      categoria_principal: categoryById.get(row.category_id ?? "") ?? "",
      subcategoria: subcategoryById.get(row.subcategory_id ?? "") ?? "",
      contexto: row.context ?? "",
      plataforma: row.platform ?? "",
      fiscal_piso_malaga: row.fiscal_property_status ?? "",
      nota_migracion: row.notes ?? "",
    }));
    const csv = `\uFEFF${Papa.unparse(data, { delimiter: ";", newline: "\r\n" })}`;
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `finanzas-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  async function importCsv() {
    if (!supabase || !session || !file || !rows.length) return;
    setWorking(true); setMessage(null);
    try {
      const hash = await sha256(file);
      const { data: existing } = await supabase.from("import_batches").select("id,imported_rows").eq("file_hash", hash).maybeSingle();
      if (existing) {
        setMessageType("success");
        setMessage(`Este archivo ya se importó (${existing.imported_rows} filas). No se ha duplicado nada.`);
        return;
      }
      const account = accounts.find((item) => item.is_default) ?? accounts[0];
      if (!account) throw new Error("No existe una cuenta por defecto.");
      const categoriesByName = new Map(categories.map((item) => [item.name, item.id]));
      const subcategoriesByName = new Map(subcategories.map((item) => [`${item.category_id}\u0000${item.name}`, item.id]));
      const valid: Record<string, unknown>[] = [];
      const rejected: string[] = [];
      rows.forEach((row, index) => {
        const amount = parseLocalizedDecimal(row.importe_eur ?? row.amount);
        const date = row.fecha ?? row.transaction_date;
        const name = row.nombre ?? row.name;
        const categoryId = categoriesByName.get(row.categoria_principal ?? "");
        const allocationStart = row.periodo_desde || row.allocation_start_date || "";
        const allocationEnd = row.periodo_hasta || row.allocation_end_date || "";
        const validAllocationDates = (!allocationStart && !allocationEnd)
          || (
            /^\d{4}-\d{2}-\d{2}$/.test(allocationStart)
            && /^\d{4}-\d{2}-\d{2}$/.test(allocationEnd)
            && allocationEnd >= allocationStart
          );
        if (!date?.match(/^\d{4}-\d{2}-\d{2}$/) || !name || amount === undefined || !categoryId || !validAllocationDates) {
          rejected.push(`Fila ${index + 2}: fecha, nombre, importe, categoría o periodo de imputación no válidos.`);
          return;
        }
        const externalId = row.id_origen || row.source_external_id || `${hash}:${index + 1}`;
        valid.push({
          user_id: session.user.id,
          account_id: account.id,
          transaction_date: date,
          allocation_start_date: allocationStart || null,
          allocation_end_date: allocationEnd || null,
          name,
          amount,
          direction: amount > 0 ? "income" : amount < 0 ? "expense" : "neutral",
          category_id: categoryId,
          subcategory_id: subcategoriesByName.get(`${categoryId}\u0000${row.subcategoria ?? ""}`) ?? null,
          context: row.contexto || null,
          platform: row.plataforma || null,
          fiscal_property_status: row.fiscal_piso_malaga || null,
          notes: row.nota_migracion || null,
          source: "csv_import",
          source_external_id: externalId,
          import_metadata: { fila_importada: index + 2 },
        });
      });
      const { data: batch, error: batchError } = await supabase.from("import_batches").insert({ user_id: session.user.id, file_name: file.name, file_hash: hash, total_rows: rows.length, imported_rows: 0, rejected_rows: rejected.length }).select("id").single();
      if (batchError || !batch) throw batchError ?? new Error("No se pudo crear el lote.");
      valid.forEach((row) => { row.import_batch_id = batch.id; });
      let imported = 0;
      for (let index = 0; index < valid.length; index += 200) {
        const chunk = valid.slice(index, index + 200);
        // Con ignoreDuplicates, solo las filas realmente insertadas vuelven en
        // data: así el informe no cuenta duplicados omitidos como importados.
        const { data: insertedRows, error } = await supabase
          .from("transactions")
          .upsert(chunk, { onConflict: "user_id,source,source_external_id", ignoreDuplicates: true })
          .select("id");
        if (error) throw error;
        imported += insertedRows?.length ?? 0;
      }
      await supabase.from("import_batches").update({ imported_rows: imported, rejected_rows: rejected.length, completed_at: new Date().toISOString() }).eq("id", batch.id);
      setParseErrors(rejected);
      const skipped = valid.length - imported;
      setMessageType("success");
      setMessage(`Importación terminada: ${imported} filas nuevas, ${skipped} duplicadas omitidas y ${rejected.length} rechazadas.`);
      await refresh();
    } catch (caught) {
      setMessageType("error");
      setMessage(caught instanceof Error ? caught.message : "No se pudo importar el archivo.");
    } finally {
      setWorking(false);
    }
  }

  return (
    <div className="page">
      <PageHeader eyebrow="" title="Importar y exportar" description="Trae tu histórico en CSV o llévate una copia de todo cuando quieras." />
      <section className="grid two-column">
        <article className="card">
          <div className="card-header"><div><h2><FileUp size={16} style={{ display: "inline", marginRight: 7 }} />Importar CSV</h2><p>UTF-8 con BOM, separador punto y coma</p></div></div>
          <div className="card-body">
            <label className="file-drop">
              <input type="file" accept=".csv,text/csv" onChange={(event) => selectFile(event.target.files?.[0])} />
              <FileCheck2 size={26} />
              <strong>{file?.name ?? "Selecciona un archivo CSV"}</strong>
              <small>{rows.length ? `${rows.length} filas detectadas` : "Verás una vista previa antes de guardar nada"}</small>
            </label>
            {rows.length ? <div className="preview-table"><table className="data-table" style={{ display: "table" }}><thead><tr>{Object.keys(rows[0]).slice(0, 4).map((key) => <th key={key}>{key}</th>)}</tr></thead><tbody>{rows.slice(0, 5).map((row, index) => <tr key={index}>{Object.keys(rows[0]).slice(0, 4).map((key) => <td key={key}>{row[key]}</td>)}</tr>)}</tbody></table></div> : null}
            <div className="form-actions"><button className="button primary" disabled={!rows.length || working || parseErrors.length > 0} onClick={() => void importCsv()}>{working ? <LoaderCircle className="spin" size={16} /> : <FileUp size={16} />}Confirmar importación</button></div>
          </div>
        </article>
        <article className="card">
          <div className="card-header"><div><h2><Download size={16} style={{ display: "inline", marginRight: 7 }} />Exportación completa</h2><p>Una copia portátil de todos tus movimientos</p></div></div>
          <div className="card-body">
            <div className="stat-strip"><span>Movimientos<strong>{transactions.length.toLocaleString("es-ES")}</strong></span><span>Formato<strong>CSV</strong></span><span>Codificación<strong>UTF-8 BOM</strong></span></div>
            <p style={{ color: "var(--pencil)", fontSize: 14, lineHeight: 1.6 }}>Incluye fechas, periodos de imputación, importes, categorías y notas. El mismo archivo vale para volver a importarlo aquí.</p>
            <button className="button primary" onClick={exportCsv}><Download size={16} />Descargar todos los datos</button>
          </div>
        </article>
      </section>
      {message ? <p className={`notice ${messageType}`} role={messageType === "error" ? "alert" : "status"}>{message}</p> : null}
      {parseErrors.length ? <article className="card" style={{ marginTop: 18 }}><div className="card-header"><div><h2>Errores de validación</h2><p>Corrige estas filas antes de confirmar</p></div></div><div className="card-body">{parseErrors.slice(0, 20).map((error) => <p className="notice error" key={error}>{error}</p>)}</div></article> : null}
    </div>
  );
}
