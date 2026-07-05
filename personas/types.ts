export type Persona = "confucius" | "zen" | "laozi";

export interface PersonaPageProps {
  persona: Persona;
  onPersonaChange: (persona: Persona) => void;
}
