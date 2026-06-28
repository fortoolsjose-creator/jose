import type { Metadata } from "next";
import { Receipt } from "lucide-react";
import { listProperties } from "@/app/_lib/data/properties";
import { listEntityOptions } from "@/app/_lib/data/entities";
import { listExpenses, listExpenseMonths } from "@/app/_lib/data/expenses";
import { PageHeader } from "@/app/_components/page-header";
import { EmptyState } from "@/app/_components/empty-state";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatMXN, formatMonth, formatDate } from "@/app/_lib/format";
import { EXPENSE_CATEGORY_LABELS } from "@/app/_lib/types";
import { ExpenseDialog } from "./_components/expense-dialog";
import { ExpenseFilters } from "./_components/expense-filters";
import { ConfirmDeleteButton } from "@/app/(admin)/propiedades/_components/confirm-delete-button";
import { deleteExpense } from "./actions";

export const metadata: Metadata = { title: "Gastos" };

export default async function GastosPage(props: {
  searchParams: Promise<{ month?: string; property?: string }>;
}) {
  const sp = await props.searchParams;
  const [propsList, monthValues, expenses, entities] = await Promise.all([
    listProperties(),
    listExpenseMonths(),
    listExpenses({ month: sp.month, propertyId: sp.property }),
    listEntityOptions(),
  ]);
  const properties = propsList.map((p) => ({ id: p.id, name: p.name }));
  const months = monthValues.map((m) => ({ value: m, label: formatMonth(m) }));
  const total = expenses.reduce((s, e) => s + Number(e.amount), 0);

  const dialog = <ExpenseDialog properties={properties} entities={entities} />;

  return (
    <>
      <PageHeader
        title="Gastos"
        subtitle="Lo que sale: mantenimiento, servicios, predial, impuestos…"
        action={dialog}
      />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <ExpenseFilters months={months} properties={properties} />
        <p className="text-muted-foreground text-sm">
          Total: <span className="text-foreground font-semibold">{formatMXN(total)}</span>
        </p>
      </div>

      {expenses.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title="Sin gastos registrados"
          description="Registra tus egresos para ver la ganancia real de cada edificio en Rentabilidad."
          action={dialog}
        />
      ) : (
        <div className="space-y-2">
          {expenses.map((e) => (
            <Card key={e.id}>
              <CardContent className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{formatMXN(e.amount)}</span>
                    <Badge variant="secondary">{EXPENSE_CATEGORY_LABELS[e.category]}</Badge>
                  </div>
                  <p className="text-muted-foreground text-sm">
                    {[e.vendor, e.property?.name ?? "General", formatDate(e.expense_date)]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <ExpenseDialog properties={properties} expense={e} />
                  <ConfirmDeleteButton
                    onConfirm={deleteExpense.bind(null, e.id)}
                    title="¿Eliminar gasto?"
                    description={`Se eliminará el gasto de ${formatMXN(e.amount)}.`}
                    triggerLabel=""
                  />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
