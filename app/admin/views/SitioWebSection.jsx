"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import {
  ArrowDown,
  ArrowUp,
  ImagePlus,
  Images,
  LoaderCircle,
  MapPin,
  RotateCcw,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import {
  adminAddGalleryPhoto,
  adminDeleteGalleryTournament,
  adminGetSiteContent,
  adminMoveGalleryTournament,
  adminRemoveGalleryPhoto,
  adminResetSiteLocation,
  adminResetSitePhoto,
  adminSaveGalleryTournament,
  adminSetGalleryPhotoLabel,
  adminSetSitePhoto,
  adminSetSiteLocation,
  adminSetSitePhotoCaption,
} from "../actions";
import { CAPTION_MAX, NAME_MAX, PHOTO_GROUPS } from "../../../lib/siteContent";
import {
  LOCALITY_MAX,
  STREET_MAX,
  parseCoords,
  presentLocation,
} from "../../../lib/siteLocation";
import { compressImage } from "../../../lib/compressImage";
import { plural } from "../../../lib/format";
import { Skeleton } from "../ui/states";
import { usePinGate } from "../ui/usePinGate";

const ICON = { size: 18, strokeWidth: 1.75, "aria-hidden": true };
const SMALL = { size: 14, strokeWidth: 1.75, "aria-hidden": true };

/** Botón que abre el selector de archivos (en el celu ofrece cámara o galería). */
function FilePicker({
  multiple = false,
  disabled,
  onFiles,
  className = "btn btn-secondary",
  label,
  children,
}) {
  const ref = useRef(null);
  return (
    <>
      <button
        type="button"
        className={className}
        disabled={disabled}
        aria-label={label}
        onClick={() => ref.current?.click()}
      >
        {children}
      </button>
      <input
        ref={ref}
        type="file"
        accept="image/*"
        multiple={multiple}
        hidden
        onChange={(e) => {
          const files = [...e.target.files];
          e.target.value = "";
          if (files.length) onFiles(files);
        }}
      />
    </>
  );
}

function BusyBadge({ text }) {
  return (
    <span className="admin-site-busy" role="status">
      <LoaderCircle {...SMALL} className="admin-site-spin" />
      {text}
    </span>
  );
}

/** Un lugar fijo de la landing: portada, una tarjeta de Instalaciones, etc. */
function PhotoSlot({
  slot,
  photo,
  aspect,
  captioned,
  busyText,
  disabled,
  canUpload,
  onPick,
  onReset,
  onCaption,
}) {
  const saved = photo.caption ?? "";
  const [caption, setCaption] = useState(saved);
  useEffect(() => setCaption(saved), [saved]);

  return (
    <li className="admin-site-slot">
      <div className="admin-site-thumb" style={{ aspectRatio: aspect }}>
        <Image src={photo.src} alt="" fill sizes="(max-width: 767px) 45vw, 220px" />
        <span className={`admin-site-tag${photo.custom ? " is-custom" : ""}`}>
          {photo.custom ? "Subida por el club" : "Original"}
        </span>
        {busyText && <BusyBadge text={busyText} />}
      </div>
      <div className="admin-site-slot-body">
        <strong className="admin-site-slot-label">{slot.label}</strong>
        {captioned && (
          <form
            className="admin-site-caption"
            onSubmit={(e) => {
              e.preventDefault();
              onCaption(caption);
            }}
          >
            <input
              type="text"
              aria-label={`Texto sobre la foto (${slot.label})`}
              maxLength={CAPTION_MAX}
              placeholder="Sin texto"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
            />
            {caption.trim() !== saved && (
              <button type="submit" className="btn btn-secondary" disabled={disabled}>
                Guardar
              </button>
            )}
          </form>
        )}
        <div className="admin-site-actions">
          <FilePicker disabled={disabled || !canUpload} onFiles={(files) => onPick(files[0])}>
            <Upload {...SMALL} /> Cambiar foto
          </FilePicker>
          {photo.custom && (
            <button
              type="button"
              className="btn btn-secondary"
              disabled={disabled}
              onClick={onReset}
              title="Volver a la foto original"
            >
              <RotateCcw {...SMALL} /> Original
            </button>
          )}
        </div>
      </div>
    </li>
  );
}

