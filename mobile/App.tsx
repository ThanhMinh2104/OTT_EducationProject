import React, { useEffect } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import AppNavigator from './src/navigation/AppNavigator';
import { forceResetDocumentPickerLock } from './src/utils/documentPickerLock';

export default function App() {
  useEffect(() => {
    // Reset DocumentPicker lock khi app resume từ background
    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active') {
        forceResetDocumentPickerLock();
      }
    });

    return () => {
      subscription.remove();
    };
  }, []);

  return <AppNavigator />;
}
