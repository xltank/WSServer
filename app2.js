/**
 * Created by Administrator on 2015/12/15.
 *
 * With ws-simple lib.
 */

"use strict";


var ws = require('./ws-simple');

var wsSocket = ws.createServer(9999, function(content){
    console.log('from ws-simple:', content);
})