"use strict"

/**
 * This is a simplest implementation of WebSocket server.
 *
 *
 * References:
 * https://developer.mozilla.org/en-US/docs/Web/API/WebSockets_API/Writing_WebSocket_servers#Overview
 * http://tools.ietf.org/html/rfc6455#section-5.2
 * https://tools.ietf.org/html/draft-ietf-hybi-permessage-compression-28
 */

/**
byte  0               1               2               3
bit   0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1
     +-+-+-+-+-------+-+-------------+-------------------------------+
     |F|R|R|R| opcode|M| Payload len |    Extended payload length    |
     |I|S|S|S|  (4)  |A|     (7)     |             (16/64)           |
     |N|V|V|V|       |S|             |   (if payload len==126/127)   |
     | |1|2|3|       |K|             |                               |
     +-+-+-+-+-------+-+-------------+ - - - - - - - - - - - - - - - +
     |     Extended payload length continued, if payload len == 127  |
     + - - - - - - - - - - - - - - - +-------------------------------+
     |                               |Masking-key, if MASK set to 1  |
     +-------------------------------+-------------------------------+
     | Masking-key (continued)       |          Payload Data         |
     +-------------------------------- - - - - - - - - - - - - - - - +
     :                     Payload Data continued ...                :
     + - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - +
     |                     Payload Data continued ...                |
     +---------------------------------------------------------------+
*/


/**
 GET / HTTP/1.1\r\n
 Host: localhost:9999\r\n
 Connection: Upgrade\r\n
 Pragma: no-cache\r\n
 Cache-Control: no-cache\r\n
 Upgrade: websocket\r\n
 Origin: http://localhost:5000\r\n
 Sec-WebSocket-Version: 13\r\n
 User-Agent: Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/46.0.2490.86 Safari/537.36\r\n
 Accept-Encoding: gzip, deflate, sdch\r\n
 Accept-Language: zh-CN,zh;q=0.8,en;q=0.6\r\n
 Sec-WebSocket-Key: 68DadlQYr2kpSTwn+Mj9vg==\r\n
 Sec-WebSocket-Extensions: permessage-deflate; client_max_window_bits\r\n\r\n
 */

var net = require('net');
var http = require('http');
var crypto = require('crypto');
var zlib = require('zlib');

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
function sendFrame(str){
    console.log('\nsend frame:', str);
    var contentBuf = new Buffer(str);
    var contentLen = contentBuf.length,
        payloadLen = 0,
        extPayloadBuf,
        extPayloadLen = 0,
        mask = 0,
        maskBuf,
        headLen = 2;  // head1 and head2

    /*if(contentLen > (1<<62)*2-1){  // 1<<62 == 1<<30
        throw new Error('stop because of too much conent...');
    }*/

    if(contentLen >= (2<<16)-1){
        payloadLen = 127;
        extPayloadLen = contentLen;
        extPayloadBuf = new Buffer(extPayloadLen);
//        frameLen += 8;
    }else if(contentLen >= 126){ //(1<<16)){
        payloadLen = 126;
        extPayloadLen = contentLen;
        extPayloadBuf = new Buffer(extPayloadLen);
//        frameLen += 2;
    }else{
        payloadLen = contentLen;
//        frameLen += 0;
    }

    if(mask){
        maskBuf = new Buffer(4);
        maskBuf.fill(0); // temp mask
//        frameLen += 4;
    }

//    console.log('content len', contentLen, 'payload len', payloadLen);

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
//    console.log('frame len', frameBuf.length, frameBuf.toBinString());

    this.write(frameBuf);
    console.log('frame sent.\n');
}

net.Socket.prototype.sendFrame = sendFrame;

function toBinString(){
    var r = "<Buffer ";
    var len = Math.min(20, this.length);
    for(var i=0; i<len; i++){
        r += fillByteString(this[i].toString(2));
        if(i < len -1)
            r += ",";
    }
    if(len < this.length)
        r += ', ...... >';
    else
        r += '>';

    return r;
}

Buffer.prototype.toBinString = toBinString;

function toHexString(){
    var r = "<Buffer ";
    var len = Math.min(20, this.length);
    for(var i=0; i<len; i++){
        r += '0x'+this[i].toString(16);
        if(i < len -1)
            r += ",";
    }
    if(len < this.length)
        r += ', ...... >';
    else
        r += '>';

    return r;
}
Buffer.prototype.toHexString = toHexString;

/**
 * @num
 * @stuff char to be filled with
 * @direction left/right;
 */
function align(content, num, stuff, direction){
    var target = content || "";
    while(target.length < num){
        if(direction == "left"){
            target = stuff + target;
        }else if(direction == "right"){
            target += stuff;
        }
    }
    return target;
}
function fillByteString(content){
    return align(content, 8, '0', 'left');
}


