/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { dismissFailedMutation, getConflicts, getFailedMutations, requestSync, resolveConflict, resolveConflictKeepingLocal, retryFailedMutation, setOnlineState, subscribeSyncState } from '../lib/syncEngine';
import type { SyncEngineState, SyncMutation } from '../lib/syncTypes';

interface SyncContextValue {
  state: SyncEngineState;
  conflicts: SyncMutation[];
  failed: SyncMutation[];
  syncNow: () => Promise<void>;
  resolveConflict: (id: string) => Promise<void>;
  resolveConflictKeepingLocal: (id: string) => Promise<void>;
  retryFailed: (id: string) => Promise<void>;
  dismissFailed: (id: string) => Promise<void>;
  loadConflicts: () => Promise<void>;
  loadFailed: () => Promise<void>;
}

const initialSyncState = (): SyncEngineState => ({
  online: typeof navigator !== 'undefined' && navigator.onLine,
  running: false,
  lastSyncAt: null,
  lastError: null,
  pendingCount: 0,
  failedCount: 0,
  conflictCount: 0,
  syncedInLastRun: 0,
});

const SyncContext = createContext<SyncContextValue | undefined>(undefined);

export function SyncProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SyncEngineState>(initialSyncState);
  const [conflicts, setConflicts] = useState<SyncMutation[]>([]);
  const [failed, setFailed] = useState<SyncMutation[]>([]);

  const loadConflicts = useCallback(async () => {
    setConflicts(await getConflicts());
  }, []);

  const loadFailed = useCallback(async () => {
    setFailed(await getFailedMutations());
  }, []);

  const syncNow = useCallback(async () => {
    await requestSync();
    await loadConflicts();
    await loadFailed();
  }, [loadConflicts, loadFailed]);

  const resolveConflictId = useCallback(async (id: string) => {
    await resolveConflict(id);
    await loadConflicts();
  }, [loadConflicts]);

  const resolveConflictKeepingLocalId = useCallback(async (id: string) => {
    await resolveConflictKeepingLocal(id);
    await loadConflicts();
    await loadFailed();
  }, [loadConflicts, loadFailed]);

  const retryFailedId = useCallback(async (id: string) => {
    await retryFailedMutation(id);
    await loadFailed();
    await loadConflicts();
  }, [loadConflicts, loadFailed]);

  const dismissFailedId = useCallback(async (id: string) => {
    await dismissFailedMutation(id);
    await loadFailed();
    await loadConflicts();
  }, [loadConflicts, loadFailed]);

  useEffect(() => {
    const unsubscribe = subscribeSyncState((next) => {
      setState(next);
      void loadConflicts();
      void loadFailed();
    });
    const handleOnline = () => setOnlineState(true);
    const handleOffline = () => setOnlineState(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    void requestSync();
    const timer = window.setInterval(() => {
      void requestSync();
    }, 30000);
    return () => {
      unsubscribe();
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.clearInterval(timer);
    };
  }, [loadConflicts, loadFailed]);

  const value = useMemo<SyncContextValue>(
    () => ({ state, conflicts, failed, syncNow, resolveConflict: resolveConflictId, resolveConflictKeepingLocal: resolveConflictKeepingLocalId, retryFailed: retryFailedId, dismissFailed: dismissFailedId, loadConflicts, loadFailed }),
    [state, conflicts, failed, syncNow, resolveConflictId, resolveConflictKeepingLocalId, retryFailedId, dismissFailedId, loadConflicts, loadFailed]
  );

  return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>;
}

export function useSync(): SyncContextValue {
  const context = useContext(SyncContext);
  if (!context) throw new Error('useSync doit être utilisé dans un SyncProvider.');
  return context;
}