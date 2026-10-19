type Handler = (...args: any[]) => void;

interface Entry {
    cb: Handler;
    target: unknown;
}

export class EventBus {
    private static _map = new Map<string, Entry[]>();

    static on(event: string, cb: Handler, target?: unknown): void {
        let list = EventBus._map.get(event);
        if (!list) {
            list = [];
            EventBus._map.set(event, list);
        }
        list.push({ cb, target });
    }

    static off(event: string, cb: Handler, target?: unknown): void {
        const list = EventBus._map.get(event);
        if (!list) return;
        for (let i = list.length - 1; i >= 0; i--) {
            if (list[i].cb === cb && (target === undefined || list[i].target === target)) list.splice(i, 1);
        }
        if (!list.length) EventBus._map.delete(event);
    }

    static offTarget(target: unknown): void {
        for (const [event, list] of Array.from(EventBus._map)) {
            for (let i = list.length - 1; i >= 0; i--) {
                if (list[i].target === target) list.splice(i, 1);
            }
            if (!list.length) EventBus._map.delete(event);
        }
    }

    /** 监听方只收到载荷，**收不到事件名** —— 需要区分事件名的（effects/EventTrigger）自己按事件包一层 */
    static emit(event: string, ...args: any[]): void {
        const list = EventBus._map.get(event);
        if (!list) return;
        const snapshot = list.slice();
        for (let i = 0; i < snapshot.length; i++) snapshot[i].cb.apply(snapshot[i].target, args);
    }

    static offAll(): void {
        EventBus._map.clear();
    }
}
