import logoUrl from "@/assets/anamedis-logo.png";
import iconUrl from "@/assets/anamedis-icon.png";

type Props =
  | { variant: "completo"; height?: number; className?: string }
  | { variant: "icone"; height?: number; className?: string }
  | { variant: "escuro"; className?: string; label?: string };

/** Marca Anamedis. As imagens têm fundo transparente: "completo" e "icone" ficam bem sobre superfície clara;
 * "escuro" (barra lateral, hero) põe o ícone num círculo branco ao lado do texto. */
export function Logo(props: Props) {
  if (props.variant === "completo") {
    const h = props.height ?? 32;
    return <img src={logoUrl} alt="Anamedis" height={h} style={{ height: h, width: "auto" }} className={props.className} />;
  }
  if (props.variant === "icone") {
    const h = props.height ?? 36;
    return <img src={iconUrl} alt="Anamedis" width={h} height={h} style={{ height: h, width: h }} className={props.className} />;
  }
  return (
    <span className={`flex items-center gap-2 ${props.className ?? ""}`}>
      <span className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-full bg-white p-1.5">
        <img src={iconUrl} alt="Anamedis" width={32} height={32} className="h-full w-full object-contain" />
      </span>
      <span aria-hidden className="font-display text-2xl font-extrabold tracking-tight">
        <span className="text-primary-foreground">ana</span><span className="text-brand-teal-soft">medis</span>
      </span>
      {props.label && <span className="font-display text-sm font-bold text-sidebar-foreground">{props.label}</span>}
    </span>
  );
}
