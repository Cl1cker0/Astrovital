"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { Bone, Eye, Focus, HeartPulse, Pause, Play, RotateCcw, Waypoints } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useMission } from "@/components/providers/mission-provider";
import { CrewSwitcher } from "@/components/shared/crew-switcher";
import { cn } from "@/lib/utils";
import { OrganInspector } from "./organ-inspector";
import type { OrganId } from "@/lib/data/types";
import type { Layer, Layers, ViewPreset } from "./body-scene";

const BodyScene = dynamic(() => import("./body-scene"), {
  ssr: false,
  loading: () => (
    <div className="grid size-full place-items-center bg-[#080b11]">
      <div className="flex flex-col items-center gap-3 text-muted-foreground">
        <div className="size-8 animate-spin rounded-full border-2 border-border border-t-primary" />
        <span className="font-mono text-[11px] tracking-[0.12em] uppercase">Cargando modelo anatómico</span>
      </div>
    </div>
  ),
});

const LAYERS: { id: Layer; label: string; icon: React.ElementType }[] = [
  { id: "skin", label: "Piel", icon: Eye },
  { id: "organs", label: "Órganos", icon: HeartPulse },
  { id: "bones", label: "Esqueleto", icon: Bone },
  { id: "vessels", label: "Vasos", icon: Waypoints },
];

const VIEWS: { id: ViewPreset; label: string }[] = [
  { id: "front", label: "Frontal" },
  { id: "back", label: "Posterior" },
  { id: "left", label: "Lat. izq." },
  { id: "right", label: "Lat. der." },
  { id: "top", label: "Superior" },
];

function HudCard({ label, value, sub }: { label: string; value: React.ReactNode; sub?: string }) {
  return (
    <div className="rounded-md border border-white/10 bg-black/45 px-3 py-2 backdrop-blur-md">
      <p className="font-mono text-[9.5px] tracking-[0.14em] text-muted-foreground uppercase">{label}</p>
      <p className="mt-0.5 font-mono text-[13px] text-foreground tabular">{value}</p>
      {sub && <p className="font-mono text-[10px] text-muted-foreground">{sub}</p>}
    </div>
  );
}

const glass = "border-white/10 bg-black/50 backdrop-blur-md";

