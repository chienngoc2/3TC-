/**
 * Cross-tab & real-time sync manager for Sports Center
 * Synchronizes Member Calendar, Coach Schedule, and Subscriptions instantly
 * without requiring manual page reload (F5).
 */

import { useEffect } from 'react';
import { QueryClient } from '@tanstack/react-query';

export type SyncEventType =
  | 'SLOT_CREATED'
  | 'SLOT_DELETED'
  | 'SLOT_APPROVED'
  | 'SLOT_REJECTED'
  | 'BOOKING_CREATED'
  | 'BOOKING_UPDATED'
  | 'BOOKING_CANCELLED'
  | 'PACKAGE_PURCHASED'
  | 'SUBSCRIPTION_UPDATED';

interface SyncMessage {
  type: SyncEventType;
  timestamp: number;
  payload?: any;
}

const CHANNEL_NAME = 'sports_center_realtime_sync';
let broadcastChannel: BroadcastChannel | null = null;

try {
  if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
    broadcastChannel = new BroadcastChannel(CHANNEL_NAME);
  }
} catch {
  // BroadcastChannel not available or restricted
}

/**
 * Broadcast an event to all other tabs and locally in this tab
 */
export function notifyDataChanged(type: SyncEventType, payload?: any, queryClient?: QueryClient) {
  const message: SyncMessage = {
    type,
    timestamp: Date.now(),
    payload,
  };

  // 1. Post to other open browser tabs
  try {
    if (broadcastChannel) {
      broadcastChannel.postMessage(message);
    }
  } catch {}

  // 2. Dispatch local custom event in current tab
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('app:sync-event', {
        detail: message,
      }),
    );
  }

  // 3. Invalidate relevant queries if queryClient is provided
  if (queryClient) {
    invalidateSyncQueries(queryClient, type);
  }
}

/**
 * Invalidate all relevant React Query keys based on event type
 */
export function invalidateSyncQueries(queryClient: QueryClient, _type?: string) {
  // Invalidate Calendar & Schedule queries
  void queryClient.invalidateQueries({ queryKey: ['member-calendar'] });
  void queryClient.invalidateQueries({ queryKey: ['calendar'] });
  void queryClient.invalidateQueries({ queryKey: ['calendar-slots'] });
  void queryClient.invalidateQueries({ queryKey: ['coach', 'multi-day-schedule'] });
  void queryClient.invalidateQueries({ queryKey: ['coach', 'today-schedule'] });
  void queryClient.invalidateQueries({ queryKey: ['coach', 'pickup-schedules'] });
  void queryClient.invalidateQueries({ queryKey: ['coach', 'availability'] });

  // Invalidate Subscriptions & Bookings
  void queryClient.invalidateQueries({ queryKey: ['member-subscriptions'] });
  void queryClient.invalidateQueries({ queryKey: ['user-subscriptions'] });
  void queryClient.invalidateQueries({ queryKey: ['subscriptions'] });
  void queryClient.invalidateQueries({ queryKey: ['bookings'] });
  void queryClient.invalidateQueries({ queryKey: ['my-bookings'] });
  void queryClient.invalidateQueries({ queryKey: ['subscription-eligible-coaches'] });
}

/**
 * React hook to listen for sync events across tabs and SSE events
 */
export function useSyncListener(
  onSync: (event: SyncMessage) => void,
  queryClient?: QueryClient,
) {
  useEffect(() => {
    // 1. Listener for local CustomEvent ('app:sync-event')
    const handleLocalSync = (e: Event) => {
      const customEvent = e as CustomEvent<SyncMessage>;
      if (customEvent.detail) {
        if (queryClient) {
          invalidateSyncQueries(queryClient, customEvent.detail.type);
        }
        onSync(customEvent.detail);
      }
    };

    // 2. Listener for SSE realtime events ('app:realtime-event')
    const handleRealtime = (e: Event) => {
      const customEvent = e as CustomEvent<{ type: string; data: any }>;
      const rType = customEvent.detail?.type;
      let mappedType: SyncEventType = 'BOOKING_UPDATED';

      if (rType === 'slot.created' || rType === 'slot.deleted' || rType === 'slot.approved' || rType === 'slot.rejected') {
        mappedType = rType === 'slot.created' ? 'SLOT_CREATED' : rType === 'slot.approved' ? 'SLOT_APPROVED' : 'SLOT_DELETED';
      } else if (rType === 'booking.updated' || rType === 'schedule.updated') {
        mappedType = 'BOOKING_UPDATED';
      } else if (rType === 'booking.cancelled') {
        mappedType = 'BOOKING_CANCELLED';
      } else if (rType === 'checkout.paid' || rType === 'subscription.created') {
        mappedType = 'PACKAGE_PURCHASED';
      }

      const syncMsg: SyncMessage = {
        type: mappedType,
        timestamp: Date.now(),
        payload: customEvent.detail?.data,
      };

      if (queryClient) {
        invalidateSyncQueries(queryClient, mappedType);
      }
      onSync(syncMsg);
    };

    // 3. Listener for BroadcastChannel (other tabs)
    const handleBroadcastMessage = (event: MessageEvent<SyncMessage>) => {
      if (event.data && event.data.type) {
        if (queryClient) {
          invalidateSyncQueries(queryClient, event.data.type);
        }
        onSync(event.data);
      }
    };

    window.addEventListener('app:sync-event', handleLocalSync);
    window.addEventListener('app:realtime-event', handleRealtime);

    if (broadcastChannel) {
      broadcastChannel.addEventListener('message', handleBroadcastMessage);
    }

    return () => {
      window.removeEventListener('app:sync-event', handleLocalSync);
      window.removeEventListener('app:realtime-event', handleRealtime);
      if (broadcastChannel) {
        broadcastChannel.removeEventListener('message', handleBroadcastMessage);
      }
    };
  }, [onSync, queryClient]);
}
