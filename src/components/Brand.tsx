import { Link } from "@tanstack/react-router";
import logo from "@/assets/poshanscan_logo.png";

export function Brand({ light = false }: { light?: boolean }) {
  return (
    <Link
      to="/"
      className={`inline-flex items-center gap-2.5 ${light ? "text-primary-foreground" : "text-foreground"}`}
    >
      <img src={logo} alt="PoshanScan" className="h-16 w-16 object-contain" />
    </Link>
  );
}
