import { createFileRoute } from "@tanstack/react-router";
import { useState, type DragEvent } from "react";
import { FileText, Search, Upload, MoreVertical, ArrowUpDown } from "lucide-react";

import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { EmptyState } from "@/components/shared/EmptyState";
import { useDocumentStore } from "@/store/documentStore";
import { cn } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/_app/documents")({
  head: () => ({ meta: [{ title: "Documents - Jigo AI Workspace" }] }),
  component: DocumentsPage,
});

function DocumentsPage() {
  const { documents, add } = useDocumentStore();
  const [q, setQ] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  const filtered = documents
    .filter((d) => d.name.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => {
      if (sortOrder === "asc") return a.name.localeCompare(b.name);
      return b.name.localeCompare(a.name);
    });

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    handleFiles(Array.from(e.dataTransfer.files));
  };

  const handleFiles = (files: File[]) => {
    files.forEach((f) => {
      add({
        id: `d_${Date.now()}_${f.name}`,
        name: f.name,
        type: f.name.split(".").pop()?.toUpperCase() || "FILE",
        size: `${(f.size / 1024).toFixed(0)} KB`,
        uploadedAt: "just now",
        status: "processing",
      });
    });
    setUploadOpen(false);
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 md:px-6 md:py-8">
      <PageHeader
        title="Documents"
        description="Upload and extract insights from your files."
        actions={
          <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Upload className="mr-1.5 h-3.5 w-3.5" />
                Upload Document
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Upload Document</DialogTitle>
                <DialogDescription>
                  Drag and drop your files here or click to browse.
                </DialogDescription>
              </DialogHeader>
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={onDrop}
                className={cn(
                  "mt-4 rounded-xl border-2 border-dashed p-8 text-center transition-colors",
                  dragOver ? "border-primary bg-primary/5" : "border-border/60 bg-card/30",
                )}
              >
                <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Upload className="h-5 w-5" />
                </div>
                <div className="text-sm font-medium text-foreground">Drag and drop files here</div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  PDF, DOCX, XLSX up to 25 MB
                </div>
                <div className="mt-4">
                  <Input
                    type="file"
                    multiple
                    className="hidden"
                    id="file-upload"
                    onChange={(e) => {
                      if (e.target.files) handleFiles(Array.from(e.target.files));
                    }}
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => document.getElementById("file-upload")?.click()}
                  >
                    Choose files
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="my-6 flex items-center justify-between gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search documents…"
            className="h-9 pl-8 text-sm"
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No documents yet"
          description="Upload a file to get started."
        />
      ) : (
        <Card className="border-border/60 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="w-[300px]">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="-ml-3 h-8 data-[state=open]:bg-accent"
                    onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
                  >
                    Name
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                  </Button>
                </TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Size</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((d) => (
                <TableRow key={d.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <span className="truncate">{d.name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{d.type}</TableCell>
                  <TableCell className="text-muted-foreground">{d.size}</TableCell>
                  <TableCell className="text-muted-foreground">{d.uploadedAt}</TableCell>
                  <TableCell>
                    <StatusBadge status={d.status} />
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
