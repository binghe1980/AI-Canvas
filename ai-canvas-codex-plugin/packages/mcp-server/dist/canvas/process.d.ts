export declare function isPortAvailable(port: number): Promise<boolean>;
export declare function findAvailablePort(startPort: number): Promise<number>;
export declare function waitForHealth(url: string, timeoutMs?: number): Promise<void>;
export declare function startCanvasService(input: {
    pluginRoot: string;
    workspaceRoot: string;
    canvasId?: string;
    requestedPort: number;
}): Promise<{
    url: string;
    port: number;
}>;
//# sourceMappingURL=process.d.ts.map