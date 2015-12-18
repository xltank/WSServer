/**
 * Created by Administrator on 2015/12/18.
 */
"use strict";

var zlib = require('zlib');


function PerMessageDeflater(slidingWindowSize){
    var slidingWindowSize = slidingWindowSize || 15; //TODO: need more reading

}

// seems each client WebSocket holds a code-map, so we should hold a inflater instance for each client.
// when 2 clients use the same inflater, message are mixed.
function inflate(buf, fin, callback) {
    var self = this;
    if(!self.inflateRaw)
        self.inflateRaw = zlib.createInflateRaw(); // {windowBits:15}

    var buffers = [];

    function onInflateError(err){
        cleanup();
        console.log('error when inflating frame payload:', err.toString());
        callback(err);
    }

    function onInflateData(data){
        buffers.push(data);
    }

    function cleanup(){
        self.inflateRaw.removeListener('error', onInflateError);
        self.inflateRaw.removeListener('data', onInflateData);
    }

    self.inflateRaw.on('data', onInflateData);
    self.inflateRaw.on('error', onInflateError);

    self.inflateRaw.write(buf);
    if(fin)  // 7.2.1 in https://tools.ietf.org/html/draft-ietf-hybi-permessage-compression-28
        self.inflateRaw.write(new Buffer([0x00, 0x00, 0xff, 0xff]));

    self.inflateRaw.flush(function(){
        cleanup();
        callback(null, Buffer.concat(buffers));
    });
}

PerMessageDeflater.prototype.inflate = inflate;

module.exports = PerMessageDeflater;