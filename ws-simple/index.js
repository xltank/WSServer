/**
 * Created by Administrator on 2015/12/15.
 */

"use strict"

var net = require('net');

require('./pre');
var WSSocket = require('./WSSocket');

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

        sockets.add(wsSocket);
        socketMap.set(socket, wsSocket);

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

