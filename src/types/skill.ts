import { z } from 'zod';

export const SkillFrontmatterSchema = z.object({
  name: z.string().regex(/^[a-z][a-z0-9-]*$/),
  version: z.string(),
  description: z.string(),
  'allowed-tools': z.array(z.string()).optional(),
});

export type SkillFrontmatter = z.infer<typeof SkillFrontmatterSchema>;

export interface DistillationConfig {
  rhetorical_intensity: number;
  novelty_injection: number;
  imagery_density: number;
}
