import type { Metadata } from "next";
import { listBankTransactions, listCandidatePayments } from "@/app/_lib/data/bank";
import { PageHeader } from "@/app/_components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { ImportBank } from "./_components/import-bank";
import { ConciliacionTable } from "./_components/conciliacion-table";

export const metadata: Metadata = { title: "Conciliación bancaria" };

export default async function ConciliacionPage() {
  const [txs, candidates] = await Promise.all([
    listBankTransactions(),
    listCandidatePayments(),
  ]);
  const depositos = txs.filter((t) => t.monto > 0);
  const casados = depositos.filter((t) => t.matched_payment_id).length;

  return (
    <>
      <PageHeader
        title="Conciliación bancaria"
        subtitle="Importa tu estado de cuenta y casa cada depósito con el cobro que registraste."
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-2">
        <Card>
          <CardContent className="py-4">
            <p className="text-muted-foreground text-xs">Depósitos importados</p>
            <p className="text-xl font-bold">{depositos.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <p className="text-muted-foreground text-xs">Cuadran con un cobro</p>
            <p className="text-xl font-bold">
              {casados}
              <span className="text-muted-foreground text-sm font-normal"> / {depositos.length}</span>
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="mb-6">
        <ImportBank />
      </div>

      <h2 className="mb-3 text-lg font-semibold">Movimientos</h2>
      <ConciliacionTable txs={txs} candidates={candidates} />
    </>
  );
}
