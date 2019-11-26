'use strict';

const Promise = require('lie');
const getArguments = require('argsarray');
const once = require('once');

function toPromise(func) {
    // create the function we will be returning
    return getArguments(function gotArguments(args) {
        let self = this;
        let tempCB =
            (typeof args[args.length - 1] === 'function') ? args.pop() : false;
        // if the last argument is a function, assume its a callback
        let usedCB;
        if (tempCB) {
            // if it was a callback, create a new callback which calls it,
            // but do so async so we don't trap any errors
            usedCB = function callTempCB(err, resp) {
                process.nextTick(function onNextTick() {
                    tempCB(err, resp);
                });
            };
        }
        let promise = new Promise(function promised(fulfill, reject) {
            let callback = once(function onced(err, mesg) {
                if (err) {
                    reject(err);
                } else {
                    fulfill(mesg);
                }
            });
            // create a callback for this invocation
            // apply the function in the orig context
            args.push(callback);
            func.apply(self, args);
        });
        // if there is a callback, call it back
        if (usedCB) {
            promise.then(function promised(result) {
                usedCB(null, result);
            }, usedCB);
        }
        return promise;
    });
}

module.exports = toPromise;
