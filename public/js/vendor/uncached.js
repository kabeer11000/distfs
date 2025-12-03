/**
 *
 * @name: UnCached from Nano Speed Cache
 * @author: Kabeer Jaffri, Seyyed Ali Mohammadiyeh
 * @github: https://github.com/kabeer11000/cache
 * @license: MIT
 *
 */
class UNCACHED {
    constructor(options = {}) {
        this._map = new Map();
        this._timer = null;
        this._events = new Map([
            ['expire', []],
            ['evict', []],
        ]);
        this._pending = new Map(); // for getOrSet deduplication
        this.opts = Object.assign(Object.assign({}, UNCACHED.DEFAULTS), options);
        if (this.opts.checkPeriod > 0)
            this._startCleanupTimer();
    }
    set(key, value, ttl = this.opts.defaultTTL) {
        const now = Date.now();
        const exp = ttl > 0 ? now + ttl : 0;
        const cloned = this.opts.useClone ? this._clone(value) : value;
        const entry = { v: cloned, e: exp, t: now, a: 0 };
        const existed = this._map.has(key);
        this._map.set(key, entry);
        if (!existed && this.opts.maxSize > 0 && this._map.size > this.opts.maxSize) {
            this._evictLRU();
        }
        return this;
    }
    get(key, options = {}) {
        const { touch = true } = options;
        const entry = this._map.get(key);
        if (!entry)
            return undefined;
        const now = Date.now();
        const expired = entry.e !== 0 && entry.e < now;
        if (expired) {
            if (this.opts.allowStale) {
                if (touch)
                    this._touch(entry);
                return entry.v;
            }
            if (this.opts.staleWhileRevalidate > 0 &&
                now - entry.e < this.opts.staleWhileRevalidate) {
                if (touch)
                    this._touch(entry);
                return entry.v;
            }
            return undefined;
        }
        if (touch)
            this._touch(entry);
        return entry.v;
    }
    peek(key) {
        return this.get(key, { touch: false });
    }
    has(key) {
        const entry = this._map.get(key);
        if (!entry)
            return false;
        if (entry.e === 0 || entry.e >= Date.now())
            return true;
        return this.opts.allowStale;
    }
    del(key) {
        const entry = this._map.get(key);
        if (entry) {
            this._disposeEntry(key, entry, 'delete');
            this._map.delete(key);
        }
        return this;
    }
    clear() {
        for (const [key, entry] of this._map) {
            this._disposeEntry(key, entry, 'clear');
        }
        this._map.clear();
        return this;
    }
    ttl(key, newTTL) {
        const entry = this._map.get(key);
        if (!entry)
            return null;
        if (newTTL !== undefined) {
            entry.e = newTTL > 0 ? Date.now() + newTTL : 0;
            return this;
        }
        if (entry.e === 0)
            return Infinity;
        const remaining = entry.e - Date.now();
        return remaining > 0 ? remaining : 0;
    }
    mget(keys) {
        return keys.map((k) => this.get(k));
    }
    mset(map, ttl) {
        Object.entries(map).forEach(([k, v]) => this.set(k, v, ttl));
        return this;
    }
    mdel(keys) {
        keys.forEach((k) => this.del(k));
        return this;
    }
    async getOrSet(key, loader, ttl = this.opts.defaultTTL) {
        const existing = this.get(key);
        if (existing !== undefined)
            return existing;
        let pending = this._pending.get(key);
        if (!pending) {
            pending = loader()
                .then((val) => {
                this.set(key, val, ttl);
                this._pending.delete(key);
                return val;
            })
                .catch((err) => {
                this._pending.delete(key);
                if (this.opts.staleIfError > 0) {
                    const oldEntry = this._map.get(key);
                    const oldValue = oldEntry === null || oldEntry === void 0 ? void 0 : oldEntry.v;
                    if (oldValue !== undefined &&
                        oldEntry &&
                        Date.now() - oldEntry.e < this.opts.staleIfError) {
                        return oldValue;
                    }
                }
                throw err;
            });
            this._pending.set(key, pending);
        }
        return pending;
    }
    wrap(key, loader, ttl) {
        return () => this.getOrSet(key, loader, ttl);
    }
    get size() {
        return this._map.size;
    }
    keys() {
        return this._map.keys();
    }
    values() {
        return Array.from(this._map.values(), entry => entry.v)[Symbol.iterator]();
    }
    entries() {
        return (function* (map) {
            for (const [key, entry] of map) {
                yield [key, entry.v];
            }
        })(this._map);
    }
    stats() {
        const now = Date.now();
        let expired = 0;
        let bytes = 0;
        for (const entry of this._map.values()) {
            if (entry.e !== 0 && entry.e < now)
                expired++;
            bytes += this._roughSizeOf(entry.v);
        }
        return { size: this.size, expired, estimatedBytes: bytes };
    }
    on(event, callback) {
        const list = this._events.get(event);
        if (list)
            list.push(callback);
        return this;
    }
    off(event, callback) {
        const list = this._events.get(event);
        if (list) {
            const idx = list.indexOf(callback);
            if (idx !== -1)
                list.splice(idx, 1);
        }
        return this;
    }
    _emit(event, key, value, reason) {
        var _a;
        for (const cb of (_a = this._events.get(event)) !== null && _a !== void 0 ? _a : []) {
            try {
                cb({ key, value, reason });
            }
            catch (_b) { }
        }
    }
    _startCleanupTimer() {
        if (this._timer)
            return;
        const tick = () => {
            const cleaned = this._cleanup();
            if (cleaned === 0 && this._map.size === 0) {
                if (this._timer)
                    clearInterval(this._timer);
                this._timer = null;
            }
        };
        this._timer = setInterval(tick, this.opts.checkPeriod);
        if (typeof this._timer.unref === 'function') {
            this._timer.unref();
        }
    }
    _cleanup(limit = Infinity) {
        const now = Date.now();
        let cleaned = 0;
        for (const [key, entry] of this._map) {
            if (entry.e !== 0 && entry.e < now) {
                this._disposeEntry(key, entry, 'expire');
                this._map.delete(key);
                this._emit('expire', key, entry.v, 'ttl');
                if (++cleaned >= limit)
                    break;
            }
        }
        return cleaned;
    }
    _evictLRU() {
        let oldestKey = null;
        let oldestScore = Infinity;
        for (const [key, entry] of this._map) {
            const score = entry.t * 1000000 - entry.a;
            if (score < oldestScore) {
                oldestScore = score;
                oldestKey = key;
            }
        }
        if (oldestKey !== null) {
            const entry = this._map.get(oldestKey);
            this._disposeEntry(oldestKey, entry, 'lru');
            this._map.delete(oldestKey);
            this._emit('evict', oldestKey, entry.v, 'lru');
        }
    }
    _touch(entry) {
        entry.t = Date.now();
        entry.a += 1;
    }
    _disposeEntry(key, entry, reason) {
        if (typeof this.opts.disposeValue === 'function') {
            try {
                this.opts.disposeValue(entry.v, key, reason);
            }
            catch (_a) { }
        }
    }
    _clone(val) {
        if (typeof structuredClone === 'function')
            return structuredClone(val);
        if (val === null || typeof val !== 'object')
            return val;
        if (Array.isArray(val))
            return [...val];
        if (val instanceof Date)
            return new Date(val.getTime());
        if (val instanceof Map)
            return new Map(val);
        if (val instanceof Set)
            return new Set(val);
        return Object.assign({}, val);
    }
    _roughSizeOf(val) {
        if (val == null)
            return 0;
        if (typeof val === 'string')
            return val.length * 2;
        if (typeof val === 'number' || typeof val === 'boolean')
            return 8;
        if (Array.isArray(val))
            return val.length * 32;
        if (val && typeof val === 'object')
            return Object.keys(val).length * 64;
        return 100;
    }
    dispose() {
        var _a;
        if (this._timer) {
            clearInterval(this._timer);
            this._timer = null;
        }
        this.clear();
        this._events.clear();
        (_a = this._pending) === null || _a === void 0 ? void 0 : _a.clear();
    }
}
UNCACHED.DEFAULTS = {
    defaultTTL: 0,
    maxSize: 0,
    checkPeriod: 10000,
    allowStale: false,
    staleWhileRevalidate: 0,
    staleIfError: 0,
    useClone: false,
    disposeValue: null,
};