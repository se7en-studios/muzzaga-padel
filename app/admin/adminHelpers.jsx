import {
  ClipboardList,
  Phone,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  TriangleAlert,
  X,
} from "lucide-react";
import {
  businessDayInClub,
  JORNADA_CUTOFF,
  todayInClub,
} from "../../lib/booking";
import { formatDate } from "../../lib/format";

// Iconos y helpers compartidos entre las vistas del admin. Vivían todos
// inline en page.js; con 6 vistas ahora, cada una los necesita por separado.

export const PAYMENT_METHODS = [
  { value: "efectivo", label: "Efectivo" },
  { value: "transferencia", label: "Transferencia" },
  { value: "mercadopago", label: "Mercado Pago" },
];

export {
  paidAmount,
  pendingAmount,
  buildReminderMessage,
  buildDepositRequestMessage,
  buildConfirmationMessage,
} from "../../lib/adminMessages";

/**
 * Si la cookie venció mientras el panel estaba abierto, los actions
 * devuelven el error de sesión: en ese caso hay que volver al login en vez
 * de dejar la vista con datos viejos y botones que no hacen nada.
 * @returns {boolean} true si la sesión se cayó y ya se manejó.
 */
export function isExpiredSessionError(res) {
  return Boolean(res?.error?.startsWith("Sesión expirada"));
}

// Íconos del admin: lucide-react con trazo 1.75. Se mantienen los nombres
// viejos (IconPlus, IconTrash…) para no tocar cada vista.
const lucide = (Icon, defaultSize) =>
  function AdminIcon({ size = defaultSize }) {
    return <Icon size={size} strokeWidth={1.75} aria-hidden />;
  };

export const IconRefresh = lucide(RefreshCw, 14);
export const IconClipboard = lucide(ClipboardList, 14);
export const IconPlus = lucide(Plus, 14);
export const IconClose = lucide(X, 14);
export const IconTrash = lucide(Trash2, 14);
export const IconPhone = lucide(Phone, 12);
export const IconSearch = lucide(Search, 14);
export const IconAlert = lucide(TriangleAlert, 12);

export function WhatsAppMiniIcon({ size = 13 }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor">
      <path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.816 9.816 0 0 0 12.04 2zm.01 1.67c2.2 0 4.26.86 5.82 2.41a8.214 8.214 0 0 1 2.41 5.83c0 4.54-3.7 8.24-8.24 8.24-1.48 0-2.93-.4-4.2-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.19 8.19 0 0 1-1.26-4.38c0-4.54 3.7-8.24 8.24-8.24zm4.52 11.66c-.25-.13-1.47-.72-1.7-.81-.23-.08-.39-.13-.56.13-.17.25-.64.81-.79.97-.14.17-.29.19-.54.06-.25-.13-1.06-.39-2.01-1.24-.75-.67-1.25-1.5-1.4-1.75-.15-.25-.02-.39.11-.51.11-.11.25-.29.37-.44.13-.14.17-.25.25-.42.08-.17.04-.31-.02-.44-.06-.13-.56-1.34-.76-1.84-.2-.49-.4-.42-.56-.43h-.48c-.17 0-.44.06-.67.31-.23.25-.87.85-.87 2.07 0 1.22.89 2.4 1.01 2.57.13.17 1.75 2.67 4.24 3.74.59.26 1.05.41 1.41.53.6.19 1.14.16 1.57.1.48-.07 1.47-.6 1.68-1.18.21-.58.21-1.07.15-1.18-.07-.1-.23-.17-.48-.29z" />
    </svg>
  );
}

/**
 * Pasada la medianoche y hasta las 06:00 se sigue anotando en la jornada de
 * la noche anterior. Este aviso lo deja claro donde se registran ventas.
 * Solo aparece en esa franja y mirando la jornada actual.
 */
export function JornadaNote({ date }) {
  const jornada = businessDayInClub();
  if (jornada === todayInClub() || date !== jornada) return null;
  return (
    <p className="admin-field-hint admin-jornada-note" role="status">
      🌙 Después de medianoche sigue la jornada del{" "}
      <strong>{formatDate(jornada, "long")}</strong>: lo que anotes ahora va a
      la caja de esa noche (hasta las {JORNADA_CUTOFF}).
    </p>
  );
}
