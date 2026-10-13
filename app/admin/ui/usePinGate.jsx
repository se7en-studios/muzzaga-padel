"use client";

import { useState } from "react";
import StaffPinModal from "./StaffPinModal";

/**
 * Pide el PIN del equipo antes de una acción sensible y la ejecuta con él.
 *
 *   const { ask, pinModal } = usePinGate();
 *   ask({ title: "Borrar cobro" }, ({ pin }) => adminRemovePayment(id, pid, pin));
 *   ...
 *   return <>{pinModal}</>;
 *
 * `run` recibe { pin, reason } y devuelve la respuesta del server: si trae
 * ok:false, el modal muestra el error y sigue abierto (el PIN se vuelve a
 * pedir). Si sale bien, se cierra y `ask` resuelve con la respuesta.
 */
export function usePinGate() {
  const [pending, setPending] = useState(null);

  function ask(options, run) {
    return new Promise((resolve) => {
      setPending({ options, run, resolve });
    });
  }

  function close() {
    pending?.resolve(null);
    setPending(null);
  }

  const pinModal = pending ? (
    <StaffPinModal
      isOpen
      confirmButtonTone="primary"
      {...pending.options}
      onClose={close}
      onConfirm={async (input) => {
        const res = await pending.run(input);
        if (res?.ok === false) {
          throw new Error(res.error || "No se pudo completar la acción.");
        }
        pending.resolve(res);
        setPending(null);
      }}
    />
  ) : null;

  return { ask, pinModal };
}
