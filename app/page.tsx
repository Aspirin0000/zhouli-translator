"use client";

import { useState, useCallback } from "react";
import type { Persona } from "@/personas/types";
import ConfuciusPage from "@/personas/confucius";
import ZenPage from "@/personas/zen";
import LaoziPage from "@/personas/laozi";

const personaComponents: Record<
  Persona,
  React.ComponentType<{ persona: Persona; onPersonaChange: (p: Persona) => void }>
> = {
  confucius: ConfuciusPage,
  zen: ZenPage,
  laozi: LaoziPage,
};

export default function Home() {
  const [persona, setPersona] = useState<Persona>("confucius");

  const handlePersonaChange = useCallback(
    (p: Persona) => {
      setPersona(p);
    },
    [],
  );

  const PageComponent = personaComponents[persona];

  return <PageComponent persona={persona} onPersonaChange={handlePersonaChange} />;
}
