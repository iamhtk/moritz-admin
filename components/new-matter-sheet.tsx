"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useOverview } from "@/hooks/use-overview";
import type { Channel, ServiceLine } from "@/lib/supabase";
import { useSheetSide } from "@/hooks/use-sheet-side";
import { SheetHandle } from "@/components/sheet-handle";
import { cn } from "cn";

const SERVICE_LINES: ServiceLine[] = [
  "Commercial",
  "Corporate",
  "Privacy",
  "Employment",
  "Real estate",
  "Litigation",
];

const CHANNELS: { value: Channel; label: string }[] = [
  { value: "email", label: "Email" },
  { value: "slack", label: "Slack" },
  { value: "platform", label: "Platform" },
];

const TYPE_PLACEHOLDERS: Record<ServiceLine, string> = {
  Commercial: "NDA",
  Corporate: "Term sheet",
  Privacy: "DPA",
  Employment: "Offer letter",
  "Real estate": "Lease",
  Litigation: "Discovery request",
};

const NEW_CLIENT = "__new__";

function RequiredMark() {
  return (
    <span className="text-destructive" aria-hidden>
      *
    </span>
  );
}

export function NewMatterSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { data } = useOverview();
  const qc = useQueryClient();
  const clients = data?.clients ?? [];

  const [clientId, setClientId] = useState("");
  const [newClientName, setNewClientName] = useState("");
  const [serviceLine, setServiceLine] = useState<ServiceLine>("Commercial");
  const [type, setType] = useState("");
  const [channel, setChannel] = useState<Channel>("platform");
  const [fee, setFee] = useState("");
  const [pending, setPending] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const formKey = open ? "open" : "closed";
  const [prevFormKey, setPrevFormKey] = useState(formKey);
  if (formKey !== prevFormKey) {
    setPrevFormKey(formKey);
    if (open) {
      setClientId("");
      setNewClientName("");
      setServiceLine("Commercial");
      setType("");
      setChannel("platform");
      setFee("");
      setPending(false);
      setAttempted(false);
    }
  }

  const clientOk =
    clientId === NEW_CLIENT ? newClientName.trim().length > 0 : !!clientId;
  const typeOk = type.trim().length > 0;
  const canSubmit = clientOk && !!serviceLine && typeOk && !!channel;
  const side = useSheetSide();

  const missing: string[] = [];
  if (!clientOk) missing.push("client");
  if (!typeOk) missing.push("matter type");

  async function createMatter() {
    setAttempted(true);
    if (!canSubmit || pending) return;
    setPending(true);
    try {
      const res = await fetch("/api/matters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: clientId === NEW_CLIENT ? null : clientId,
          newClientName:
            clientId === NEW_CLIENT ? newClientName.trim() : undefined,
          serviceLine,
          type: type.trim(),
          channel,
          fee: fee === "" ? 0 : Number(fee),
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body.error ?? "Could not create the matter.");
      }
      toast.success(`${body.matter.reference} created.`);
      await qc.invalidateQueries({ queryKey: ["overview"] });
      await qc.invalidateQueries({ queryKey: ["matters-all"] });
      onOpenChange(false);
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Could not create the matter."
      );
    } finally {
      setPending(false);
    }
  }

  const fieldClass = "h-9 data-[size=default]:h-9";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={side}
        className={cn(
          "gap-0 p-0",
          side === "right" && "h-full w-full sm:max-w-[420px]",
          side === "bottom" && "h-[85vh] max-h-[85vh] w-full"
        )}
      >
        <SheetHandle visible={side === "bottom"} />
        <SheetHeader className="border-b border-border px-5 py-4">
          <SheetTitle style={{ fontSize: "var(--text-14)" }}>
            New matter
          </SheetTitle>
          <SheetDescription
            className="text-text-secondary"
            style={{ fontSize: "var(--text-12)" }}
          >
            Intake a matter. Required fields are marked.
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-5 py-4">
          <div className="space-y-2">
            <label
              htmlFor="matter-client"
              className="font-medium text-foreground"
              style={{ fontSize: "var(--text-12)" }}
            >
              Client <RequiredMark />
            </label>
            <Select value={clientId} onValueChange={setClientId}>
              <SelectTrigger
                id="matter-client"
                className={cn("w-full", fieldClass)}
                aria-required
              >
                <SelectValue placeholder="Select a client" />
              </SelectTrigger>
              <SelectContent>
                {clients.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.company}
                  </SelectItem>
                ))}
                <SelectItem value={NEW_CLIENT}>New client</SelectItem>
              </SelectContent>
            </Select>
            {clientId === NEW_CLIENT ? (
              <Input
                value={newClientName}
                onChange={(e) => setNewClientName(e.target.value)}
                placeholder="Company name"
                aria-label="New client name"
                aria-required
                className={fieldClass}
              />
            ) : null}
          </div>

          <div className="space-y-2">
            <label
              htmlFor="matter-line"
              className="font-medium text-foreground"
              style={{ fontSize: "var(--text-12)" }}
            >
              Service line <RequiredMark />
            </label>
            <Select
              value={serviceLine}
              onValueChange={(v) => setServiceLine(v as ServiceLine)}
            >
              <SelectTrigger
                id="matter-line"
                className={cn("w-full", fieldClass)}
                aria-required
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SERVICE_LINES.map((line) => (
                  <SelectItem key={line} value={line}>
                    {line}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label
              htmlFor="matter-type"
              className="font-medium text-foreground"
              style={{ fontSize: "var(--text-12)" }}
            >
              Matter type <RequiredMark />
            </label>
            <Input
              id="matter-type"
              value={type}
              onChange={(e) => setType(e.target.value)}
              placeholder={TYPE_PLACEHOLDERS[serviceLine]}
              aria-required
              className={fieldClass}
            />
          </div>

          <div className="space-y-2">
            <label
              htmlFor="matter-channel"
              className="font-medium text-foreground"
              style={{ fontSize: "var(--text-12)" }}
            >
              Channel <RequiredMark />
            </label>
            <Select
              value={channel}
              onValueChange={(v) => setChannel(v as Channel)}
            >
              <SelectTrigger
                id="matter-channel"
                className={cn("w-full", fieldClass)}
                aria-required
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CHANNELS.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label
              htmlFor="matter-fee"
              className="font-medium text-foreground"
              style={{ fontSize: "var(--text-12)" }}
            >
              Fee
            </label>
            <div className="flex h-9 items-stretch overflow-hidden rounded-lg border border-input focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50">
              <span
                className="flex items-center border-r border-input bg-muted/50 px-3 font-medium text-foreground"
                style={{ fontSize: "var(--text-13)" }}
                aria-hidden
              >
                $
              </span>
              <Input
                id="matter-fee"
                type="number"
                min={0}
                step={1}
                value={fee}
                onChange={(e) => setFee(e.target.value)}
                className="num h-full min-h-0 flex-1 rounded-none border-0 shadow-none focus-visible:ring-0"
                placeholder="Optional"
              />
            </div>
            <p
              className="text-text-secondary"
              style={{ fontSize: "var(--text-11)" }}
            >
              Leave blank to quote later. Unquoted matters cannot start.
            </p>
          </div>
        </div>

        <SheetFooter className="flex-col-reverse gap-2 border-t border-border px-5 py-3 sm:flex-row sm:justify-end">
          {!canSubmit && attempted ? (
            <p
              className="w-full text-text-secondary sm:order-first sm:mr-auto sm:w-auto"
              style={{ fontSize: "var(--text-11)" }}
              role="status"
            >
              Add {missing.join(" and ")} to continue.
            </p>
          ) : !canSubmit ? (
            <p
              className="w-full text-text-tertiary sm:order-first sm:mr-auto sm:w-auto"
              style={{ fontSize: "var(--text-11)" }}
            >
              Client and matter type required.
            </p>
          ) : null}
          <Button
            type="button"
            variant="ghost"
            className="h-11 w-full sm:h-9 sm:w-auto"
            disabled={pending}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            className="h-11 w-full sm:h-9 sm:w-auto"
            disabled={pending}
            onClick={() => createMatter()}
          >
            {pending ? (
              <>
                <Loader2 className="size-3.5 animate-spin" />
                Create matter
              </>
            ) : (
              "Create matter"
            )}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
