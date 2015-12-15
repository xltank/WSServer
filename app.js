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

require('./ws-simple/pre');


function onData(data){
    console.log('\ndata length:', data.length); //, '\n', data.toHexString());
    if(isHandshake(data)){
        var reqContent = data.toString('utf8');
        reqContent = parseHandshakeRequest(reqContent);
        var key = genWSHandshakeKey(reqContent.headers["Sec-WebSocket-Key"]);
//        console.log('response key:', key);
        this.method = reqContent.method;
        this.path = reqContent.path;
        this.httpVersion = reqContent.httpVersion;
        this.handshakeHeaders = reqContent.headers;
        this.write(resTemplate.replace('{{key}}', key));
        this.sendFrame('Hello my friend, '+Math.random());
    }else{
        var content = parseFrame.call(this, data, function (err, d) {
            if(d)
                console.log('from client:', d.toString());
        });
    }
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
    console.log('FIN', fin, 'rsv123', rsv1, rsv2, rsv3, 'opcode', opcode, 'mask', mask, 'len', len);

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
            closeConnection(this);
            return;
        case 0x9:  // ping event
            console.log('ping event.');
            break;
        case 0xa:  // pong event
            console.log('pong event.');
            break;
    }

    var decoded;
    var offset=2;
    if(len < 126){ // If it's 125 or less, then that's the length; you're done.
        var unmasked = new Buffer(len);
        if(mask){
            var maskKeys = new Buffer([data[offset++], data[offset++], data[offset++], data[offset++]]);
            for(var i=0; i+offset<data.length; i++){
                unmasked[i] = data[i+offset] ^ maskKeys[i%4];
            }
            console.log('unmasked:',unmasked.toHexString());
            console.log('unmasked:',unmasked.toBinString());
        }else{
            data.copy(unmasked, 0, offset);
        }

        if(this.handshakeHeaders[WS_EXTENSIONS].indexOf('permessage-deflate') >= 0 && rsv1 == 1)
            decoded = inflate(unmasked, fin,  callback);
        else
            callback(null, unmasked);

    }else if(len == 126){ // Read the next 16 bits and interpret those as an unsigned integer. You're done.
        console.log('len = 126 ...');
    }else if(len == 127){ // Read the next 64 bits and interpret those as an unsigned integer (The most significant bit MUST be 0). You're done.
        console.log('len = 127 ...');
    }

//    return decoded.toString('utf8');
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


var WS_ACCEPT = "Sec-WebSocket-Accept";
var WS_EXTENSIONS = "Sec-WebSocket-Extensions";

var resTemplate = "HTTP/1.1 101 Switching Protocols\r\n" +
                  "Upgrade: websocket\r\n" +
                  "Connection: Upgrade\r\n" +
                  "Sec-WebSocket-Accept: {{key}}\r\n" +
                  "Sec-WebSocket-Extensions: permessage-deflate\r\n\r\n";

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

// seems each client WebSocket holds a code-map, so we should hold a inflater instance for each client.
// when 2 clients use the same inflater, message are mixed.
var raw = zlib.createInflateRaw(); // {windowBits:15}
function inflate(buf, fin, callback) {

    var buffers = [];

    function onInflateError(err){
        cleanup(raw);
        console.log('error when inflating frame payload:', err.toString());
        callback(err);
    }

    function onInflateData(data){
        buffers.push(data);
    }

    function cleanup(raw){
        raw.removeListener('error', onInflateError);
        raw.removeListener('data', onInflateData);
    }

    raw.on('data', onInflateData);
    raw.on('error', onInflateError);

    raw.write(buf);
    if(fin)
        raw.write(new Buffer([0x00, 0x00, 0xff, 0xff]));

    raw.flush(function(){
        cleanup(raw);
        callback(null, Buffer.concat(buffers));
    });
}


// TODO: what to do when client close socket ..
function closeConnection(socket){
    sockets.delete(socket);
    socket.end();
//    socket.destroy();
}


var sockets = new WeakSet();

net.Socket.prototype.name = 'WSHandler'+parseInt(Math.random()*99999);
net.Socket.prototype.path = "";
net.Socket.prototype.handshakeHeaders = {};

function handler(socket){
    console.log('client connected.');
    sockets.add(socket);

    socket.on('data', onData);

    socket.on('close', function(){
        console.log('socket close');
        sockets.delete(socket);
    })
    socket.on('connect', function(){
        console.log('socket connect');
    })
    socket.on('drain', function(){
        console.log('socket drain');
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


var server = net.createServer(handler);

/*server.listen(9999, function(){
    console.log('server bound');
})*/

server.on('connection', function(e){
    console.log('server connection');
})

server.on('listening', function(e){
    console.log('server listening');
})

server.on('error', function(e){
    console.log('server error', e);
})

server.on('close', function(e){
    console.log('server close');
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
