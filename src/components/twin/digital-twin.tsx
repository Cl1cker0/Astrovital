"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { Pause, Play, Ruler, Waves } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useMission } from "@/components/providers/mission-provider";
import { CrewSwitcher } from "@/components/shared/crew-switcher";
import { OrganInspector } from "./organ-inspector";

const BodyScene = dynamic(() => import("./body-scene"), {
  ssr: false,
  loading: () => (
    <div className="grid size-full place-items-center">
      <div className="flex flex-col items-center gap-3 text-muted-foreground">
        <div className="size-8 animate-spin rounded-full border-2 border-border border-t-primary" />
        <span className="text-[12px]">Cargando gemelo digital…</span>
      </div>
    </div>
  ),
});

export function DigitalTwin() {
  const { selectedCrew, selectedOrgan, selectOrgan, environment } = useMission();
  const [autoRotate, setAutoRotate] = React.useState(true);

  return (
    <Card className="overflow-hidden">
      <CardHeader className="border-b">
        <div className="space-y-1">
          <CardTitle>Gemelo digital biomédico</CardTitle>
          <p className="text-[13px] text-muted-foreground">
            Morfología y desplazamiento de fluidos en tiempo real · {environment.name.toLowerCase()} a{" "}
            <span className="font-mono text-foreground">{environment.gravity.toFixed(2)} g</span>
          </p>
        </div>
        <CrewSwitcher />
      </CardHeader>

      <CardContent className="grid gap-0 p-0 xl:grid-cols-[minmax(0,1fr)_400px]">
        <div className="relative h-[460px] border-b bg-dotgrid sm:h-[560px] xl:border-r xl:border-b-0">
          <div
            className="pointer-events-none absolute inset-0"
            style={{ background: "radial-gradient(ellipse at 50% 45%, color-mix(in oklab, var(--primary) 9%, transparent), transparent 62%)" }}
          />
          <BodyScene
            crew={selectedCrew}
            selected={selectedOrgan}
            onSelect={selectOrgan}
            gravity={environment.gravity}
            autoRotate={autoRotate}
          />

          {/* HUD overlays */}
          <div className="pointer-events-none absolute top-4 left-4 space-y-2">
            <div className="rounded-md border bg-background/70 px-2.5 py-1.5 backdrop-blur">
              <p className="eyebrow flex items-center gap-1.5">
                <Ruler className="size-3" /> Elongación espinal
              </p>
              <p className="mt-0.5 font-mono text-[13px] tabular">+3.2 cm · {selectedCrew.heightCm} cm</p>
            </div>
            <div className="rounded-md border bg-background/70 px-2.5 py-1.5 backdrop-blur">
              <p className="eyebrow flex items-center gap-1.5">
                <Waves className="size-3" /> Fluid shift cefálico
              </p>
              <p className="mt-0.5 font-mono text-[13px] tabular">ΔP +{environment.gravity === 0 ? 24 : 18} mmHg</p>
            </div>
          </div>

          <div className="absolute top-4 right-4">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="icon-sm"
                  className="bg-background/70 backdrop-blur"
                  onClick={() => setAutoRotate((v) => !v)}
                  aria-label={autoRotate ? "Pausar rotación" : "Reanudar rotación"}
                >
                  {autoRotate ? <Pause /> : <Play />}
                </Button>
              </TooltipTrigger>
              <TooltipContent>{autoRotate ? "Pausar rotación" : "Reanudar rotación"}</TooltipContent>
            </Tooltip>
          </div>

          <div className="pointer-events-none absolute inset-x-4 bottom-4 flex flex-wrap items-center justify-between gap-2 text-[11.5px] text-muted-foreground">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-md border bg-background/70 px-2.5 py-1.5 backdrop-blur">
              <Legend swatch="border-2 border-foreground/50" label="Nominal" />
              <Legend swatch="bg-caution" label="Precaución" />
              <Legend swatch="bg-critical" label="Crítico" />
              <Legend swatch="bg-primary" label="Seleccionado" />
            </div>
            <span className="hidden rounded-md border bg-background/70 px-2.5 py-1.5 backdrop-blur sm:inline">
              Arrastra para rotar · rueda para acercar
            </span>
          </div>
        </div>

        <OrganInspector />
      </CardContent>
    </Card>
  );
}

function Legend({ swatch, label }: { swatch: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`size-2 rounded-full ${swatch}`} />
      {label}
    </span>
  );
}
