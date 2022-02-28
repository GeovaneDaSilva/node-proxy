const WsLogger=require("./ws-logger");
const RedisHelper=require("./redis-helper");

const MESSAGES_WAITING=[];
const DEVICE_SOCKETS={};
const TIMER_INTERVAL=10000;

class WaitingMessages {
    
    static tag="WaitingMessages";

    constructor(fingerprint) {
        this.fingerprint = fingerprint;
        this.redisPool = RedisHelper.create(RedisHelper.REDIS_URL);
        this.redisPool.on("error", function (error) {
            WsLogger.log(WaitingMessages.tag,error,"error",true);
            RedisHelper.close(this);
        });
    }
  
    send() {
        let queue = "queue.device." + this.fingerprint;
        WsLogger.log(WaitingMessages.tag,"queue: "+queue);
        this.redisPool.lrange(
            queue,
            0,
            -1,
            function (err, reply) {
                if (err) {
                    WsLogger.log(WaitingMessages.tag,"lrange error: "+err,"error",true);
                    RedisHelper.close(this.redisPool);
                    return;
                }
                WsLogger.log(WaitingMessages.tag,"messages in queue: " + reply.length);
                for (let b = 0; b < reply.length; b++) {
                    let message = reply[b];
                    try {
                        //send this message to DEVICE_SOCKETS[fingerprint]
                        DEVICE_SOCKETS[this.fingerprint].send(message);
                        WsLogger.log(WaitingMessages.tag,"Device " + this.fingerprint + " relaying message " + message);
                    } catch (e) {
                        WsLogger.log(WaitingMessages.tag,"Exception in Device " + this.fingerprint + " relaying: " + e.message,"error",true);
                    }
                }
                RedisHelper.close(this.redisPool);
            }.bind(this)
        );
    }
}

function startWaitingMessagesTimer(){
    let interval=setInterval(function () {
        WsLogger.log(WaitingMessages.tag,"messages: "+MESSAGES_WAITING.length);
        for (let a = 0; a < MESSAGES_WAITING.length; a++) {
            let fingerprint = MESSAGES_WAITING[a];
            WsLogger.log(WaitingMessages.tag,"WAITING_MESSAGES[" + a + "]: " + fingerprint);
            if (DEVICE_SOCKETS[fingerprint]) {
                WsLogger.log(WaitingMessages.tag,"Found in DEVICE_SOCKETS");
                let wms=new WaitingMessages(fingerprint);
                //wms.DEVICE_SOCKETS=DEVICE_SOCKETS;
                wms.send();
            } else {
                WsLogger.log(WaitingMessages.tag,"Not found in DEVICE_SOCKETS");
            }
            MESSAGES_WAITING.splice(a, 1);
        }
    }, TIMER_INTERVAL);
    return interval;
}

function createWaitingMessages(fingerprint){
    return new WaitingMessages(fingerprint);
}

module.exports.create=createWaitingMessages;
module.exports.startTimer=startWaitingMessagesTimer;
module.exports.MESSAGES_WAITING=MESSAGES_WAITING;
module.exports.DEVICE_SOCKETS=DEVICE_SOCKETS;