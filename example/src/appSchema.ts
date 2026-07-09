import { z } from 'zod';

export const appSchema = z.object({
  count: z.number(),
  label: z.string(),
  padding: z.string().optional(),
});

export type AppState = z.infer<typeof appSchema>;

export const initialAppState: AppState = {
  count: 0,
  label: 'fresh launch',
};
