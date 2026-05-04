import { useEffect, useRef, useState } from "react";
import {
  Html5Qrcode,
  Html5QrcodeSupportedFormats,
} from "html5-qrcode";
import { X, ScanLine, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface BarcodeScannerProps {
  open: boolean;
  onClose: () => void;
  onDetected: (code: string) => void;
}

const REGION_ID = "barcode-scanner-region";

export function BarcodeScanner({
  open,
  onClose,
  onDetected,
}: BarcodeScannerProps) {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!open) return;

    setError(null);
    setSuccess(false);

    const start = async () => {
      try {
        /**
         * Força o navegador a pedir permissão da câmera
         */
        await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: "environment",
          },
        });

        /**
         * Cria o scanner
         */
        const html5 = new Html5Qrcode(REGION_ID, {
          formatsToSupport: [
            Html5QrcodeSupportedFormats.EAN_13,
            Html5QrcodeSupportedFormats.EAN_8,
            Html5QrcodeSupportedFormats.UPC_A,
            Html5QrcodeSupportedFormats.UPC_E,
            Html5QrcodeSupportedFormats.CODE_128,
            Html5QrcodeSupportedFormats.CODE_39,
            Html5QrcodeSupportedFormats.CODE_93,
            Html5QrcodeSupportedFormats.ITF,
            Html5QrcodeSupportedFormats.QR_CODE,
          ],
          verbose: false,
        });

        scannerRef.current = html5;

        /**
         * Busca todas as câmeras disponíveis
         */
        const cameras = await Html5Qrcode.getCameras();

        if (!cameras || cameras.length === 0) {
          setError("Nenhuma câmera encontrada.");
          return;
        }

        /**
         * Tenta encontrar a câmera traseira
         */
        const backCamera =
          cameras.find((camera) => {
            const label = camera.label.toLowerCase();

            return (
              label.includes("back") ||
              label.includes("rear") ||
              label.includes("traseira") ||
              label.includes("environment")
            );
          }) || cameras[cameras.length - 1];

        /**
         * Inicia scanner com a câmera traseira
         */
        await html5.start(
          backCamera.id,
          {
            fps: 10,
            qrbox: (vw, vh) => {
              const minEdge = Math.min(vw, vh);

              return {
                width: Math.floor(minEdge * 0.8),
                height: Math.floor(minEdge * 0.5),
              };
            },
            aspectRatio: 1.7778,
          },
          (decodedText) => {
            setSuccess(true);

            try {
              (navigator as any).vibrate?.(120);
            } catch {}

            html5
              .stop()
              .then(() => html5.clear())
              .catch(() => {});

            onDetected(decodedText);

            setTimeout(() => {
              onClose();
            }, 250);
          },
          () => {
            /**
             * Ignora erros contínuos de leitura
             */
          }
        );
      } catch (e: any) {
        console.error(e);

        if (
          e?.message?.includes("Permission") ||
          e?.name === "NotAllowedError"
        ) {
          setError(
            "Permissão da câmera negada. Autorize o acesso nas configurações do navegador."
          );
        } else {
          setError(
            "Não foi possível iniciar a câmera. Verifique as permissões e tente novamente."
          );
        }
      }
    };

    /**
     * Pequeno delay para garantir que o DOM já foi montado
     */
    const timeout = setTimeout(start, 100);

    return () => {
      clearTimeout(timeout);

      const scanner = scannerRef.current;

      if (scanner) {
        scanner
          .stop()
          .then(() => scanner.clear())
          .catch(() => {});

        scannerRef.current = null;
      }
    };
  }, [open, onClose, onDetected]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/95 flex flex-col">
      {/* Topo */}
      <div className="flex items-center justify-between p-4 text-white">
        <div className="flex items-center gap-2">
          <ScanLine className="h-5 w-5" />
          <span className="font-medium">
            Escanear código de barras
          </span>
        </div>

        <button
          onClick={onClose}
          className="rounded-full p-2 hover:bg-white/10 transition"
          aria-label="Fechar scanner"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Área da câmera */}
      <div className="flex-1 relative overflow-hidden">
        <div
          id={REGION_ID}
          className="
            absolute inset-0
            [&_video]:!object-cover
            [&_video]:!w-full
            [&_video]:!h-full
          "
        />

        {/* Overlay de mira */}
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div
            className={`relative w-[80%] max-w-md aspect-[16/10] rounded-2xl border-2 transition-colors ${
              success ? "border-success" : "border-white/80"
            }`}
          >
            {/* Linha animada */}
            <div className="absolute inset-x-6 top-1/2 h-0.5 bg-success/80 animate-pulse" />

            {/* Cantos */}
            <span className="absolute -top-3 -left-3 w-6 h-6 border-t-4 border-l-4 border-primary rounded-tl-xl" />
            <span className="absolute -top-3 -right-3 w-6 h-6 border-t-4 border-r-4 border-primary rounded-tr-xl" />
            <span className="absolute -bottom-3 -left-3 w-6 h-6 border-b-4 border-l-4 border-primary rounded-bl-xl" />
            <span className="absolute -bottom-3 -right-3 w-6 h-6 border-b-4 border-r-4 border-primary rounded-br-xl" />
          </div>
        </div>

        {/* Erro */}
        {error && (
          <div className="absolute inset-x-4 top-4 rounded-lg bg-destructive/95 text-destructive-foreground p-3 flex items-start gap-2 text-sm">
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </div>

      {/* Rodapé */}
      <div className="p-4 flex flex-col items-center gap-3 text-white">
        <p className="text-sm text-white/70 text-center">
          Centralize o código de barras dentro da área marcada
        </p>

        <Button
          variant="secondary"
          onClick={onClose}
          className="w-full max-w-xs"
        >
          Cancelar
        </Button>
      </div>
    </div>
  );
}