/** Texto de una foto de ganadores: se guarda al salir del campo o con Enter. */
function WinnerLabel({ photo, disabled, onSave }) {
  const [value, setValue] = useState(photo.label || "");
  useEffect(() => setValue(photo.label || ""), [photo.label]);
  const commit = () => {
    if (value.trim() !== (photo.label || "")) onSave(value);
  };
  return (
    <input
      type="text"
      className="admin-site-winner-label"
      aria-label="Texto sobre la foto de ganadores"
      maxLength={CAPTION_MAX}
      placeholder="ej. 1er puesto Damas"
      value={value}
      disabled={disabled}
      onChange={(e) => setValue(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          e.currentTarget.blur();
        }
      }}
    />
  );
}

function GalleryPhotos({
  kind,
  photos,
  busyText,
  disabled,
  canUpload,
  onAdd,
  onRemove,
  onLabel,
}) {
  const isWinners = kind === "ganadores";
  return (
    <div className="admin-site-photos-block">
      <h5 className="admin-site-subtitle">
        {isWinners ? "Ganadores" : "Jugadores"}
        <span>{plural(photos.length, "foto", "fotos")}</span>
      </h5>
      <ul className={`admin-site-photos${isWinners ? " is-winners" : ""}`}>
        {photos.map((p, i) => (
          <li key={p.id}>
            <div className="admin-site-photo">
              <Image src={p.src} alt="" fill sizes="120px" />
              <button
                type="button"
                className="admin-site-remove"
                disabled={disabled}
                onClick={() => onRemove(p)}
                aria-label={
                  isWinners && p.label
                    ? `Quitar foto: ${p.label}`
                    : `Quitar foto ${i + 1} de ${isWinners ? "ganadores" : "jugadores"}`
                }
              >
                <X size={14} strokeWidth={2} aria-hidden />
              </button>
            </div>
            {isWinners && (
              <WinnerLabel photo={p} disabled={disabled} onSave={(label) => onLabel(p, label)} />
            )}
          </li>
        ))}
        <li>
          <FilePicker
            multiple
            className="admin-site-add"
            disabled={disabled || !canUpload}
            onFiles={onAdd}
            label={`Agregar fotos de ${isWinners ? "ganadores" : "jugadores"}`}
          >
            {busyText ? (
              <>
                <LoaderCircle {...ICON} className="admin-site-spin" />
                <span>{busyText}</span>
              </>
            ) : (
              <>
                <ImagePlus {...ICON} />
                <span>Agregar fotos</span>
              </>
            )}
          </FilePicker>
        </li>
      </ul>
    </div>
  );
}

function TournamentForm({ initial, submitLabel, disabled, onSubmit, onCancel }) {
  const [name, setName] = useState(initial?.name || "");
  const [categories, setCategories] = useState(initial?.categories || "");
  const unchanged =
    initial && name.trim() === initial.name && categories.trim() === initial.categories;
  return (
    <form
      className="admin-site-tournament-form"
      onSubmit={async (e) => {
        e.preventDefault();
        if (await onSubmit({ name, categories })) {
          if (!initial) {
            setName("");
            setCategories("");
          }
        }
      }}
    >
      <div className="admin-field">
        <label className="admin-field-label" htmlFor={`site-t-name-${initial?.id || "new"}`}>
          Nombre del torneo
        </label>
        <input
          id={`site-t-name-${initial?.id || "new"}`}
          type="text"
          maxLength={NAME_MAX}
          placeholder="ej. Torneo Noviembre 2026"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>
      <div className="admin-field">
        <label className="admin-field-label" htmlFor={`site-t-cat-${initial?.id || "new"}`}>
          Categorías (opcional)
        </label>
        <input
          id={`site-t-cat-${initial?.id || "new"}`}
          type="text"
          maxLength={NAME_MAX}
          placeholder="ej. 6ta Damas y Caballeros"
          value={categories}
          onChange={(e) => setCategories(e.target.value)}
        />
      </div>
      <div className="admin-site-form-actions">
        <button
          type="submit"
          className="btn btn-linear-primary"
          disabled={disabled || !name.trim() || unchanged}
        >
          {submitLabel}
        </button>
        {onCancel && (
          <button type="button" className="btn btn-secondary" onClick={onCancel}>
            Cancelar
          </button>
        )}
      </div>
    </form>
  );
}

