export declare const delay: (ms: number) => Promise<unknown>;
export declare function retry<T>(fn: () => Promise<T>, opts?: {
    attempts?: number;
    wait?: number;
}): Promise<T>;
//# sourceMappingURL=utils.d.ts.map