import fs from 'node:fs';
import path from 'node:path';
import { patchSettings } from './patch-settings.js';
import { ROOT } from '../src/config.js';

export function patchBackend(directory = path.join(ROOT, 'vendor', 'LawinServer')) {
  const index = path.join(directory, 'index.js');
  let source = fs.readFileSync(index, 'utf8');
  if (!source.includes('/local/health')) {
    source = source.replace('express.use(Express.json());', `// Local launcher adaptation: expose readiness and sanitized request diagnostics.\nexpress.get('/local/health', (req, res) => res.status(global.localXmppReady ? 200 : 503).json({ service: 'fortnite-backend-local', ready: !!global.localXmppReady }));\nexpress.use((req, res, next) => { console.log('[HTTP]', req.method, req.path); next(); });\nexpress.use(Express.json());`);
  }
  source = source.replace('express.listen(port, () => {', "express.listen(port, '127.0.0.1', () => {");
  source = source.replace('process.exit(0);', 'process.exit(1);');
  if (!source.includes('// Launcher route error boundary')) {
    source = source.replace('// if endpoint not found, return this error', `// Launcher route error boundary: Express 4 does not await async handlers.
express.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    console.error('[HTTP] request failed:', error.name);
    res.status(error.status >= 400 && error.status < 600 ? error.status : 500).json({error: 'Request could not be processed.'});
});
// if endpoint not found, return this error`);
  }
  fs.writeFileSync(index, source);
  // Adapt the pinned routers without upgrading to incompatible Express 5 paths.
  fs.writeFileSync(path.join(directory, 'structure', 'launcher-router.js'), `const Express = require('express');
module.exports = function() {
  const router = Express.Router();
  const wrap = handler => Array.isArray(handler) ? handler.map(wrap) : typeof handler !== 'function' || handler.length === 4 ? handler : function(req,res,next) {
    try { Promise.resolve(handler(req,res,next)).catch(next); } catch(error) { next(error); }
  };
  for (const method of ['get','post','put','patch','delete','all','options','head','use']) {
    const original = router[method];
    router[method] = function(...args) { return original.apply(this,args.map(wrap)); };
  }
  return router;
};
`);
  for (const file of fs.readdirSync(path.join(directory,'structure')).filter(name=>name.endsWith('.js') && name !== 'launcher-router.js')) {
    const target = path.join(directory,'structure',file);
    const text = fs.readFileSync(target,'utf8');
    fs.writeFileSync(target,text.replace('const express = Express.Router();', 'const express = require("./launcher-router")();'));
  }
  const xmpp = path.join(directory, 'structure', 'xmpp.js');
  source = fs.readFileSync(xmpp, 'utf8');
  source = source.replace('const port = 80;', 'const port = Number(process.env.XMPP_PORT || 80);');
  source = source.replace('new WebSocket({ port: port }, () => console.log("XMPP and Matchmaker started listening on port", port))', "new WebSocket({ port: port, host: '127.0.0.1' }, () => { global.localXmppReady = true; console.log('XMPP and Matchmaker started listening on port', port); })");
  source = source.replace('console.log("XMPP and Matchmaker \\x1b[31mFAILED\\x1b[0m to start hosting.");', "console.error('XMPP failed to start:', err.message); process.exit(1);");
  // Translate the message left by an earlier local installation.
  source = source.replace('XMPP konnte nicht starten:', 'XMPP failed to start:');
  source = source.replace("port: port, host: '127.0.0.1'", "port: port, maxPayload: 1024 * 1024, host: '127.0.0.1'");
  if (!source.includes('// Launcher XMPP error boundary')) {
    source = source.replace("ws.on('message', async (message) => {", "// Launcher XMPP error boundary: close only the malformed client's socket.\n    ws.on('message', (message) => { (async () => {");
    source = source.replace(/\n    \}\)\r?\n\r?\n    ws\.on\('close'/, "\n    })().catch(() => ws.close(1008, 'Invalid XMPP message')); });\n\n    ws.on('close'");
  }
  fs.writeFileSync(xmpp, source);
  const cloud = path.join(directory,'structure','cloudstorage.js');
  source = fs.readFileSync(cloud,'utf8');
  if (!source.includes('// Launcher cloud file boundary')) {
    source = source.replace('const file = path.join(__dirname, "..", "CloudStorage", req.params.file);', `// Launcher cloud file boundary: decoded URL parameters may contain separators.
    if (!/^[A-Za-z0-9_-]+\\.ini$/i.test(req.params.file)) return res.status(404).end();
    const file = path.join(__dirname, "..", "CloudStorage", req.params.file);`);
  }
  source = source.replace(/req\.rawBody = "";\s*req\.setEncoding\("latin1"\);\s*req\.on\("data", \(chunk\) => req\.rawBody \+= chunk\);\s*req\.on\("end", \(\) => next\(\)\);/, `Express.raw({type: () => true, limit: '1mb'})(req, res, error => {
            if (error) return next(error);
            if (!Buffer.isBuffer(req.body)) return res.status(400).json({error: 'Expected binary client settings.'});
            req.rawBody = req.body.toString('latin1'); next();
        });`);
  // Cloud metadata describes bytes, not JavaScript UTF-16 string length. This
  // matters for hotfix files containing localized comments or settings values.
  source = source.replaceAll('"length": ParsedFile.length,','"length": Buffer.byteLength(ParsedFile),');
  fs.writeFileSync(cloud,source);
  const mcp = path.join(directory, 'structure', 'mcp.js');
  source = fs.readFileSync(mcp, 'utf8');
  if (!source.includes('// Launcher profile file boundary')) {
    source = source.replace('express.use((req, res, next) => {', `// Launcher profile file boundary: only bundled profile names may select files.
const launcherProfiles = new Set(fs.readdirSync(path.join(__dirname, '..', 'profiles')).filter(name => name.endsWith('.json')).map(name => name.slice(0, -5)));
express.use((req, res, next) => {
    if (req.query.profileId !== undefined && (typeof req.query.profileId !== 'string' || !launcherProfiles.has(req.query.profileId))) {
        return res.status(404).json({error: 'Profile not found.'});
    }
    return next();
});
express.use((req, res, next) => {`);
  }
  fs.writeFileSync(mcp, source);
  const matchmaking = path.join(directory, 'structure', 'matchmaking.js');
  source = fs.readFileSync(matchmaking, 'utf8');
  source = source.replace('"serverAddress": config.GameServer.ip,',
    '"serverAddress": process.env.LAUNCHER_GAME_HOST || "127.0.0.1",');
  source = source.replace('"serverPort": Number(config.GameServer.port),', '"serverPort": 7777,');
  source = source.replace('"serviceUrl": "ws://127.0.0.1",',
    '"serviceUrl": "ws://127.0.0.1:" + (process.env.XMPP_PORT || 80),');
  fs.writeFileSync(matchmaking, source);
  const functions = path.join(directory, 'structure', 'functions.js');
  source = fs.readFileSync(functions, 'utf8').replace('const uuid = require("uuid");', 'const uuid = { v4: require("node:crypto").randomUUID };');
  fs.writeFileSync(functions, source);
  patchSettings(directory);
}
