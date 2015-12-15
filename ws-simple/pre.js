/**
 * Created by Administrator on 2015/12/11.
 */

var net = require('net');

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