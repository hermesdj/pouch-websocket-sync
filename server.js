const websocket = require('websocket-stream');
const PouchSync = require('./libs/pouch-stream-multi-sync');

const ignoreErrorMessages = [
    'write after end',
    'not opened',
];

module.exports = createServer;

function createServer(httpServer, onRequest) {
    if (!httpServer) {
        throw new Error('need a base HTTP server as first argument');
    }
    let wsserver = websocket.createServer({server: httpServer}, handle);
    return wsserver;

    function handle(stream) {
        stream.on('error', propagateError);
        let server = PouchSync.createServer(onRequest);
        server.on('error', propagateError);
        stream.pipe(server).pipe(stream);
    }

    /* istanbul ignore next */
    function propagateError(err) {
        if (ignoreErrorMessages.indexOf(err.message) < 0) {
            wsserver.emit('error', err);
        }
    }
}
