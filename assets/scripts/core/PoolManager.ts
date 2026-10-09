import { Node } from 'cc';

type Maker = () => Node;

/** 按 key 复用节点。回收只摘不销毁，重新取出时由调用方复位。 */
export class PoolManager {
    private _free = new Map<string, Node[]>();
    private _makers = new Map<string, Maker>();

    register(key: string, make: Maker): void {
        this._makers.set(key, make);
    }

    get(key: string): Node {
        const free = this._free.get(key);
        if (free && free.length) return free.pop()!;
        const make = this._makers.get(key);
        if (!make) throw new Error('未注册的对象池: ' + key);
        return make();
    }

    put(key: string, node: Node): void {
        node.removeFromParent();
        let free = this._free.get(key);
        if (!free) {
            free = [];
            this._free.set(key, free);
        }
        if (free.indexOf(node) < 0) free.push(node);
    }

    clear(): void {
        for (const free of this._free.values()) {
            for (let i = 0; i < free.length; i++) free[i].destroy();
        }
        this._free.clear();
        this._makers.clear();
    }
}
