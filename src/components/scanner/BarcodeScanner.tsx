import { useEffect, useRef, useState } from "react";
import {
  Html5Qrcode,
  Html5QrcodeSupportedFormats,
} from "html5-qrcode";
import { X, ScanLine, AlertCircle, Flashlight, FlashlightOff } from "lucide-react";
import { Button } from "@/components/ui/button";

interface BarcodeScannerProps {
  open: boolean;
  onClose: () => void;
  onDetected: (code: string) => void;
}

const REGION_ID = "barcode-scanner-region";

type TorchScanner = Html5Qrcode & {
  applyVideoConstraints?: (
    constraints: MediaTrackConstraints & {
      advanced?: Array<MediaTrackConstraintSet & { torch?: boolean }>;
    }
  ) => Promise<void>;
};

type TorchCapabilities = MediaTrackCapabilities & {
  torch?: boolean;
};

type TorchCapabilitiesReader = {
  getRunningTrackCapabilities?: () => TorchCapabilities;
};

function getTorchCapabilities(scanner: Html5Qrcode) {
  return (scanner as unknown as TorchCapabilitiesReader).getRunningTrackCapabilities?.();
}

export function BarcodeScanner({
  open,
  onClose,
  onDetected,
}: BarcodeScannerProps) {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const detectedRef = useRef(false);
  const mountedRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [torchAvailable, setTorchAvailable] = useState(false);
  const [torchOn, setTorchOn] = useState(false);

  useEffect(() => {
    if (!open) return;

    mountedRef.current = true;
    detectedRef.current = false;
    setError(null);
    setSuccess(false);
    setTorchAvailable(false);
    setTorchOn(false);

    const applyTorch = async (enabled: boolean) => {
      const scanner = scannerRef.current;
      if (!scanner) return false;

      try {
        const torchScanner = scanner as TorchScanner;
        const capabilities = getTorchCapabilities(scanner);
        if (!capabilities?.torch) return false;

        await torchScanner.applyVideoConstraints?.({
          advanced: [{ torch: enabled }],
        });

        if (mountedRef.current) {
          setTorchAvailable(true);
          setTorchOn(enabled);
        }

        return true;
      } catch {
        return false;
      }
    };

    const stopScanner = async () => {
      const scanner = scannerRef.current;
      scannerRef.current = null;

      if (!scanner) return;

      try {
        await (scanner as TorchScanner).applyVideoConstraints?.({
          advanced: [{ torch: false }],
        });
      } catch {
        void 0;
      }

      try {
        await scanner.stop();
      } catch {
        void 0;
      }

      try {
        await scanner.clear();
      } catch {
        void 0;
      }
    };

    const start = async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          setError("Seu navegador não liberou acesso à câmera neste site.");
          return;
        }

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

        const cameras = await Html5Qrcode.getCameras();

        if (!cameras || cameras.length === 0) {
          if (mountedRef.current) setError("Nenhuma câmera encontrada.");
          return;
        }

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

        await html5.start(
          backCamera.id,
          {
            fps: 10,
            qrbox: (vw, vh) => {
              const width = Math.min(Math.floor(vw * 0.86), 420);
              const height = Math.min(Math.floor(vh * 0.22), 140);
              return {
                width,
                height: Math.max(height, 96),
              };
            },
          },
          async (decodedText) => {
            if (detectedRef.current) return;
            detectedRef.current = true;

            if (mountedRef.current) setSuccess(true);

            try {
              navigator.vibrate?.(120);
            } catch {
              void 0;
            }

            await stopScanner();
            onDetected(decodedText.trim());

            setTimeout(() => {
              if (mountedRef.current) onClose();
            }, 250);
          },
          () => {
            void 0;
          }
        );

        const capabilities = getTorchCapabilities(html5);
        if (capabilities?.torch && mountedRef.current) {
          setTorchAvailable(true);
          setTimeout(() => {
            if (mountedRef.current) void applyTorch(true);
          }, 300);
        }
      } catch (e: unknown) {
        console.error(e);
        if (!mountedRef.current) return;

        const error = e instanceof Error ? e : null;
        if (
          error?.message?.includes("Permission") ||
          error?.name === "NotAllowedError"
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

    const timeout = setTimeout(start, 100);

    return () => {
      mountedRef.current = false;
      clearTimeout(timeout);
      void stopScanner();
    };
  }, [open, onClose, onDetected]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/95 flex flex-col">
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

      <div className="flex-1 overflow-y-auto p-4">
        <div
          id={REGION_ID}
          className="mx-auto w-full max-w-md overflow-hidden rounded-xl bg-black text-white"
        />

        {success && (
          <div className="mx-auto mt-3 max-w-md rounded-lg bg-success/20 p-3 text-center text-sm text-white">
            Código detectado
          </div>
        )}

        {error && (
          <div className="mx-auto mt-3 max-w-md rounded-lg bg-destructive/95 text-destructive-foreground p-3 flex items-start gap-2 text-sm">
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </div>

      <div className="p-4 flex flex-col items-center gap-3 text-white">
        <p className="text-sm text-white/70 text-center">
          Aponte a câmera para o código de barras
        </p>

        {torchAvailable && (
          <Button
            type="button"
            variant="outline"
            onClick={async () => {
              const scanner = scannerRef.current;
              if (!scanner) return;
              try {
                await (scanner as TorchScanner).applyVideoConstraints?.({
                  advanced: [{ torch: !torchOn }],
                });
                setTorchOn((current) => !current);
              } catch {
                setTorchAvailable(false);
              }
            }}
            className="w-full max-w-xs gap-2 border-white/20 bg-white/10 text-white hover:bg-white/20 hover:text-white"
          >
            {torchOn ? (
              <FlashlightOff className="h-4 w-4" />
            ) : (
              <Flashlight className="h-4 w-4" />
            )}
            {torchOn ? "Desligar lanterna" : "Ligar lanterna"}
          </Button>
        )}

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
