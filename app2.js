/**
 * Created by Administrator on 2015/12/15.
 *
 * With ws-simple lib.
 */

"use strict";


var ws = require('./ws-simple');

var clientMap = new Map(); // client -> WSSocket

var server = ws.createServer(9999, function(wsSocket, content){
    console.log('got message:', content);

    wsSocket.send('automitical echo from server.');
//    wsSocket.sendToAll(content);
    wsSocket.sendToOther(content);

})