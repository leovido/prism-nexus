import { StatusBar } from 'expo-status-bar';
import {
  applyPatch,
  configureNativeHydrator,
  estimateChunkCount,
  type HydrationResult,
  HydratorProvider,
  inspectNativeHydrationStorage,
  NATIVE_CHUNK_THRESHOLD_BYTES,
  sealAndStoreHydrationPayload,
  useHydrator,
} from 'prism-nexus';
import { createMockEnvelope, mockHydratorExtractor } from 'prism-nexus/testing';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Button,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { type AppState, appSchema, initialAppState } from './appSchema';
import {
  createExampleHydrationSource,
  getWebTestStore,
  usesNativeHydrator,
} from './hydrationSource';

interface HydratorDemoProps {
  appState: AppState;
  hydrationStatus: string;
  onStatusChange: (message: string) => void;
}

function HydratorDemo({
  appState,
  hydrationStatus,
  onStatusChange,
}: HydratorDemoProps) {
  const { hydrateNow } = useHydrator();
  const [storageInfo, setStorageInfo] = useState('—');

  const seedPayload = useCallback(async () => {
    const nextState: AppState = {
      count: appState.count + 10,
      label: usesNativeHydrator() ? 'sealed on device' : 'seeded in mock store',
    };
    const { reqId, url } = mockHydratorExtractor();

    try {
      if (usesNativeHydrator()) {
        await sealAndStoreHydrationPayload({
          reqId,
          state: nextState,
          ctx: 'session',
        });
      } else {
        getWebTestStore().put(
          createMockEnvelope({
            reqId,
            state: nextState,
            context: 'session',
          })
        );
      }
      onStatusChange(`Seeded ${reqId.slice(0, 8)}… via ${url}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      onStatusChange(`Seed failed: ${message}`);
    }
  }, [appState.count, onStatusChange]);

  const seedLargePayload = useCallback(async () => {
    const paddingBytes = NATIVE_CHUNK_THRESHOLD_BYTES + 4096;
    const padding = 'x'.repeat(paddingBytes);
    const nextState: AppState = {
      count: appState.count + 100,
      label: `chunked (~${estimateChunkCount(paddingBytes)} chunks)`,
      padding,
    };
    const { reqId, url } = mockHydratorExtractor();

    try {
      if (usesNativeHydrator()) {
        await sealAndStoreHydrationPayload({
          reqId,
          state: nextState,
          ctx: 'session',
        });
      } else {
        getWebTestStore().put(
          createMockEnvelope({
            reqId,
            state: nextState,
            context: 'session',
          })
        );
      }
      onStatusChange(
        `Seeded large payload ${reqId.slice(0, 8)}… (${estimateChunkCount(paddingBytes)} chunks) via ${url}`
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      onStatusChange(`Large seed failed: ${message}`);
    }
  }, [appState.count, onStatusChange]);

  const inspectStorage = useCallback(async () => {
    if (!usesNativeHydrator()) {
      const snapshot = getWebTestStore().inspect();
      setStorageInfo(
        `mock stored=${snapshot.stored.length}, cached=${snapshot.cached}`
      );
      return;
    }
    try {
      const snapshot = await inspectNativeHydrationStorage();
      setStorageInfo(
        `native stored=${snapshot.stored.length}, cached=${snapshot.cached}`
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      setStorageInfo(`inspect failed: ${message}`);
    }
  }, []);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>PrismNexus Hydrator</Text>
      <Text style={styles.subtitle}>
        {usesNativeHydrator()
          ? 'Native Expo bridge (testMode)'
          : Platform.OS === 'web'
            ? 'Web mock source'
            : 'Mock source (native module not linked — rebuild the app)'}
      </Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>App state</Text>
        <Text style={styles.mono}>{JSON.stringify(appState, null, 2)}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Last hydration</Text>
        <Text style={styles.body}>{hydrationStatus}</Text>
        <Text style={styles.caption}>Storage: {storageInfo}</Text>
      </View>

      <View style={styles.actions}>
        <Button
          title="Seed payload"
          onPress={() => {
            seedPayload();
          }}
        />
        <Button
          title="Seed large payload (>20KB)"
          onPress={() => {
            seedLargePayload();
          }}
        />
        <Button
          title="Hydrate now"
          onPress={() => {
            onStatusChange('Manual hydration triggered…');
            hydrateNow();
          }}
        />
        <Button
          title="Inspect storage"
          onPress={() => {
            inspectStorage();
          }}
        />
      </View>
    </ScrollView>
  );
}

export default function App() {
  const [ready, setReady] = useState(Platform.OS === 'web');
  const [appState, setAppState] = useState<AppState>(initialAppState);
  const [bootStatus, setBootStatus] = useState('Configuring native hydrator…');
  const [hydrationStatus, setHydrationStatus] = useState(
    'Waiting for hydration…'
  );
  const stateRef = useRef(appState);
  stateRef.current = appState;

  useEffect(() => {
    if (Platform.OS === 'web') {
      return;
    }
    configureNativeHydrator({ testMode: true })
      .then(() => {
        setBootStatus('Native hydrator ready');
        setReady(true);
      })
      .catch((error: unknown) => {
        const message =
          error instanceof Error ? error.message : 'Unknown error';
        setBootStatus(`Native setup failed: ${message}`);
        setReady(true);
      });
  }, []);

  const handleHydrateResult = useCallback(
    (result: HydrationResult<AppState>) => {
      if (!result.ok) {
        setHydrationStatus(`Hydration failed: ${result.error.code}`);
        return;
      }
      setAppState((prev) => applyPatch(prev, result.patch));
      setHydrationStatus(
        `Hydrated v${result.version} (${result.context}) with ${result.patch.length} patch op(s)`
      );
    },
    []
  );

  if (!ready) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" />
        <Text style={styles.body}>{bootStatus}</Text>
      </View>
    );
  }

  return (
    <HydratorProvider<AppState>
      source={createExampleHydrationSource()}
      schema={appSchema}
      minVersion={1}
      maxVersion={1}
      getBaseState={() => stateRef.current}
      onHydrate={handleHydrateResult}
      onWarn={(message) => console.warn('[Hydrator]', message)}
      onError={(error) =>
        console.error('[Hydrator]', error.code, error.message)
      }
      testMode
    >
      <StatusBar style="auto" />
      <HydratorDemo
        appState={appState}
        hydrationStatus={hydrationStatus}
        onStatusChange={setHydrationStatus}
      />
    </HydratorProvider>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 24,
  },
  container: {
    flexGrow: 1,
    padding: 24,
    gap: 16,
    backgroundColor: '#f4f6fb',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#101828',
  },
  subtitle: {
    fontSize: 14,
    color: '#475467',
    marginBottom: 8,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    gap: 8,
    borderWidth: 1,
    borderColor: '#e4e7ec',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#344054',
  },
  body: {
    fontSize: 14,
    color: '#344054',
  },
  caption: {
    fontSize: 12,
    color: '#667085',
  },
  mono: {
    fontFamily: Platform.select({
      ios: 'Menlo',
      android: 'monospace',
      default: 'monospace',
    }),
    fontSize: 13,
    color: '#101828',
  },
  actions: {
    gap: 10,
    marginTop: 8,
  },
});