function onData(data){
    console.log('\ndata length:', data.length); //, '\n', data.toHexString());
    if(isHandshake(data)){
        var reqContent = data.toString('utf8');
        reqContent = parseWSRequest(reqContent);
        var key = genWSHandshakeKey(reqContent.headers["Sec-WebSocket-Key"]);
//        console.log('response key:', key);
        this.header = reqContent;
        this.write(resTemplate.replace('{{key}}', key));
        this.sendFrame('Hello my friend, '+Math.random());
    }else{
        var content = parseFrame(data);
    }
}

function parseFrame(data){
    var d0 = data[0],
        d1 = data[1];
    var fin = getBit(d0, 1),
        rsv1 = getBit(d0, 2),  // for Chrome and Firefox, if rsv1==1, payload is compressed.
        rsv2 = getBit(d0, 3),
        rsv3 = getBit(d0, 4),
        opcode = getBit(d0, 5, 4),
        mask = getBit(d1, 1),
        len = getBit(d1, 2, 7);   // Read bits 9-15 (inclusive) and interpret that as an unsigned integer.
    console.log('FIN', fin, 'rsv123', rsv1, rsv2, rsv3, 'opcode', opcode, 'mask', mask, 'len', len);

    var offset=2;
    if(len < 126){ // If it's 125 or less, then that's the length; you're done.
        var maskKeys = new Buffer([data[offset++], data[offset++], data[offset++], data[offset++]]);
//        console.log('maskKeys:', maskKeys.toBinString());
        var decoded = new Buffer(len);
        for(var i=0; i+offset<data.length; i++){
            decoded[i] = data[i+offset] ^ maskKeys[i%4];
//            console.log(data[i+offset] + ' ^ ' + maskKeys[i%4] + ' = ' + decoded[i]);
        }
        console.log(decoded.toHexString());
        inflate(decoded); // TODO: check if frame need to be inflated.

    }else if(len == 126){ // Read the next 16 bits and interpret those as an unsigned integer. You're done.
        console.log('len = 126 ...');
    }else if(len == 127){ // Read the next 64 bits and interpret those as an unsigned integer (The most significant bit MUST be 0). You're done.
        console.log('len = 127 ...');
    }

    return decoded.toString('utf8');
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

function isHandshake(data){
    return  data && data.length > 14 &&
            String.fromCharCode(data[0]) == 'G' &&
            String.fromCharCode(data[1]) == 'E' &&
            String.fromCharCode(data[2]) == 'T'
}

var resTemplate = "HTTP/1.1 101 Switching Protocols\r\n" +
                  "Upgrade: websocket\r\n" +
                  "Connection: Upgrade\r\n" +
                  "Sec-WebSocket-Accept: {{key}}\r\n" +
                  "Sec-WebSocket-Extensions: permessage-deflate\r\n\r\n";

function parseWSRequest(str){
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


function inflate(buf) {
    var raw = zlib.createInflateRaw(); // {windowBits:15}
    raw.on('data', function (d) {
        console.log(d.toString());
    });
    raw.write(buf);
    raw.write(new Buffer([0x00, 0x00, 0xff, 0xff]));
    raw.flush();
}


var sockets = [];

var WSHandler = function(){
    this.name = 'WSHandler'+parseInt(Math.random()*99999);
    this.socket ;
}

WSHandler.prototype.onData = onData;

WSHandler.prototype.handler = function(socket){
    console.log('client connected.', this.name);
    this.socket = socket;
    sockets.push(socket);

    this.socket.on('data', this.onData);

    this.socket.on('close', function(){
        console.log('socket close');
    })

    this.socket.on('connect', function(){
        console.log('socket connect');
    })

    this.socket.on('drain', function(){
        console.log('socket drain');
    })

    this.socket.on('error', function(){
        console.log('socket error');
    })

    this.socket.on('lookup', function(){
        console.log('socket lookup');
    })

    this.socket.on('timeout', function(){
        console.log('socket timeout');
    })
}


var server = net.createServer(function(socket){var wsHandler = new WSHandler(); wsHandler.handler.call(wsHandler, socket);});

server.listen(9999, function(){
    console.log('server bound');
})



/*
http.createServer(function(req, res){
    console.log('http server created.');
    console.log(req.url);
    res.end('Hello browser.')
}).listen(4000);*/


var path = require('path');
var express = require('express');
var app = express();

var router = express.Router();
router.get('/', function(req, res, next){
    console.log(req.path);
    res.end('Hello...')
})

app.use(express.static(path.join(__dirname, 'public')));
app.use(router);

http.createServer(app).listen(4000);
