/**
 * Created by Administrator on 2015/12/15.
 *
 * With ws-simple lib.
 */

"use strict";


var ws = require('./ws-simple');

var clientMap = new Map(); // client -> WSSocket

/*var server = ws.createServer(9999, function(wsSocket, content){
    console.log('got message:', content);

    wsSocket.send('automitical echo from server.');
//    wsSocket.sendToAll(content);
    wsSocket.sendToOther(content);
})*/


var server = ws.createServer2(9999, function(wsSocket, content){
    console.log('got message:', content);

    wsSocket.send('automitical echo from server.');
//    wsSocket.sendToAll(content);
    wsSocket.sendToOther(content);
})



// http server for index.html
var path = require('path');
var http = require('http');
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
