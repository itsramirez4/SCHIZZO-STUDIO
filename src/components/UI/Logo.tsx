import logoBlanco from '@/assets/logo/logo-blanco.png';
import logoNegro from '@/assets/logo/logo-negro.png';

/** The SCHIZZO STUDIO mark. Renders both variants and lets CSS (globals.css) show whichever
 * contrasts with the current theme, so it never needs to know which theme is active. */
export default function Logo({ size = 24, className = '' }: { size?: number; className?: string }) {
  const style = { width: size, height: size };
  return (
    <>
      <img src={logoBlanco} alt="SCHIZZO STUDIO" draggable={false} style={style} className={`logo-on-dark shrink-0 select-none ${className}`} />
      <img src={logoNegro} alt="SCHIZZO STUDIO" draggable={false} style={style} className={`logo-on-light shrink-0 select-none ${className}`} />
    </>
  );
}
