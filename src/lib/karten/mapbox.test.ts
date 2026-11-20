import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const { fahrzeiten, geocode, kodierePolyline, tourKarteUrl } = await import("./mapbox");

const antwort = (json: unknown, status = 200) =>
  Promise.resolve(new Response(JSON.stringify(json), { status }));

afterEach(() => vi.unstubAllEnvs());

describe("Mapbox", () => {
  it("Polyline-Kodierung (Referenzbeispiel von Google)", () => {
    expect(
      kodierePolyline([
        { lat: 38.5, lng: -120.2 },
        { lat: 40.7, lng: -120.95 },
        { lat: 43.252, lng: -126.453 },
      ]),
    ).toBe("_p~iF~ps|U_ulLnnqC_mqNvxq`@");
  });

  it("Geocoding ohne Token liefert null, ohne Anfrage", async () => {
    vi.stubEnv("MAPBOX_TOKEN", "");
    const f = vi.fn();
    expect(await geocode({ strasse: "Hauptstr. 1", plz: "70173", ort: "Stuttgart" }, f)).toBeNull();
    expect(f).not.toHaveBeenCalled();
  });

  it("Geocoding liest die erste Fundstelle, dauerhaft speicherbar", async () => {
    vi.stubEnv("MAPBOX_TOKEN", "tok");
    const f = vi.fn<(url: string) => Promise<Response>>(() =>
      antwort({
        features: [
          {
            geometry: { coordinates: [9.18, 48.77] },
            properties: {
              full_address: "Hauptstraße 1, 70173 Stuttgart",
              match_code: { confidence: "exact" },
            },
          },
        ],
      }),
    );
    const r = await geocode({ strasse: "Hauptstr. 1", plz: "70173", ort: "Stuttgart" }, f as never);
    expect(r).toEqual({
      lat: 48.77,
      lng: 9.18,
      genauigkeit: "exact",
      text: "Hauptstraße 1, 70173 Stuttgart",
    });
    const url = new URL(f.mock.calls[0]![0] as string);
    expect(url.pathname).toBe("/search/geocode/v6/forward");
    expect(url.searchParams.get("q")).toBe("Hauptstr. 1, 70173 Stuttgart");
    expect(url.searchParams.get("permanent")).toBe("true");
    expect(url.searchParams.get("country")).toBe("de");
  });

  it("Fahrzeiten über Mapbox, Punkte ohne Koordinate geschätzt", async () => {
    vi.stubEnv("MAPBOX_TOKEN", "tok");
    const f = vi.fn<(url: string) => Promise<Response>>(() =>
      antwort({
        code: "Ok",
        durations: [
          [0, 600],
          [660, 0],
        ],
      }),
    );
    const r = await fahrzeiten(
      [{ lat: 48.7, lng: 9.1 }, null, { lat: 48.8, lng: 9.2 }],
      f as never,
    );
    expect(r.quelle).toBe("mapbox");
    expect(r.matrix[0]![2]).toBe(10);
    expect(r.matrix[2]![0]).toBe(11);
    expect(r.matrix[0]![1]).toBe(15); // ohne Koordinate
    expect(f.mock.calls[0]![0] as string).toContain(
      "/driving/9.100000,48.700000;9.200000,48.800000?",
    );
  });

  it("fällt bei Fehlern auf die Schätzung zurück", async () => {
    vi.stubEnv("MAPBOX_TOKEN", "tok");
    vi.spyOn(console, "error").mockImplementation(() => {});
    const f = vi.fn<(url: string) => Promise<Response>>(() => antwort({ message: "nope" }, 401));
    const r = await fahrzeiten(
      [
        { lat: 48.7, lng: 9.1 },
        { lat: 48.8, lng: 9.2 },
      ],
      f as never,
    );
    expect(r.quelle).toBe("schaetzung");
    expect(r.matrix[0]![1]).toBeGreaterThan(0);
  });

  it("Kartenbild nur mit öffentlichem Token", () => {
    vi.stubEnv("NEXT_PUBLIC_MAPBOX_TOKEN", "");
    expect(tourKarteUrl(null, [{ lat: 48.7, lng: 9.1 }])).toBeNull();
    vi.stubEnv("NEXT_PUBLIC_MAPBOX_TOKEN", "pk.x");
    const url = tourKarteUrl({ lat: 48.7, lng: 9.1 }, [{ lat: 48.8, lng: 9.2 }, null])!;
    expect(url).toContain("pin-s-1+2563eb(9.20000,48.80000)");
    expect(url).toContain("path-2+2563eb-0.6(");
    expect(url).toContain("access_token=pk.x");
  });
});
