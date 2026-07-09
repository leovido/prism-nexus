import { z } from 'zod';

export const appSchema = z.object({
  count: z.number(),
  label: z.string(),
});

export type AppState = z.infer<typeof appSchema>;

export const initialAppState: AppState = {
  count: 0,
  label: 'fresh launch',
};
