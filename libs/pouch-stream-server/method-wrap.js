'use strict';

const debug = require('debug')('pouch-stream-server:method-wrap');
const CHANGE_EVENTS = ['error', 'change', 'complete'];

module.exports = {
    _changes: _changes,
};

function _changes(fn, stream) {
    return function wrappedChanges(listener, options, cb) {
        let db = this;

        let changes = db.changes(options);
        CHANGE_EVENTS.forEach(function eachChangeEvent(event) {
            changes.on(event, onEvent);

            stream.once('finish', function onceFinish() {
                debug('stream finished');
                changes.removeListener(event, onEvent);
                changes.cancel();
            });

            function onEvent(payload) {
                debug('event %s (%j)', event, payload);
                stream.push(['_event', event, [listener, payload]]);
            }
        });
        cb();
    };
}
