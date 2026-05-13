import { useCallback, useState } from "react";
import { ScanLine } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useIsMobileOrTablet } from "@/hooks/use-mobile-or-tablet";
import { BarcodeScanner } from "./BarcodeScanner";

interface BarcodeInputProps {
  value: string;
  onChange: (v: string) => void;
  label?: string;
  placeholder?: string;
  autoFocus?: boolean;
}

export function BarcodeInput({
  value,
  onChange,
  label = "Código de barras",
  placeholder = "Digite ou escaneie o código",
  autoFocus,
}: BarcodeInputProps) {
  const isMobile = useIsMobileOrTablet();
  const [open, setOpen] = useState(false);
  const closeScanner = useCallback(() => setOpen(false), []);
  const handleDetected = useCallback(
    (code: string) => {
      onChange(code.trim());
    },
    [onChange],
  );

  return (
    <div className="space-y-2">
      {label && <Label>{label}</Label>}
      <div className="flex gap-2">
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoFocus={autoFocus}
          inputMode="numeric"
          className="font-mono"
        />
        {isMobile && (
          <Button
            type="button"
            onClick={() => setOpen(true)}
            className="shrink-0 gap-2"
          >
            <ScanLine className="h-4 w-4" />
            Escanear
          </Button>
        )}
      </div>
      <BarcodeScanner
        open={open}
        onClose={closeScanner}
        onDetected={handleDetected}
      />
    </div>
  );
}
