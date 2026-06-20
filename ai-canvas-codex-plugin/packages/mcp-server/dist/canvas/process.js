import { spawn } from 'node:child_process';
import net from 'node:net';
import path from 'node:path';
let child;
export async function isPortAvailable(port) {
    return new Promise((resolve) => {
        const server = net.createServer();
        server.once('error', () => resolve(false));
        server.once('listening', () => {
            server.close(() => resolve(true));
        });
        server.listen(port, '127.0.0.1');
    });
}
export async function findAvailablePort(startPort) {
    for (let port = startPort; port < startPort + 50; port += 1) {
        if (await isPortAvailable(port))
            return port;
    }
    throw new Error(`No available local port near ${startPort}`);
}
export async function waitForHealth(url, timeoutMs = 15_000) {
    const started = Date.now();
    while (Date.now() - started < timeoutMs) {
        try {
            const response = await fetch(`${url}/api/health`);
            if (response.ok)
                return;
        }
        catch {
            // Service is still starting.
        }
        await new Promise((resolve) => setTimeout(resolve, 350));
    }
    throw new Error(`Canvas service did not become healthy: ${url}`);
}
export async function startCanvasService(input) {
    const port = await findAvailablePort(input.requestedPort);
    const url = `http://127.0.0.1:${port}`;
    const builtServer = path.join(input.pluginRoot, 'packages/canvas-app/dist/server/server.js');
    const sourceServer = path.join(input.pluginRoot, 'packages/canvas-app/src/server.ts');
    const command = process.execPath;
    const args = [
        builtServer,
        '--port',
        String(port),
        '--workspace-root',
        input.workspaceRoot,
        ...(input.canvasId ? ['--canvas-id', input.canvasId] : [])
    ];
    child = spawn(command, args, {
        cwd: input.pluginRoot,
        env: {
            ...process.env,
            AI_CANVAS_PORT: String(port),
            AI_CANVAS_WORKSPACE_ROOT: input.workspaceRoot,
            ...(input.canvasId ? { AI_CANVAS_CANVAS_ID: input.canvasId } : {}),
            NODE_ENV: 'production'
        },
        stdio: ['ignore', 'ignore', 'pipe']
    });
    child.stderr?.on('data', (chunk) => {
        process.stderr.write(chunk);
    });
    child.once('exit', (code) => {
        if (code !== 0 && code !== null) {
            process.stderr.write(`[ai-canvas-mcp] canvas service exited with code ${code}\n`);
        }
        child = undefined;
    });
    child.once('error', () => {
        child = undefined;
    });
    try {
        await waitForHealth(url);
    }
    catch (error) {
        child.kill();
        throw new Error(`Failed to start built canvas service. Run "pnpm build" first. Source server: ${sourceServer}. ${error instanceof Error ? error.message : String(error)}`);
    }
    return { url, port };
}
