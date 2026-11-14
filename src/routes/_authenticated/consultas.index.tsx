import { createFileRoute, Link, ClientOnly } from "@tanstack/react-router";
import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CalendarClock, List, LocateFixed, Map as MapIcon, MapPin, SearchX } from "lucide-react";
import { AppShell, PageTitle } from "@/components/vita/AppShell";
import { DemoTag, PlanBadge, Seg, TeleTag, fmtDay, fmtTime, kindLabel } from "@/components/vita/scheduling-ui";
import { schedulingOptionsQuery } from "@/lib/scheduling-query";
import { lookupCep, searchDirectory } from "@/lib/scheduling.functions";
import { coarse, norm, RADIUS_MAX, RADIUS_MIN, type CoverageFilter, type ModeFilter, type SortBy } from "@/lib/scheduling";

const ProviderMap = lazy(() => import("@/components/vita/ProviderMap"));

export const Route = createFileRoute("/_authenticated/consultas/")({
  head: () => ({
    meta: [
      { title: "Agendar consulta — VITA" },
      { name: "description", content: "Encontre profissionais por especialidade, distância e convênio e agende sua consulta." },
      { property: "og:title", content: "Agendar consulta — VITA" },
      { property: "og:description", content: "Busca de profissionais e clínicas com horários disponíveis." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(schedulingOptionsQuery),
  component: Consultas,
});

type Where = "perto" | "cidade";
type Geo = "idle" | "pedindo" | "ok" | "negado";

function Consultas() {
  const { data: opts } = useSuspenseQuery(schedulingOptionsQuery);
  const search = useServerFn(searchDirectory);
  const cep = useServerFn(lookupCep);
  const [specialty, setSpecialty] = useState("");
  const [mode, setMode] = useState<ModeFilter>("ambos");
  const [where, setWhere] = useState<Where>("perto");
  const [geo, setGeo] = useState<Geo>("idle");
  const [origin, setOrigin] = useState<{ lat: number; lng: number } | null>(null);
  const [place, setPlace] = useState("");
  const [placeMsg, setPlaceMsg] = useState("");
  const [city, setCity] = useState<string | null>(null);
  const [radius, setRadius] = useState(10);
  const [anyDistance, setAnyDistance] = useState(false);
  const [coverage, setCoverage] = useState<CoverageFilter>(opts.plan ? "meu_plano" : "todos");
  const [date, setDate] = useState("");
  const [sort, setSort] = useState<SortBy>("distancia");
  const [view, setView] = useState<"lista" | "mapa">("lista");

  const spec = opts.specialties.find((s) => norm(s) === norm(specialty)) ?? "";
  const ready = where === "cidade" ? !!city : !!origin;
  const query = useMemo(() => ({
    specialty: spec || undefined, mode, origin, city, coverage, date: date || null, sort,
    radiusKm: anyDistance || !origin ? null : radius,
  }), [spec, mode, origin, city, coverage, date, sort, radius, anyDistance]);
  const res = useQuery({ queryKey: ["providers", query], queryFn: () => search({ data: query }), enabled: ready });

  const askLocation = () => {
    if (!("geolocation" in navigator)) { setGeo("negado"); return; }
    setGeo("pedindo");
    navigator.geolocation.getCurrentPosition(
      (p) => { setOrigin(coarse({ lat: p.coords.latitude, lng: p.coords.longitude })); setCity(null); setGeo("ok"); },
      () => setGeo("negado"),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 600000 },
    );
  };

  const applyPlace = async () => {
    setPlaceMsg("");
    const digits = place.replace(/\D/g, "");
    let name = place.trim();
    if (digits.length === 8) {
      const r = await cep({ data: { cep: digits } });
      if (!r) { setPlaceMsg("CEP não encontrado."); return; }
      name = r.city;
    }
    const c = opts.cities.find((x) => norm(x.city) === norm(name));
    if (where === "perto") {
      if (!c) { setPlaceMsg(`Ainda não há profissionais em ${name}. Tente outra cidade.`); return; }
      setOrigin({ lat: c.lat, lng: c.lng }); setCity(null);
    } else { setOrigin(null); setCity(c?.city ?? name); }
  };

  useEffect(() => { if (where === "cidade") { setOrigin(null); } else { setCity(null); } setPlace(""); setPlaceMsg(""); }, [where]);

  const results = res.data?.results ?? [];
  const planName = res.data?.plan?.name ?? opts.plan?.name ?? null;

  return (
    <AppShell>
      <div className="mx-auto max-w-6xl">
        <PageTitle title="Consultas" subtitle="Encontre um profissional e agende pelo VITA." action={<Link to="/consultas/agendamentos" className="inline-flex min-h-11 items-center gap-2 rounded-lg border bg-card px-4 font-medium"><CalendarClock className="h-4 w-4" aria-hidden />Meus agendamentos</Link>} />
        <div className="mb-4"><DemoTag /> <span className="ml-1 text-sm text-muted-foreground">Os profissionais e clínicas listados são fictícios.</span></div>
        <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
          <aside aria-label="Filtros" className="space-y-5 rounded-2xl border bg-card p-5 lg:self-start">
            <label className="block text-sm font-medium">Especialidade
              <input list="specs" value={specialty} onChange={(e) => setSpecialty(e.target.value)} placeholder="Todas — digite para buscar" className="mt-1 min-h-11 w-full rounded-lg border bg-background px-3" />
              <datalist id="specs">{opts.specialties.map((s) => <option key={s} value={s} />)}</datalist>
            </label>
            <div><p className="mb-1 text-sm font-medium">Atendimento</p>
              <Seg label="Tipo de atendimento" value={mode} onChange={setMode} options={[{ v: "presencial", l: "Presencial" }, { v: "telemedicina", l: "Telemedicina" }, { v: "ambos", l: "Ambos" }]} /></div>
            <div><p className="mb-1 text-sm font-medium">Onde</p>
              <Seg label="Onde" value={where} onChange={setWhere} options={[{ v: "perto", l: "Perto de mim" }, { v: "cidade", l: "Outra cidade" }]} />
              {where === "perto" && geo !== "ok" && geo !== "negado" && (
                <div className="mt-3 rounded-lg bg-primary-soft p-3 text-sm">
                  <p>Usamos sua localização só para calcular a distância até cada profissional. Ela é arredondada (cerca de 1 km) e nunca é guardada.</p>
                  <button type="button" onClick={askLocation} disabled={geo === "pedindo"} className="mt-2 inline-flex min-h-10 items-center gap-2 rounded-lg bg-primary px-3 font-semibold text-primary-foreground disabled:opacity-60"><LocateFixed className="h-4 w-4" aria-hidden />{geo === "pedindo" ? "Aguardando…" : "Usar minha localização"}</button>
                </div>
              )}
              {where === "perto" && geo === "ok" && <p className="mt-2 text-sm text-success">Localização aproximada em uso.</p>}
              {(where === "cidade" || geo === "negado") && (
                <div className="mt-3 space-y-2">
                  {where === "perto" && <p className="text-sm text-muted-foreground">Sem acesso à localização. Informe seu CEP ou cidade.</p>}
                  <div className="flex gap-2">
                    <input value={place} onChange={(e) => setPlace(e.target.value)} onKeyDown={(e) => e.key === "Enter" && applyPlace()} list={where === "cidade" ? "cities" : undefined} placeholder={where === "cidade" ? "Cidade" : "CEP ou cidade"} aria-label={where === "cidade" ? "Cidade" : "CEP ou cidade"} className="min-h-11 min-w-0 flex-1 rounded-lg border bg-background px-3" />
                    <button type="button" onClick={applyPlace} className="min-h-11 rounded-lg bg-primary px-3 font-semibold text-primary-foreground">OK</button>
                  </div>
                  <datalist id="cities">{opts.cities.map((c) => <option key={c.city} value={c.city} />)}</datalist>
                  {placeMsg && <p role="alert" className="text-sm text-destructive">{placeMsg}</p>}
                  {city && <p className="text-sm text-success">Buscando em {city}.</p>}
                </div>
              )}
            </div>
            {where === "perto" && (
              <div>
                <label className="flex items-center justify-between text-sm font-medium" htmlFor="raio">Raio <span>{anyDistance ? "Qualquer distância" : `${radius} km`}</span></label>
                <input id="raio" type="range" min={RADIUS_MIN} max={RADIUS_MAX} value={radius} disabled={anyDistance} onChange={(e) => setRadius(Number(e.target.value))} className="mt-2 w-full accent-primary" />
                <label className="mt-1 flex min-h-10 items-center gap-2 text-sm"><input type="checkbox" checked={anyDistance} onChange={(e) => setAnyDistance(e.target.checked)} className="h-4 w-4 accent-primary" />Qualquer distância</label>
              </div>
            )}
            <div><p className="mb-1 text-sm font-medium">Convênio</p>
              <Seg label="Convênio" value={coverage} onChange={setCoverage} options={[...(opts.plan ? [{ v: "meu_plano" as const, l: "Aceitam meu plano" }] : []), { v: "particular", l: "Particular" }, { v: "todos", l: "Todos" }]} />
              {opts.plan ? <p className="mt-1 text-xs text-muted-foreground">Seu plano: {opts.plan.name}</p> : <p className="mt-1 text-xs text-muted-foreground">Sem plano vinculado: “Particular” mostra preços sem convênio.</p>}
            </div>
            <label className="block text-sm font-medium">A partir de
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="mt-1 min-h-11 w-full rounded-lg border bg-background px-3" />
            </label>
            <label className="block text-sm font-medium">Ordenar por
              <select value={sort} onChange={(e) => setSort(e.target.value as SortBy)} className="mt-1 min-h-11 w-full rounded-lg border bg-background px-3">
                <option value="distancia">Distância</option><option value="vaga">Próxima vaga</option><option value="preco">Preço particular</option>
              </select>
            </label>
          </aside>

          <section aria-label="Resultados" className="min-w-0">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground" aria-live="polite">{!ready ? "Escolha onde buscar para ver os resultados." : res.isFetching ? "Buscando…" : `${results.length} resultado(s)`}</p>
              <Seg label="Visualização" value={view} onChange={setView} options={[{ v: "lista", l: <span className="inline-flex items-center gap-1"><List className="h-4 w-4" aria-hidden />Lista</span> }, { v: "mapa", l: <span className="inline-flex items-center gap-1"><MapIcon className="h-4 w-4" aria-hidden />Mapa</span> }]} />
            </div>
            {res.isError && <p role="alert" className="rounded-lg bg-danger-soft p-3 text-sm">Não foi possível buscar agora. Tente novamente.</p>}
            {ready && res.isSuccess && results.length === 0 && (
              <div className="rounded-2xl border bg-card p-8 text-center">
                <SearchX className="mx-auto h-10 w-10 text-muted-foreground" aria-hidden />
                <h2 className="mt-3 font-semibold">Nenhum profissional encontrado</h2>
                <div className="mt-4 flex flex-wrap justify-center gap-2">
                  {where === "perto" && !anyDistance && <button type="button" onClick={() => setRadius((r) => Math.min(RADIUS_MAX, Math.max(r * 2, 20)))} className="min-h-11 rounded-lg border px-4 text-sm font-medium hover:bg-muted">Aumentar o raio</button>}
                  {coverage !== "todos" && <button type="button" onClick={() => setCoverage("todos")} className="min-h-11 rounded-lg border px-4 text-sm font-medium hover:bg-muted">Incluir particulares</button>}
                  <button type="button" onClick={() => setWhere("cidade")} className="min-h-11 rounded-lg border px-4 text-sm font-medium hover:bg-muted">Buscar em outra cidade</button>
                </div>
              </div>
            )}
            {view === "mapa" && results.length > 0 && (
              <ClientOnly fallback={<div className="h-[480px] rounded-2xl border bg-muted" />}>
                <Suspense fallback={<div className="h-[480px] rounded-2xl border bg-muted" />}><ProviderMap results={results} center={origin} /></Suspense>
              </ClientOnly>
            )}
            {view === "lista" && (
              <ul className="space-y-4">
                {results.map((r) => (
                  <li key={r.id} className="rounded-2xl border bg-card p-5">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <Link to="/consultas/$providerId" params={{ providerId: r.id }} search={{ remarcar: undefined }} className="font-display text-lg font-semibold hover:text-primary">{r.name}</Link>
                        <p className="text-sm text-muted-foreground">{kindLabel[r.kind]} · {r.specialties.join(", ")}</p>
                      </div>
                      {r.is_demo && <DemoTag />}
                    </div>
                    <p className="mt-2 flex items-start gap-1 text-sm"><MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />{r.address}, {r.city}/{r.uf}{r.distanceKm != null && r.in_person && <strong className="ml-1 whitespace-nowrap">· {r.distanceKm.toFixed(1).replace(".", ",")} km</strong>}</p>
                    <div className="mt-3 flex flex-wrap gap-2"><PlanBadge accepts={r.acceptsMyPlan} planName={opts.plan ? planName : null} price={r.price_private} />{r.telehealth && <TeleTag />}</div>
                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      {r.nextSlots.length === 0 ? <span className="text-sm text-muted-foreground">Sem vagas nos próximos dias</span> : r.nextSlots.map((s) => (
                        <Link key={s.id} to="/consultas/$providerId" params={{ providerId: r.id }} search={{ remarcar: undefined, horario: s.id }} className="min-h-10 content-center rounded-lg border border-primary px-3 text-sm font-medium text-primary hover:bg-primary-soft">{fmtDay(s.starts_at)} {fmtTime(s.starts_at)}</Link>
                      ))}
                      <Link to="/consultas/$providerId" params={{ providerId: r.id }} search={{ remarcar: undefined }} className="ml-auto text-sm font-medium text-primary underline">Ver todos os horários</Link>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </AppShell>
  );
}
