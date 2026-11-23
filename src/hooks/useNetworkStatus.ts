import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';
import { useEffect, useState } from 'react';

function isStateOnline(state: NetInfoState): boolean {
  if (state.isConnected === false) return false;
  if (state.isInternetReachable === false) return false;
  return true;
}

export function useNetworkStatus(): { isOnline: boolean } {
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    let active = true;

    void NetInfo.fetch().then((state) => {
      if (active) {
        setIsOnline(isStateOnline(state));
      }
    });

    const unsubscribe = NetInfo.addEventListener((state) => {
      if (active) {
        setIsOnline(isStateOnline(state));
      }
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  return { isOnline };
}