function GalleryTournament({
  t,
  index,
  total,
  open,
  busy,
  disabled,
  canUpload,
  handlers,
}) {
  const [editing, setEditing] = useState(false);
  const busyFor = (kind) => (busy?.key === `${t.id}:${kind}` ? busy.text : null);
  const count = t.jugadores.length + t.ganadores.length;

  return (
    <details className="admin-site-tournament" open={open || undefined}>
      <summary>
        <span className="admin-site-tournament-name">
          <strong>{t.name}</strong>
          {t.categories && <span> · {t.categories}</span>}
        </span>
        <span className="admin-field-hint">{plural(count, "foto", "fotos")}</span>
      </summary>

      <div className="admin-site-tournament-body">
        {editing ? (
          <TournamentForm
            initial={t}
            submitLabel="Guardar nombre"
            disabled={disabled}
            onSubmit={async (values) => {
              const ok = await handlers.rename(t, values);
              if (ok) setEditing(false);
              return ok;
            }}
            onCancel={() => setEditing(false)}
          />
        ) : (
          <div className="admin-site-tournament-tools">
            <button type="button" className="btn btn-secondary" disabled={disabled} onClick={() => setEditing(true)}>
              Cambiar nombre
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              disabled={disabled || index === 0}
              onClick={() => handlers.move(t, "up")}
              aria-label={`Subir ${t.name}`}
              title="Mostrarlo más arriba en la página"
            >
              <ArrowUp {...SMALL} />
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              disabled={disabled || index === total - 1}
              onClick={() => handlers.move(t, "down")}
              aria-label={`Bajar ${t.name}`}
              title="Mostrarlo más abajo en la página"
            >
              <ArrowDown {...SMALL} />
            </button>
            <button
              type="button"
              className="btn btn-secondary admin-site-danger"
              disabled={disabled}
              onClick={() => handlers.remove(t)}
            >
              <Trash2 {...SMALL} /> Eliminar torneo
            </button>
          </div>
        )}

        {["jugadores", "ganadores"].map((kind) => (
          <GalleryPhotos
            key={kind}
            kind={kind}
            photos={t[kind]}
            busyText={busyFor(kind)}
            disabled={disabled}
            canUpload={canUpload}
            onAdd={(files) => handlers.addPhotos(t, kind, files)}
            onRemove={(photo) => handlers.removePhoto(t, kind, photo)}
            onLabel={(photo, label) => handlers.label(t, photo, label)}
          />
        ))}
      </div>
    </details>
  );
}

const locationFields = (location) => ({
  street: location.street,
  locality: location.locality,
  mapsUrl: location.mapsUrl,
  coords: location.coordsText,
});

