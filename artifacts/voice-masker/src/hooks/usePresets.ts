import { useState, useCallback } from 'react';
import type { EffectSettings } from './useAudioProcessor';

export interface Preset {
  id: string;
  name: string;
  effects: EffectSettings;
  createdAt: number;
  exportToExtension: boolean;
}

const STORAGE_KEY = 'voicemask-presets';

function loadFromStorage(): Preset[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const presets: Preset[] = raw ? JSON.parse(raw) : [];
    return presets.map(p => ({ ...p, exportToExtension: p.exportToExtension ?? false }));
  } catch {
    return [];
  }
}

function saveToStorage(presets: Preset[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(presets));
}

export function usePresets() {
  const [presets, setPresets] = useState<Preset[]>(() => loadFromStorage());

  const savePreset = useCallback((name: string, effects: EffectSettings) => {
    const preset: Preset = {
      id: `preset-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name: name.trim(),
      effects,
      createdAt: Date.now(),
      exportToExtension: false,
    };
    setPresets(prev => {
      const updated = [preset, ...prev];
      saveToStorage(updated);
      return updated;
    });
    return preset;
  }, []);

  const deletePreset = useCallback((id: string) => {
    setPresets(prev => {
      const updated = prev.filter(p => p.id !== id);
      saveToStorage(updated);
      return updated;
    });
  }, []);

  const renamePreset = useCallback((id: string, newName: string) => {
    setPresets(prev => {
      const updated = prev.map(p => p.id === id ? { ...p, name: newName.trim() } : p);
      saveToStorage(updated);
      return updated;
    });
  }, []);

  const toggleExportToExtension = useCallback((id: string) => {
    setPresets(prev => {
      const updated = prev.map(p => p.id === id ? { ...p, exportToExtension: !p.exportToExtension } : p);
      saveToStorage(updated);
      return updated;
    });
  }, []);

  return { presets, savePreset, deletePreset, renamePreset, toggleExportToExtension };
}
