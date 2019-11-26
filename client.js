const Websocket = require('websocket-stream');
const PouchSync = require('./libs/pouch-stream-multi-sync');

module.exports = createClient;

function createClient() {
    let client = PouchSync.createClient(function connect(address) {
        let ws = Websocket(address);
        ws.on('error', onError);
        return ws;
    });
    return client;

    /* istanbul ignore next */
    function onError(err) {
        if (err.message !== 'write after end') {
            client.emit('error', err);
        }
    }
}