export function DigitalTwin() {
  const { selectedCrew, selectedOrgan, selectOrgan, environment } = useMission();
  const [autoRotate, setAutoRotate] = React.useState(true);
  const [focused, setFocused] = React.useState(false);
  const [layers, setLayers] = React.useState<Layers>({ skin: true, organs: true, bones: true, vessels: true });
  const [view, setView] = React.useState<{ preset: ViewPreset; n: number }>({ preset: "front", n: 0 });

  // Any selection change (scene, markers, inspector, analyzer) focuses the camera.
  const first = React.useRef(true);
  React.useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    setFocused(true);
    setAutoRotate(false);
  }, [selectedOrgan]);

  const onSelect = React.useCallback(
    (id: OrganId) => {
      selectOrgan(id);
      setFocused(true);
      setAutoRotate(false);
    },
    [selectOrgan]
  );
  const onUserInteract = React.useCallback(() => setAutoRotate(false), []);
  const goView = (preset: ViewPreset) => {
    setAutoRotate(false);
    if (preset === "reset") setFocused(false);
    setView((v) => ({ preset, n: v.n + 1 }));
  };

  const zeroG = environment.gravity === 0;

  return (
    <Card className="overflow-hidden">
      <CardHeader className="border-b">
        <div className="space-y-1">
          <CardTitle>Gemelo digital biomédico</CardTitle>
          <p className="text-[13px] text-muted-foreground">
            Reconstrucción anatómica volumétrica · {environment.name.toLowerCase()} a{" "}
            <span className="font-mono text-foreground">{environment.gravity.toFixed(2)} g</span>
          </p>
        </div>
        <CrewSwitcher />
      </CardHeader>

      <CardContent className="grid gap-0 p-0 xl:grid-cols-[minmax(0,1fr)_400px]">
        <div className="relative h-[560px] overflow-hidden border-b bg-[#080b11] sm:h-[680px] xl:border-r xl:border-b-0">
          <BodyScene
            crew={selectedCrew}
            selected={selectedOrgan}
            onSelect={onSelect}
            gravity={environment.gravity}
            autoRotate={autoRotate}
            focused={focused}
            layers={layers}
            view={view}
            onUserInteract={onUserInteract}
          />

          {/* frame corners */}
          <div className="pointer-events-none absolute inset-3">
            {["top-0 left-0 border-t border-l", "top-0 right-0 border-t border-r", "bottom-0 left-0 border-b border-l", "bottom-0 right-0 border-b border-r"].map((c) => (
              <span key={c} className={`absolute size-4 border-white/25 ${c}`} />
            ))}
          </div>

          <div className="pointer-events-none absolute top-5 left-5 hidden space-y-2 md:block">
            <div className="flex items-center gap-2 pb-1">
              <span className="relative flex size-1.5">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-nominal opacity-70" />
                <span className="relative inline-flex size-1.5 rounded-full bg-nominal" />
              </span>
              <span className="font-mono text-[10px] tracking-[0.16em] text-muted-foreground uppercase">
                Live · {selectedCrew.suitId} · 120 Hz
              </span>
            </div>
            <HudCard label="Sujeto" value={selectedCrew.name} sub={`${selectedCrew.heightCm} cm · grupo ${selectedCrew.bloodType}`} />
            <HudCard label="Elongación espinal" value={`+${zeroG ? "4.1" : "3.2"} cm`} />
            <HudCard label="Fluid shift cefálico" value={`ΔP +${zeroG ? 24 : 18} mmHg`} />
            <div className={cn("space-y-1 rounded-md border px-3 py-2 font-mono text-[10px] text-muted-foreground", glass)}>
              <Legend color="var(--caution)" label="Precaución" />
              <Legend color="var(--critical)" label="Crítico" />
              <Legend color="var(--primary)" label="Seleccionado" />
            </div>
          </div>

          {/* top-right camera actions */}
          <div className="absolute top-5 right-5 flex gap-1.5">
            <IconAction label="Vista completa" onClick={() => goView("reset")}>
              <RotateCcw />
            </IconAction>
            <IconAction label={focused ? "Salir del foco" : "Enfocar selección"} onClick={() => setFocused((f) => !f)}>
              <Focus className={focused ? "text-primary" : undefined} />
            </IconAction>
            <IconAction label={autoRotate ? "Pausar rotación" : "Rotación automática"} onClick={() => setAutoRotate((v) => !v)}>
              {autoRotate ? <Pause /> : <Play />}
            </IconAction>
          </div>

          {/* bottom toolbar */}
          <div className="absolute inset-x-5 bottom-5 flex flex-wrap items-end justify-between gap-2">
            <div className={cn("flex items-center gap-0.5 rounded-md border p-0.5", glass)} role="group" aria-label="Capas">
              {LAYERS.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  type="button"
                  aria-pressed={layers[id]}
                  onClick={() => setLayers((l) => ({ ...l, [id]: !l[id] }))}
                  className={cn(
                    "flex h-7 items-center gap-1.5 rounded px-2 font-mono text-[10.5px] transition-colors cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                    layers[id] ? "bg-white/10 text-foreground" : "text-muted-foreground/60 hover:text-foreground"
                  )}
                >
                  <Icon className="size-3.5" />
                  {label}
                </button>
              ))}
            </div>
            <div className={cn("flex items-center gap-0.5 rounded-md border p-0.5", glass)} role="group" aria-label="Vistas">
              {VIEWS.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => goView(v.id)}
                  className="h-7 rounded px-2 font-mono text-[10.5px] text-muted-foreground transition-colors cursor-pointer outline-none hover:bg-white/10 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
                >
                  {v.label}
                </button>
              ))}
            </div>
          </div>
          <p className="pointer-events-none absolute top-[52px] right-5 hidden text-right font-mono text-[10px] whitespace-nowrap leading-relaxed text-muted-foreground/80 lg:block">
            Arrastrar · rotar &nbsp;·&nbsp; Clic der. · desplazar
            <br />
            Rueda · zoom al cursor &nbsp;·&nbsp; WASD / QE · mover
          </p>
        </div>

        <OrganInspector />
      </CardContent>
    </Card>
  );
}

function IconAction({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="outline" size="icon-sm" className={glass} onClick={onClick} aria-label={label}>
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="size-1.5 rounded-full" style={{ background: color }} />
      {label}
    </span>
  );
}
