import { useEffect, useState } from "react";

/**
 * Detecta mobile e tablet (largura ≤ 1024 OU user-agent móvel).
 * Usado para mostrar o botão de scanner apenas em dispositivos com câmera prática.
 */
export function useIsMobileOrTablet(): boolean {
  const [is, setIs] = useState(false);

  useEffect(() => {
    const check = () => {
      const ua = navigator.userAgent || "";
      const uaMobile = /Android|iPhone|iPad|iPod|Mobile|Tablet/i.test(ua);
      const narrow = window.innerWidth <= 1024;
      const touch = "ontouchstart" in window || navigator.maxTouchPoints > 0;
      setIs(uaMobile || (narrow && touch));
    };
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  return is;
}
