/**
 * Created by Administrator on 2015/12/15.
 */

"use strict";

var net = require('net');
var http = require('http');
var crypto = require('crypto');
var zlib = require('zlib');


function WSSocket(socket, listener){
    var self = this;
    this._id = parseInt(Math.random()*99999999);
    this.socket = socket;
    this.listener = listener;
    this.method = "";
    this.path = "";
    this.httpVersion = "";
    this.handshakeHeaders = "";

    var responseToHandshake = function(){
        var resTemplate = "HTTP/1.1 101 Switching Protocols\r\n" +
            "Upgrade: websocket\r\n" +
            "Connection: Upgrade\r\n" +
            "Sec-WebSocket-Accept: {{key}}\r\n" +
            "Sec-WebSocket-Extensions: permessage-deflate\r\n\r\n";
        var key = genWSHandshakeKey(self.handshakeHeaders["Sec-WebSocket-Key"]);
//    console.log('response key:', key);

        self.write(resTemplate.replace('{{key}}', key));
    }

    function onData(data){
//        console.log('\n >>> incoming data length:', data.length); //, '\n', data.toHexString());
        if(isHandshake(data)){
            var reqContent = data.toString('utf8');
            reqContent = parseHandshakeRequest(reqContent);
            self.method = reqContent.method;
            self.path = reqContent.path;
            self.httpVersion = reqContent.httpVersion;
            self.handshakeHeaders = reqContent.headers;
            responseToHandshake();
            self.send('Hello my friend, '+ parseInt(Math.random()*10000));
        }else{
            parseFrame.call(self, data, function (err, d) {
                if(d){
                    var content = d.toString();
                    self.listener(self, content);
                }
            });
        }
    }
    this.socket.on('data', onData);

    socket.on('close', function(){
        console.log('socket close');
        global.sockets.delete(socket);
        global.socketMap.delete(socket);
    })
    socket.on('connect', function(){
        console.log('socket connect');
    })
    socket.on('drain', function(){
//        console.log('socket drain');
    })
    socket.on('error', function(){
        console.log('socket error');
    })
    socket.on('lookup', function(){
        console.log('socket lookup');
    })
    socket.on('timeout', function(){
        console.log('socket timeout');
    })
}

WSSocket.prototype.write = function(data, encoding, callback){
    this.socket.write(data, encoding, callback);
}


function isHandshake(data){
    return  data && data.length > 14 &&
        String.fromCharCode(data[0]) == 'G' &&
        String.fromCharCode(data[1]) == 'E' &&
        String.fromCharCode(data[2]) == 'T'
}

function parseHandshakeRequest(str){
    var arr = str.split('\r\n');
    var base = arr[0].split(' ');
    if(base.length <3)
        throw new Error('Invalid http request');

    var result = {headers:{}};
    result.method = base[0];
    result.path = base[1];
    result.httpVersion = base[2];
    for(var i=1; i<arr.length-2; i++){
        var pair = arr[i].split(':');
        var key = pair[0].trim();
        result.headers[key] = pair[1].trim();
//        console.log(key+':'+result.headers[key]);
    }

    return result;
}

var magicString = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";
function genWSHandshakeKey(key){
    return crypto.createHash('sha1').update(key+magicString).digest('base64');
}

