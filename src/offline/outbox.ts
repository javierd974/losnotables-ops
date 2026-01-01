import { db, type OutboxItem } from './db';

export type SyncStatus = 'IDLE' | 'SYNCING' | 'AUTH_ERROR';

class OutboxManager {
    private isSyncing = false;
    private authError = false;
    private listeners: (() => void)[] = [];

    constructor() {
        if (typeof window !== 'undefined') {
            window.addEventListener('online', () => this.flush());
            setInterval(() => this.flush(), 30000); // Pulse every 30s
        }
    }

    subscribe(listener: () => void) {
        this.listeners.push(listener);
        return () => {
            this.listeners = this.listeners.filter(l => l !== listener);
        };
    }

    private notify() {
        this.listeners.forEach(l => l());
    }

    getStatus(): SyncStatus {
        if (this.authError) return 'AUTH_ERROR';
        if (this.isSyncing) return 'SYNCING';
        return 'IDLE';
    }

    async flush() {
        if (this.isSyncing || this.authError || !navigator.onLine) return;

        this.isSyncing = true;
        this.notify();

        try {
            const pendingItems = await db.outbox
                .where('status')
                .equals('PENDING')
                .sortBy('id');

            for (const item of pendingItems) {
                if (!navigator.onLine || this.authError) break;

                const now = new Date();
                if (item.last_attempt_at) {
                    const lastAttempt = new Date(item.last_attempt_at);
                    const delayMinutes = Math.pow(2, item.retries);
                    const nextAttempt = new Date(lastAttempt.getTime() + delayMinutes * 60000);
                    if (now < nextAttempt) continue;
                }

                await this.syncItem(item);
            }
        } finally {
            this.isSyncing = false;
            this.notify();
        }
    }

    private async syncItem(item: OutboxItem) {
        if (!item.id) return;

        await db.outbox.update(item.id, { status: 'SENDING' });
        this.notify();

        try {
            // Mock sync delay
            await new Promise(resolve => setTimeout(resolve, 1000));

            const response = await fetch('/api/offline-sync', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({
                    client_event_id: item.client_event_id,
                    type: item.type,
                    payload: item.payload
                })
            });

            if (response.ok) {
                await db.outbox.update(item.id, {
                    status: 'SENT',
                    last_attempt_at: new Date().toISOString()
                });

                // Update the event record too
                await db.events.where('client_event_id').equals(item.client_event_id).modify({
                    sync_status: 'SENT'
                });
            } else {
                if (response.status === 401 || response.status === 403) {
                    this.authError = true;
                    await db.outbox.update(item.id, { status: 'PENDING' });
                    return;
                }
                throw new Error(`Server returned ${response.status}`);
            }
        } catch (error: any) {
            await db.outbox.update(item.id, {
                status: 'PENDING',
                retries: item.retries + 1,
                last_error: error.message,
                last_attempt_at: new Date().toISOString()
            });
        } finally {
            this.notify();
        }
    }

    resetAuthError() {
        this.authError = false;
        this.notify();
        this.flush();
    }
}

export const outboxManager = new OutboxManager();
