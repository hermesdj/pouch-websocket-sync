'use strict';

const debug = require('debug')('pouch-remote-stream:stream');
const stream = require('stream');
const duplexify = require('duplexify');

module.exports = function Stream(callbacks, opts) {
    let r = readable(opts);
    let w = writable(opts);
    let s = duplexify(w, r, opts);

    return {
        readable: r,
        writable: w,
        duplex: s,
    };

    function writable(options) {
        debug('writable options:', options);
        let st = new stream.Writable(options);
        st._write = _write;
        return st;
    }

    function _write(data, encoding, callback) {
        debug('_write', data);
        let seq = data[0];
        if (seq === '_event') {
            let event = data[1];
            let eventData = data[2];
            let eventName = event;
            if (eventName === 'error') {
                debug('we have an error event here');
                eventName = '_error';
            }
            debug('emitting event: %s (%j)', eventName, eventData);
            s.emit(eventName, eventData);
            callback();
        } else {
            let cb = callbacks[seq];
            if (cb) {
                debug('have callback', cb);
                delete callbacks[seq];
                let payload = data[1];
                errorForPayload(payload);
                debug('applying callback with', payload);
                cb.apply(null, payload);
                debug('applied callback');
            }
            callback();
        }
    }
};

function readable(options) {
    debug('readable options:', options);
    let r = new stream.Readable(options);
    r._read = noop;
    return r;
}


function errorForPayload(payload) {
    let err = payload && payload[0];
    if (err) {
        let error = payload[0] = new Error(err.message);
        error.status = error.statusCode = err.status;
        error.error = err.error;
        error.name = err.name;
    }
}

function noop() {
}
