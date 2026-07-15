import type { ReactNode } from 'react';
import { createContext, useContext, useMemo } from 'react';
import type { HydratorControllerConfig } from './useHydrationController';
import { useHydrationController } from './useHydrationController';

export interface HydratorContextValue {
  hydrateNow: () => void;
}

const HydratorContext = createContext<HydratorContextValue | null>(null);

export interface HydratorProviderProps<T> extends HydratorControllerConfig<T> {
  children?: ReactNode;
}

/**
 * Declarative entry point. Mount once near the app root: it hydrates on launch
 * and on return to the foreground, delivering every result to `onHydrate`.
 * Children may call {@link useHydrator} to trigger `hydrateNow()`.
 */
export function HydratorProvider<T>(props: HydratorProviderProps<T>) {
  const { children, ...config } = props;
  const { hydrateNow } = useHydrationController<T>(config);
  const value = useMemo<HydratorContextValue>(
    () => ({ hydrateNow }),
    [hydrateNow]
  );

  return (
    <HydratorContext.Provider value={value}>
      {children}
    </HydratorContext.Provider>
  );
}

/** Access the enclosing provider's imperative hydration controls. */
export function useHydrator(): HydratorContextValue {
  const context = useContext(HydratorContext);
  if (context === null) {
    throw new Error('useHydrator must be used within a HydratorProvider');
  }
  return context;
}
