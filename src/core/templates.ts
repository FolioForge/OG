import { TemplateId } from "./types.js";

export interface TemplateDefinition {
  id: TemplateId;
  name: string;
  description: string;
}

export const TEMPLATES: TemplateDefinition[] = [
  {
    id: "gradient-bottom",
    name: "Gradient Bottom",
    description: "Bottom gradient overlay with left-aligned title and subtitle.",
  },
  {
    id: "center-dark",
    name: "Center Dark",
    description: "Full-screen dark tint with centered title and subtitle.",
  },
];
