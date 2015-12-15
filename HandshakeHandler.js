/**
 * Created by Administrator on 2015/12/15.
 */
"use strict";

var crypto = require('crypto');

function isHandshake(data){
    return  data && data.length > 14 &&
        String.fromCharCode(data[0]) == 'G' &&
        String.fromCharCode(data[1]) == 'E' &&
        String.fromCharCode(data[2]) == 'T'
}


var WS_ACCEPT = "Sec-WebSocket-Accept";
var WS_EXTENSIONS = "Sec-WebSocket-Extensions";

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


var resTemplate = "HTTP/1.1 101 Switching Protocols\r\n" +
    "Upgrade: websocket\r\n" +
    "Connection: Upgrade\r\n" +
    "Sec-WebSocket-Accept: {{key}}\r\n" +
    "Sec-WebSocket-Extensions: permessage-deflate\r\n\r\n";

function responseHandshake(){
    this.write(resTemplate.replace('{{key}}', key));
}

module.exports = {
    isHandshake: isHandshake,
    parseWSRequest: parseWSRequest
}