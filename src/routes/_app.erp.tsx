import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import {
  Download,
  Filter,
  Search,
  ShoppingCart,
  Package,
  DollarSign,
  ClipboardList,
  Plug,
} from "lucide-react";

import { PageHeader } from "@/components/shared/PageHeader";
import { StatTile } from "@/components/shared/Workspace";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const Route = createFileRoute("/_app/erp")({
  head: () => ({ meta: [{ title: "ERP Data - Jigo AI Workspace" }] }),
  component: ErpPage,
});

function ErpPage() {
  const [query, setQuery] = useState("");

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 md:px-6 md:py-8">
      <PageHeader
        title="ERP Data"
        description="Query and explore connected ERP records with filters and export."
        actions={
          <Button size="sm" variant="outline" disabled>
            <Download className="mr-1.5 h-3.5 w-3.5" />
            Export
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Open orders" value="—" hint="Connect ERP to load" icon={ShoppingCart} />
        <StatTile label="Revenue MTD" value="—" hint="No live feed yet" icon={DollarSign} />
        <StatTile label="Inventory SKUs" value="—" hint="No live feed yet" icon={Package} />
        <StatTile label="Open POs" value="—" hint="No live feed yet" icon={ClipboardList} />
      </div>

      <Card className="mt-6">
        <CardHeader className="flex-row flex-wrap items-center justify-between gap-3 space-y-0">
          <CardTitle>Sales orders</CardTitle>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search orders…"
                className="h-8 w-56 pl-8"
                disabled
              />
            </div>
            <Button variant="outline" size="sm" className="h-8" disabled>
              <Filter className="mr-1.5 h-3.5 w-3.5" />
              Filters
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Order ID</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell colSpan={5} className="py-12 text-center">
                    <Plug className="mx-auto h-8 w-8 text-muted-foreground" />
                    <p className="mt-2 text-sm font-medium">No ERP data connected</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Connect your ERP or sync workplace apps from{" "}
                      <Link to="/integrations" className="text-primary hover:underline">
                        Integrations
                      </Link>
                      .
                    </p>
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
