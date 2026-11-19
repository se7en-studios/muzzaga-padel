import test from "node:test";
import assert from "node:assert/strict";
import { beelupStreamInfo, cleanHttpsUrl } from "../lib/beelup.js";
import { normalizeConfig, validateConfig, DEFAULT_CONFIG } from "../lib/clubConfig.js";

const STREAM =
  "https://beelup.com/ver.stream.m3u8.php?p1=bXV6emFnYXBhZGVsMTAx&p2=MjAyNi0xMS0yMCAyMDozMjowNg==";

test("beelupStreamInfo reads the camera and the expiry (Argentina time)", () => {
  const before = Date.parse("2026-11-20T20:00:00-03:00");
  const info = beelupStreamInfo(STREAM, before);
  assert.equal(info.camera, "muzzagapadel101");
  assert.equal(info.expiresAt, Date.parse("2026-11-20T23:32:06Z"));
  assert.equal(info.expired, false);

  const after = Date.parse("2026-11-20T20:33:00-03:00");
  assert.equal(beelupStreamInfo(STREAM, after).expired, true);
});

test("beelupStreamInfo tolerates links without camera or expiry", () => {
  const info = beelupStreamInfo("https://beelup.com/club/muzzaga");
  assert.deepEqual(info, { camera: null, expiresAt: null, expired: false });
  assert.equal(beelupStreamInfo("no es un link").camera, null);
  assert.equal(
    beelupStreamInfo("https://beelup.com/x.php?p1=@@@&p2=%%%").expiresAt,
    null,
  );
});

test("cleanHttpsUrl only keeps https links", () => {
  assert.equal(cleanHttpsUrl(`  ${STREAM}  `), STREAM);
  assert.equal(cleanHttpsUrl("http://beelup.com/x"), "");
  assert.equal(cleanHttpsUrl("javascript:alert(1)"), "");
  assert.equal(cleanHttpsUrl(""), "");
});

test("club config keeps the Beelup link and one stream per court", () => {
  const config = normalizeConfig({
    beelupUrl: "https://beelup.com/club/muzzaga",
    courts: [
      { id: "cancha-1", name: "El Tano", type: "Cristal", streamUrl: STREAM },
      { id: "cancha-2", name: "La Vasca", type: "Cristal", streamUrl: "http://inseguro" },
    ],
  });
  assert.equal(config.beelupUrl, "https://beelup.com/club/muzzaga");
  assert.equal(config.courts[0].streamUrl, STREAM);
  assert.equal(config.courts[1].streamUrl, "");
  assert.equal(normalizeConfig({}).beelupUrl, "");
});

test("validateConfig rejects camera links that are not https", () => {
  const base = { ...normalizeConfig({}), pricing: DEFAULT_CONFIG.pricing };
  const bad = validateConfig({
    ...base,
    beelupUrl: "http://beelup.com",
    courts: [{ ...base.courts[0], streamUrl: "ftp://x" }, base.courts[1]],
  });
  assert.equal(bad.ok, false);
  assert.ok(bad.errors.beelupUrl);
  assert.ok(bad.errors["courts.0.streamUrl"]);

  const good = validateConfig({
    ...base,
    beelupUrl: "https://beelup.com/club/muzzaga",
    courts: [{ ...base.courts[0], streamUrl: STREAM }, base.courts[1]],
  });
  assert.equal(good.ok, true);
  assert.equal(good.config.courts[0].streamUrl, STREAM);
});

test("youtubeEmbedUrl turns YouTube links into muted autoplay embeds", async () => {
  const { youtubeEmbedUrl } = await import("../lib/beelup.js");
  const vid = "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?autoplay=1&mute=1&playsinline=1&rel=0";
  assert.equal(youtubeEmbedUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=10"), vid);
  assert.equal(youtubeEmbedUrl("https://youtu.be/dQw4w9WgXcQ"), vid);
  assert.equal(youtubeEmbedUrl("https://youtube.com/live/dQw4w9WgXcQ?si=abc"), vid);
  assert.equal(youtubeEmbedUrl("https://m.youtube.com/watch?v=dQw4w9WgXcQ"), vid);
  assert.equal(
    youtubeEmbedUrl("https://www.youtube.com/channel/UCabcdefghijklmnopqrstuv/live"),
    "https://www.youtube.com/embed/live_stream?channel=UCabcdefghijklmnopqrstuv&autoplay=1&mute=1&playsinline=1&rel=0",
  );
  assert.equal(youtubeEmbedUrl(STREAM), null);
  assert.equal(youtubeEmbedUrl("https://www.youtube.com/watch?v=corto"), null);
  assert.equal(youtubeEmbedUrl("https://evil.com/watch?v=dQw4w9WgXcQ"), null);
});
