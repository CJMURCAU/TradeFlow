import { useState, useEffect, useRef } from 'react';
import NetInfo from '@react-native-community/netinfo';

export type NetworkStatus = {
  isOnline: boolean;
  wasJustReconnected: boolean;
};

export function useNetworkStatus(): NetworkStatus {
  const [isOnline, setIsOnline] = useState(true);
  const [wasJustReconnected, setWasJustReconnected] = useState(false);
  const prevOnlineRef = useRef(true);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      const online = state.isConnected === true && state.isInternetReachable !== false;
      const prev = prevOnlineRef.current;
      prevOnlineRef.current = online;
      setIsOnline(online);
      if (!prev && online) {
        setWasJustReconnected(true);
        setTimeout(() => setWasJustReconnected(false), 100);
      }
    });

    return () => unsubscribe();
  }, []);

  return { isOnline, wasJustReconnected };
}
