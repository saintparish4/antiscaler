export interface RemoteCacheAdapter {
	/** Returns the stored bytes for `key`, or `null` if not present. */
	get(key: string): Promise<Uint8Array | null>;
	/** Stores `value` under `key`. */
	set(key: string, value: Uint8Array): Promise<void>;
	/** Returns `true` if `key` exists in the remote store. */
	has(key: string): Promise<boolean>;
}
