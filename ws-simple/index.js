/**
 * Created by Administrator on 2015/12/15.
 */

"use strict"

var net = require('net');

require('./pre');
var WSSocket = require('./WSSocket');
var WSSocket2 = require('./WSSocket2');

global.sockets = new Set(); // WSSocket set
global.socketMap = new Map(); // net.socket -> WSSocket

/**
 * @port
 * @listener  function(socket){}
 * return net.Server
 */
module.exports.createServer = function(port, listener){
    if(typeof(port) != 'number')
        throw new Error('server port must be number.');

    var server = net.createServer(function(socket){
        console.log('client connected.');
        var wsSocket = new WSSocket(socket, listener);

        global.sockets.add(wsSocket);
        global.socketMap.set(socket, wsSocket);
    });

    server.listen(port, function(){
        console.log('server bound');
    });

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

    return server;
}


var http = require('http'),
    crypto = require('crypto'),
    zlib = require('zlib');
/**
 * This method use http.createServer and the 'upgrade' header to switch to websocket communication.
 * @port
 * @listener  function(socket){}
 * return net.Server
 */
module.exports.createServer2 = function(port, listener){
    if(typeof(port) != 'number')
        throw new Error('server port must be number.');

    var server = http.createServer(function(req, res){
        console.log('client connected.');
        /*var wsSocket = new WSSocket2(socket, listener);

        global.sockets.add(wsSocket);
        global.socketMap.set(socket, wsSocket);*/
    });

    server.listen(port, function(){
        console.log('server bound');
    });

    server.on('connect', function(req, socket, head){
        console.log('server connect');
    })

    /*server.on('connection', function(socket){
        console.log('server connection');
    })*/

    server.on('request', function(req, res){
        console.log('server request');
    })

    server.on('upgrade', function(req, socket, head){
        return upgradeHandler(req, socket, head, listener)
    });

    server.on('clientError', function(){
        console.log('server clientError');
    })

    server.on('close', function(e){
        console.log('server close');
    })

    return server;
}

function upgradeHandler(req, socket, head, listener){
    console.log('server upgrade');

    var wsSocket = new WSSocket2(req.headers, socket, listener);

    var resTemplate = "HTTP/1.1 101 Switching Protocols\r\n" +
        "Upgrade: WebSocket\r\n" +
        "Connection: Upgrade\r\n" +
        "Sec-WebSocket-Accept: {{key}}\r\n" +
        "Sec-WebSocket-Extensions: permessage-deflate\r\n\r\n";
    var key = genWSHandshakeKey(req.headers["sec-websocket-key"]);

    socket.write(resTemplate.replace('{{key}}', key));
}

var magicString = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";
function genWSHandshakeKey(key){
    return crypto.createHash('sha1').update(key+magicString).digest('base64');
}