/** Dirección y mapa de la sección Ubicación y del footer, por si el club se muda. */
function LocationForm({ location, busyText, disabled, onSave, onReset }) {
  const saved = locationFields(location);
  const [values, setValues] = useState(saved);
  useEffect(() => setValues(locationFields(location)), [location]);
  const field = (key) => ({
    id: `site-loc-${key}`,
    value: values[key],
    onChange: (e) => setValues((v) => ({ ...v, [key]: e.target.value })),
  });

  // Igual que al guardar: sin coordenadas, sirven las del link largo.
  const coords = values.coords.trim()
    ? parseCoords(values.coords)
    : parseCoords(values.mapsUrl);
  const unchanged = Object.keys(saved).every((k) => values[k].trim() === saved[k]);
  const movedPin =
    coords && (coords.lat !== location.lat || coords.lng !== location.lng);
  const staleLink = movedPin && values.mapsUrl.trim() && values.mapsUrl.trim() === saved.mapsUrl;

  return (
    <form
      className="admin-site-location"
      onSubmit={(e) => {
        e.preventDefault();
        onSave(values);
      }}
    >
      <div className="admin-site-location-fields">
        <div className="admin-field">
          <label className="admin-field-label" htmlFor="site-loc-street">
            Dirección
          </label>
          <input
            {...field("street")}
            type="text"
            maxLength={STREET_MAX}
            placeholder="ej. Av. Cacique Catriel y Córdoba"
          />
        </div>
        <div className="admin-field">
          <label className="admin-field-label" htmlFor="site-loc-locality">
            Localidad
          </label>
          <input
            {...field("locality")}
            type="text"
            maxLength={LOCALITY_MAX}
            placeholder="ej. Catriel, Río Negro"
          />
        </div>
        <div className="admin-field">
          <label className="admin-field-label" htmlFor="site-loc-coords">
            Punto en el mapa (coordenadas)
          </label>
          <input
            {...field("coords")}
            type="text"
            inputMode="decimal"
            placeholder="ej. -37.88329, -67.80054"
            aria-describedby="site-loc-coords-hint"
            aria-invalid={coords ? undefined : true}
          />
          <p id="site-loc-coords-hint" className="admin-field-hint">
            {coords
              ? "En Google Maps mantené apretado el lugar exacto (en la compu, clic derecho) y copiá los números que aparecen."
              : "No se entienden las coordenadas: copialas de Google Maps, por ej. -37.88329, -67.80054."}
          </p>
        </div>
        <div className="admin-field">
          <label className="admin-field-label" htmlFor="site-loc-mapsUrl">
            Link de Google Maps (opcional)
          </label>
          <input
            {...field("mapsUrl")}
            type="url"
            inputMode="url"
            placeholder="https://maps.app.goo.gl/…"
            aria-describedby="site-loc-maps-hint"
          />
          <p id="site-loc-maps-hint" className="admin-field-hint">
            {staleLink
              ? "Cambiaste el punto del mapa: actualizá también este link (o borralo) para que \"Cómo llegar\" lleve al lugar nuevo."
              : "El de los botones \"Cómo llegar\". En Google Maps: Compartir → Copiar vínculo. Si lo dejás vacío, abre el punto del mapa."}
          </p>
        </div>
      </div>

      <div className="admin-site-map">
        {coords ? (
          <iframe
            title="Vista previa del mapa"
            src={presentLocation({ ...location, ...coords }).embedUrl}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
        ) : (
          <span className="admin-site-map-empty">
            <MapPin {...ICON} /> Cargá las coordenadas para ver el mapa
          </span>
        )}
        {busyText && <BusyBadge text={busyText} />}
      </div>

      <div className="admin-site-form-actions">
        <button
          type="submit"
          className="btn btn-linear-primary"
          disabled={disabled || unchanged || !coords}
        >
          Guardar ubicación
        </button>
        {location.custom && (
          <button
            type="button"
            className="btn btn-secondary"
            disabled={disabled}
            onClick={onReset}
            title="Volver a Av. Cacique Catriel y Córdoba"
          >
            <RotateCcw {...SMALL} /> Original
          </button>
        )}
      </div>
    </form>
  );
}

const fileFor = (blob) =>
  new File([blob], `foto.${blob.type === "image/webp" ? "webp" : "jpg"}`, {
    type: blob.type,
  });

/**
 * Configuración → Sitio web: las fotos de la landing y la galería de
 * /torneos. A diferencia del resto de Configuración, cada cambio se guarda
 * y se publica en el momento.
 */