function parseFrame(data, callback){
    var d0 = data[0],
        d1 = data[1];
    var fin = getBit(d0, 1),
        rsv1 = getBit(d0, 2),  // for Chrome and Firefox, if rsv1==1, payload is compressed.
        rsv2 = getBit(d0, 3),
        rsv3 = getBit(d0, 4),
        opcode = getBit(d0, 5, 4),
        mask = getBit(d1, 1),
        len = getBit(d1, 2, 7);   // Read bits 9-15 (inclusive) and interpret that as an unsigned integer.
    console.log('\n>>> incoming: FIN', fin, 'rsv123', rsv1, rsv2, rsv3, 'opcode', opcode, 'mask', mask, 'len', len);

    switch(opcode){
        case 0x0:  // continuation
            if(fin)
                console.log('last frame');
            else
                console.log('inter frame.');
            break;
        case 0x1:  // text
            console.log('payload in text.');
            break;
        case 0x2:  // binary
            console.log('payload in binary.');
            break;
        case 0x8:  // close event
            console.log('client closed connection.');
            // TODO: what to do when client close socket ..
            return;
        case 0x9:  // ping event
            console.log('ping event.');
            break;
        case 0xa:  // pong event
            console.log('pong event.');
            break;
    }

    var offset=2;
    if(len < 126){ // If it's 125 or less, then that's the length; you're done.
        var unmasked = new Buffer(len);
        if(mask){
            var maskKeys = new Buffer([data[offset++], data[offset++], data[offset++], data[offset++]]);
            for(var i=0; i+offset<data.length; i++){
                unmasked[i] = data[i+offset] ^ maskKeys[i%4];
            }
        }else{
            data.copy(unmasked, 0, offset);
        }

        if(this.handshakeHeaders[WS_EXTENSIONS].indexOf('permessage-deflate') >= 0 && rsv1 == 1)
            inflate.call(this, unmasked, fin,  callback);
        else
            callback(null, unmasked);

    }else if(len == 126){ // Read the next 16 bits and interpret those as an unsigned integer. You're done.
        console.log('len = 126 ...');
    }else if(len == 127){ // Read the next 64 bits and interpret those as an unsigned integer (The most significant bit MUST be 0). You're done.
        console.log('len = 127 ...');
    }

}

/**
 * @byte
 * @pos  1 2 3 4 5 6 7 8
 * @len  1-8, default 1
 */
function getBit(byte, pos, len){
    len = len || 1;
    return (byte >> (8 - pos - len + 1)) & ((1 << len) -1);
}



var WS_ACCEPT = "Sec-WebSocket-Accept";
var WS_EXTENSIONS = "Sec-WebSocket-Extensions";

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
    if(fin)
        self.inflateRaw.write(new Buffer([0x00, 0x00, 0xff, 0xff]));

    self.inflateRaw.flush(function(){
        cleanup();
        callback(null, Buffer.concat(buffers));
    });
}




/**
 * FIN: 0, then the server will keep listening for more parts of the message;
 *      1, the server should consider the message delivered.
 * opcode: 0x0 for continuation,
 *         0x1 for text (which is always encoded in UTF-8),
 *         0x2 for binary
 *
 * NOW:
 * message is sent all in one frame, that means FIN is always 1.
 * and do not mask data.
 */
function send(str){
    var contentBuf = new Buffer(str);
    var contentLen = contentBuf.length,
        payloadLen = 0,
        extPayloadBuf,
        extPayloadLen = 0,
        mask = 0,
        maskBuf;

    /*if(contentLen > (1<<62)*2-1){  // 1<<62 == 1<<30
     throw new Error('stop because of too much conent...');
     }*/

    if(contentLen >= (2<<16)-1){
        payloadLen = 127;
        extPayloadLen = contentLen;
        extPayloadBuf = new Buffer(extPayloadLen);
    }else if(contentLen >= 126){
        payloadLen = 126;
        extPayloadLen = contentLen;
        extPayloadBuf = new Buffer(extPayloadLen);
    }else{
        payloadLen = contentLen;
    }

    if(mask){
        maskBuf = new Buffer(4);
        maskBuf.fill(0); // temp mask
    }

    var headBuf = new Buffer(2);
    headBuf[0] = 128 + 1;   // 10000001
    headBuf[1] = (mask << 7) + payloadLen;

    var buffers = [headBuf];
    if(extPayloadBuf)
        buffers.push(extPayloadBuf);
    if(mask)
        buffers.push(maskBuf);

    buffers.push(contentBuf);

    var frameBuf = Buffer.concat(buffers);

    this.write(frameBuf);
    console.log('\nframe sent:', str);
}
WSSocket.prototype.send = send;

function sendToOther(str){
    console.log('sent to Other:', str);
    for(var wsSocket of global.sockets.keys()){
        if(wsSocket != this)
            wsSocket.send(str);
    }
}
WSSocket.prototype.sendToOther = sendToOther;

function sendToAll(str){
    console.log('sent to All:', str);
    for(var wsSocket of global.sockets.keys()){
        wsSocket.send(str);
    }
}
WSSocket.prototype.sendToAll = sendToAll;


module.exports = WSSocket;