export default function SitioWebSection({ onExpiredSession, onToast }) {
  const [content, setContent] = useState(null);
  const [storageReady, setStorageReady] = useState(true);
  const [busy, setBusy] = useState(null); // { key, text } mientras corre algo
  const [openId, setOpenId] = useState(null);
  const { ask, pinModal } = usePinGate();

  useEffect(() => {
    adminGetSiteContent().then((res) => {
      if (res.ok) {
        setContent(res.content);
        setStorageReady(res.storageReady);
      } else {
        onExpiredSession?.(res);
      }
    });
  }, []);

  // Cerrar la pestaña a mitad de una subida la corta.
  useEffect(() => {
    if (!busy) return;
    const warn = (e) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [busy]);

  /** Aplica la respuesta de un action. → true si salió bien. */
  function apply(res, success) {
    if (res?.ok) {
      setContent(res.content);
      if (success) onToast?.(success);
      return true;
    }
    if (!onExpiredSession?.(res)) {
      onToast?.(res?.error || "No se pudo guardar.", { tone: "error" });
    }
    return false;
  }

  /** Corre un action de a uno por vez. → la respuesta si salió bien, si no null. */
  async function run(key, text, call, success) {
    setBusy({ key, text });
    try {
      const res = await call();
      return apply(res, success) ? res : null;
    } catch {
      onToast?.("Se cortó la conexión. Probá de nuevo.", { tone: "error" });
      return null;
    } finally {
      setBusy(null);
    }
  }

  /** Achica y sube de a una; para en el primer error del servidor. */
  async function uploadAll(key, files, send) {
    let uploaded = 0;
    try {
      for (let i = 0; i < files.length; i += 1) {
        const text =
          files.length > 1 ? `Subiendo ${i + 1} de ${files.length}…` : "Subiendo…";
        setBusy({ key, text });
        let blob;
        try {
          blob = await compressImage(files[i]);
        } catch (error) {
          onToast?.(error.message, { tone: "error" });
          continue;
        }
        const res = await send(fileFor(blob));
        if (!apply(res)) break;
        uploaded += 1;
      }
    } catch {
      onToast?.("Se cortó la conexión. Probá de nuevo.", { tone: "error" });
    } finally {
      setBusy(null);
    }
    if (uploaded) {
      onToast?.(uploaded === 1 ? "Foto publicada" : `${uploaded} fotos publicadas`);
    }
  }

  if (!content) {
    return (
      <section id="cfg-sitio" className="admin-settings-card" aria-busy="true">
        <h3 className="admin-section-title">
          <Images {...ICON} /> Sitio web
        </h3>
        <Skeleton height={260} radius={12} />
      </section>
    );
  }

  const disabled = Boolean(busy);

  const gallery = {
    rename: (t, values) =>
      run(
        `${t.id}:name`,
        "Guardando…",
        () => adminSaveGalleryTournament({ id: t.id, ...values }),
        "Nombre actualizado",
      ),
    move: (t, direction) =>
      run(`${t.id}:move`, "Moviendo…", () =>
        adminMoveGalleryTournament(t.id, direction),
      ),
    remove: async (t) => {
      const n = t.jugadores.length + t.ganadores.length;
      const res = await ask(
        {
          title: "Eliminar torneo",
          description: `Se borran "${t.name}" y sus ${plural(n, "foto", "fotos")} de la página de Torneos. No se puede deshacer.`,
          confirmButtonText: "Eliminar",
          confirmButtonTone: "danger",
        },
        ({ pin, reason }) => adminDeleteGalleryTournament(t.id, pin, reason),
      );
      if (res) apply(res, "Torneo eliminado");
    },
    addPhotos: (t, kind, files) =>
      uploadAll(`${t.id}:${kind}`, files, (file) => {
        const fd = new FormData();
        fd.append("tournamentId", t.id);
        fd.append("kind", kind);
        fd.append("file", file);
        return adminAddGalleryPhoto(fd);
      }),
    removePhoto: (t, kind, photo) => {
      if (!confirm("¿Quitar esta foto de la galería? No se puede deshacer.")) {
        return;
      }
      run(
        `${t.id}:${kind}`,
        "Quitando…",
        () =>
          adminRemoveGalleryPhoto({ tournamentId: t.id, kind, photoId: photo.id }),
        "Foto quitada",
      );
    },
    label: (t, photo, label) =>
      run(
        `${t.id}:ganadores`,
        "Guardando…",
        () =>
          adminSetGalleryPhotoLabel({ tournamentId: t.id, photoId: photo.id, label }),
        "Texto guardado",
      ),
  };

  async function addTournament(values) {
    const res = await run(
      "new-tournament",
      "Creando…",
      () => adminSaveGalleryTournament(values),
      "Torneo creado: ahora sumale fotos",
    );
    // El nuevo queda primero: se abre para cargarle las fotos.
    if (res) setOpenId(res.content.gallery[0]?.id ?? null);
    return Boolean(res);
  }

  return (
    <section id="cfg-sitio" className="admin-settings-card">
      <h3 className="admin-section-title">
        <Images {...ICON} /> Sitio web
      </h3>
      <p className="admin-field-hint" style={{ marginTop: 0 }}>
        Las fotos y la ubicación que se ven en la página. Cada cambio se
        publica al toque (no hace falta tocar Guardar): en uno o dos minutos
        ya se ve en la web.
      </p>

      {!storageReady && (
        <div className="admin-callout admin-site-notice" role="alert">
          Todavía no se pueden subir fotos: falta conectar el almacenamiento
          (Vercel Blob) al proyecto en Vercel. Lo demás de esta sección ya
          funciona.
        </div>
      )}

      <div className="admin-site-group">
        <h4 className="admin-site-group-title">Ubicación</h4>
        <p className="admin-field-hint">
          La dirección y el mapa de la sección &quot;Ubicación y horarios&quot; del
          inicio y del pie de todas las páginas. Si el club se muda, cambiala acá.
        </p>
        <LocationForm
          location={content.location}
          busyText={busy?.key === "location" ? busy.text : null}
          disabled={disabled}
          onSave={(values) =>
            run("location", "Guardando…", () => adminSetSiteLocation(values), "Ubicación publicada")
          }
          onReset={() => {
            if (!confirm("¿Volver a la dirección y el mapa originales?")) return;
            run(
              "location",
              "Restaurando…",
              () => adminResetSiteLocation(),
              "Volvió la ubicación original",
            );
          }}
        />
      </div>

      {PHOTO_GROUPS.map((group) => (
        <div key={group.id} className="admin-site-group">
          <h4 className="admin-site-group-title">{group.title}</h4>
          <p className="admin-field-hint">{group.hint}</p>
          <ul className={`admin-site-slots${group.slots.length === 1 ? " is-single" : ""}`}>
            {group.slots.map((slot) => (
              <PhotoSlot
                key={slot.id}
                slot={slot}
                photo={content.photos[slot.id]}
                aspect={group.aspect}
                captioned={group.captioned}
                busyText={busy?.key === slot.id ? busy.text : null}
                disabled={disabled}
                canUpload={storageReady}
                onPick={(file) =>
                  uploadAll(slot.id, [file], (f) => {
                    const fd = new FormData();
                    fd.append("slotId", slot.id);
                    fd.append("file", f);
                    return adminSetSitePhoto(fd);
                  })
                }
                onReset={() => {
                  const ask = "¿Volver a la foto original? La que subiste se borra.";
                  if (!confirm(ask)) return;
                  run(
                    slot.id,
                    "Restaurando…",
                    () => adminResetSitePhoto(slot.id),
                    "Volvió la foto original",
                  );
                }}
                onCaption={(caption) =>
                  run(
                    slot.id,
                    "Guardando…",
                    () => adminSetSitePhotoCaption(slot.id, caption),
                    "Texto guardado",
                  )
                }
              />
            ))}
          </ul>
        </div>
      ))}

      <div className="admin-site-group">
        <h4 className="admin-site-group-title">Galería de torneos</h4>
        <p className="admin-field-hint">
          La página de Torneos: cada torneo con sus fotos de jugadores y de
          ganadores. Podés elegir varias fotos a la vez.
        </p>

        <div className="admin-site-new-tournament">
          <TournamentForm
            submitLabel="Agregar torneo"
            disabled={disabled}
            onSubmit={addTournament}
          />
        </div>

        {content.gallery.length === 0 ? (
          <p className="admin-field-hint">Todavía no hay torneos en la galería.</p>
        ) : (
          <div className="admin-site-tournaments">
            {content.gallery.map((t, i) => (
              <GalleryTournament
                key={t.id}
                t={t}
                index={i}
                total={content.gallery.length}
                open={t.id === openId}
                busy={busy}
                disabled={disabled}
                canUpload={storageReady}
                handlers={gallery}
              />
            ))}
          </div>
        )}
      </div>

      {pinModal}
    </section>
  );
}
